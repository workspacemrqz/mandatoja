import { storage } from "../storage";
import type { MilitantAgent, MessagesQueue } from "@shared/schema";
import { militantOllamaQueue } from "../lib/militant-ollama-queue";
import { 
  wahaGetMessages, 
  wahaSendText, 
  wahaStartTyping, 
  wahaStopTyping, 
  wahaSendReaction,
  calculateTypingDuration,
  groupIdToWaha, 
  type WahaConfig 
} from "../lib/waha-client";
import { splitMessageBySentences, sleep, getChunkDelay } from "../lib/message-chunker";

interface WhatsAppMessage {
  id: string;
  fromMe: boolean;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  pushName?: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participants: string[];
}

/**
 * Remove o ponto final do fim de uma mensagem
 */
function removeFinalPeriod(text: string): string {
  return text.replace(/\.$/, '');
}

/**
 * Extrai informações importantes das mensagens do grupo para construir memória contextual
 */
function extractGroupInfo(messages: Array<{ body?: string; message?: string; pushName?: string; fromName?: string; from?: string }>): {
  topics?: string[];
  commonQuestions?: string[];
  politicalLeaning?: 'favoravel' | 'neutro' | 'contrario';
  groupSentiment?: 'positivo' | 'neutro' | 'negativo';
  keyMembers?: Array<{ name: string; phone: string }>;
} {
  const info: any = {};
  
  // Consolidar todas as mensagens em um único texto
  const allMessages = messages.map(msg => msg.body || msg.message || '').join(' ');
  const lowerMessages = allMessages.toLowerCase();
  
  // Extrair tópicos gerais (palavras-chave importantes em discussões políticas)
  const importantTopics = [
    'saúde', 'educação', 'segurança', 'transporte', 'emprego',
    'moradia', 'saneamento', 'cultura', 'esporte', 'lazer',
    'política', 'eleição', 'voto', 'candidato', 'deputado',
    'prefeito', 'governo', 'prefeitura', 'câmara', 'leis'
  ];
  
  const topics: string[] = [];
  for (const topic of importantTopics) {
    if (lowerMessages.includes(topic)) {
      topics.push(topic);
    }
  }
  if (topics.length > 0) info.topics = Array.from(new Set(topics));
  
  // Extrair perguntas comuns (mensagens que terminam com '?')
  const questions: string[] = [];
  for (const msg of messages) {
    const text = msg.body || msg.message || '';
    if (text.includes('?')) {
      const sentences = text.split(/[.!]/);
      for (const sentence of sentences) {
        if (sentence.includes('?')) {
          questions.push(sentence.trim());
        }
      }
    }
  }
  if (questions.length > 0) info.commonQuestions = questions.slice(0, 5); // Limitar a 5 perguntas
  
  // Detectar inclinação política do grupo
  const favorableKeywords = ['apoio', 'vou votar', 'com certeza', 'fechado', 'junto', 'concordo', 'excelente'];
  const contraryKeywords = ['não voto', 'contra', 'discordo', 'péssimo', 'nunca', 'jamais'];
  
  let favorableCount = 0;
  let contraryCount = 0;
  
  for (const keyword of favorableKeywords) {
    if (lowerMessages.includes(keyword)) favorableCount++;
  }
  for (const keyword of contraryKeywords) {
    if (lowerMessages.includes(keyword)) contraryCount++;
  }
  
  if (favorableCount > contraryCount && favorableCount > 0) {
    info.politicalLeaning = 'favoravel';
  } else if (contraryCount > favorableCount && contraryCount > 0) {
    info.politicalLeaning = 'contrario';
  } else {
    info.politicalLeaning = 'neutro';
  }
  
  // Detectar sentimento geral do grupo
  const positiveKeywords = ['bom', 'ótimo', 'excelente', 'maravilhoso', 'feliz', 'alegre', 'animado'];
  const negativeKeywords = ['ruim', 'péssimo', 'horrível', 'triste', 'preocupado', 'revoltado'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const keyword of positiveKeywords) {
    if (lowerMessages.includes(keyword)) positiveCount++;
  }
  for (const keyword of negativeKeywords) {
    if (lowerMessages.includes(keyword)) negativeCount++;
  }
  
  if (positiveCount > negativeCount && positiveCount > 0) {
    info.groupSentiment = 'positivo';
  } else if (negativeCount > positiveCount && negativeCount > 0) {
    info.groupSentiment = 'negativo';
  } else {
    info.groupSentiment = 'neutro';
  }
  
  // Identificar membros mais ativos (que enviaram mais mensagens)
  const memberCounts = new Map<string, { name: string; phone: string; count: number }>();
  
  for (const msg of messages) {
    const phone = msg.from || '';
    const name = msg.pushName || msg.fromName || phone;
    
    if (phone && !memberCounts.has(phone)) {
      memberCounts.set(phone, { name, phone, count: 0 });
    }
    
    if (phone) {
      const member = memberCounts.get(phone)!;
      member.count++;
    }
  }
  
  // Ordenar por contagem e pegar os top 5 membros mais ativos
  const sortedMembers = Array.from(memberCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(m => ({ name: m.name, phone: m.phone }));
  
  if (sortedMembers.length > 0) info.keyMembers = sortedMembers;
  
  return info;
}

// Função para buscar mensagens de um grupo
async function fetchGroupMessages(
  groupId: string,
  wahaConfig: WahaConfig
): Promise<WhatsAppMessage[]> {
  try {
    console.log(`[Militant Agent] 🔍 Buscando mensagens do grupo via WAHA`);
    
    // Convert groupId to WAHA format
    const wahaGroupId = groupIdToWaha(groupId);
    
    // Fetch messages from WAHA
    const messages = await wahaGetMessages(wahaConfig, wahaGroupId, { limit: 100 });
    console.log(`[Militant Agent] 📊 Total de mensagens encontradas: ${messages.length}`);
    
    // Map WAHA messages to expected format
    const mappedMessages: WhatsAppMessage[] = messages.map((msg: any) => ({
      id: msg.id || '',
      fromMe: msg.fromMe || false,
      from: msg.from || '',
      to: msg.to || wahaGroupId,
      body: msg.body || '',
      timestamp: msg.timestamp || 0,
      pushName: msg.pushName || msg._data?.notifyName
    }));
    
    return mappedMessages;
  } catch (error) {
    console.error(`[Militant Agent] ❌ Erro ao buscar mensagens do grupo ${groupId}:`, error);
    return [];
  }
}

// Função para enviar mensagem para grupo dividida em chunks
async function sendGroupMessage(
  groupId: string,
  message: string,
  wahaConfig: WahaConfig,
  replyTo?: string
): Promise<boolean> {
  try {
    // Convert groupId to WAHA format
    const wahaGroupId = groupIdToWaha(groupId);
    
    console.log(`[Militant Agent] 📤 Enviando mensagem para: ${wahaGroupId}`);
    
    // DIVIDIR MENSAGEM EM CHUNKS BASEADOS EM SENTENÇAS
    console.log(`[Militant Agent] 📝 Mensagem original tem ${message.length} caracteres`);
    const chunks = splitMessageBySentences(message);
    
    console.log(`[Militant Agent] 📨 Mensagem dividida em ${chunks.length} chunk(s)`);
    
    // Log detalhado dos chunks para debug
    chunks.forEach((chunk, index) => {
      console.log(`[Militant Agent] 📄 Chunk ${index + 1}: ${chunk.length} caracteres`);
    });
    
    // Enviar cada chunk com delay entre eles
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      
      // Remove o ponto final de cada chunk antes de enviar
      chunk = removeFinalPeriod(chunk);
      
      // Calcular tempo de digitação baseado no tamanho do chunk
      const typingDuration = calculateTypingDuration(chunk.length);
      console.log(`[Militant Agent] ⌨️  Iniciando indicador de digitação por ${typingDuration.toFixed(1)}s para chunk ${i + 1}/${chunks.length}`);
      
      try {
        // Iniciar indicador de digitação
        await wahaStartTyping(wahaConfig, { chatId: wahaGroupId });
        
        // Aguardar tempo de digitação simulado
        await sleep(typingDuration * 1000);
      } catch (typingError) {
        // Se houver erro no typing, continuar mesmo assim (não é crítico)
        console.warn(`[Militant Agent] ⚠️  Erro ao gerenciar indicador de digitação:`, typingError);
      } finally {
        // Sempre tentar parar o indicador de digitação
        try {
          await wahaStopTyping(wahaConfig, { chatId: wahaGroupId });
        } catch (stopError) {
          console.warn(`[Militant Agent] ⚠️  Erro ao parar indicador de digitação:`, stopError);
        }
      }
      
      // Enviar chunk (apenas o primeiro chunk pode ter replyTo)
      await wahaSendText(wahaConfig, {
        chatId: wahaGroupId,
        text: chunk,
        reply_to: i === 0 ? replyTo : undefined
      });
      
      console.log(`[Militant Agent] ✅ Chunk ${i + 1}/${chunks.length} enviado`);
      
      // Aguardar delay entre chunks (exceto após o último)
      if (i < chunks.length - 1) {
        const delay = getChunkDelay();
        console.log(`[Militant Agent] ⏳ Aguardando ${delay}ms antes do próximo chunk...`);
        await sleep(delay);
      }
    }
    
    console.log(`[Militant Agent] ✅ Todos os ${chunks.length} chunk(s) enviados para grupo ${wahaGroupId}${replyTo ? ' (com citação)' : ''}`);
    return true;
  } catch (error) {
    console.error(`[Militant Agent] ❌ Erro ao enviar mensagem para grupo:`, error);
    return false;
  }
}

// Função para gerar resposta usando a fila do Ollama
async function generateResponse(
  systemPrompt: string,
  messageContext: string,
  ollamaApiKey?: string,
  model?: string
): Promise<string | null> {
  try {
    // Usar a fila separada do Militant Ollama para processar a requisição
    const response = await militantOllamaQueue.addToQueue({
      systemPrompt,
      messageContext,
      ollamaApiKey,
      model,
    });
    
    return response;
  } catch (error) {
    console.error("[Militant Agent] ❌ Erro ao gerar resposta:", error);
    return null;
  }
}

// Função para analisar mensagens e determinar ações (reações e citações)
async function analyzeMessagesForActions(
  messages: any[],
  systemPrompt: string,
  ollamaApiKey: string,
  model: string
): Promise<{
  messagesToReact: Array<{ messageId: string; emoji: string }>;
  messageToQuote: string | null;
}> {
  try {
    const analysisPrompt = `Você está analisando mensagens de um grupo do WhatsApp.
Seu papel: ${systemPrompt.substring(0, 200)}...

Mensagens recebidas (formato: índice|autor|mensagem|messageId):
${messages.map((msg: any, idx: number) => 
  `${idx}|${msg.pushName || msg.fromName || msg.from}|${msg.body || msg.message}|${msg.id}`
).join('\n')}

TAREFA 1: Identifique quais mensagens APOIAM sua causa/posição. Para cada uma, você deve reagir com ❤️ ou 🚀.

TAREFA 2: Identifique se alguma mensagem se enquadra em QUALQUER um desses critérios (prioridade em ordem):
   a) Mensagem demonstra DÚVIDA sobre em quem votar (exemplos: "não sei em quem votar", "ainda estou em dúvida", "quem vocês acham que devo votar", "não decidi ainda", "estou na dúvida")
   b) Mensagem faz PERGUNTA sobre política, eleições ou candidatos
   c) Mensagem está DIRECIONADA A VOCÊ especificamente (te menciona, pergunta algo diretamente)

Se encontrar alguma mensagem que se encaixe nesses critérios, você DEVE CITAR essa mensagem ao responder.
Priorize mensagens com dúvidas sobre voto - essas são as mais importantes para citar e responder!

Retorne APENAS um JSON válido no formato:
{
  "react": [{"idx": 0, "emoji": "❤️"}, {"idx": 1, "emoji": "🚀"}],
  "quote": 2
}

Onde:
- "react" é um array com os índices das mensagens que apoiam sua causa e o emoji a usar (❤️ para apoio emocional, 🚀 para empolgação/ação)
- "quote" é o índice da mensagem que você deve citar ao responder (null se nenhuma se encaixar nos critérios acima)

IMPORTANTE: Retorne APENAS o JSON, sem explicações adicionais.`;

    const response = await militantOllamaQueue.addToQueue({
      systemPrompt: "Você é um assistente que analisa mensagens e retorna JSON.",
      messageContext: analysisPrompt,
      ollamaApiKey,
      model,
    });

    if (!response) {
      return { messagesToReact: [], messageToQuote: null };
    }

    // Tentar parsear o JSON da resposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Militant Agent] ⚠️ Resposta de análise não contém JSON válido');
      return { messagesToReact: [], messageToQuote: null };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    // Mapear índices para messageIds
    const messagesToReact = (analysis.react || []).map((item: any) => ({
      messageId: messages[item.idx]?.id,
      emoji: item.emoji
    })).filter((item: any) => item.messageId);

    const messageToQuote = analysis.quote !== null && analysis.quote !== undefined && messages[analysis.quote]
      ? messages[analysis.quote].id
      : null;

    console.log(`[Militant Agent] 📊 Análise: ${messagesToReact.length} mensagens para reagir, ${messageToQuote ? 'citará mensagem' : 'sem citação'}`);
    
    return { messagesToReact, messageToQuote };
  } catch (error) {
    console.error('[Militant Agent] ❌ Erro ao analisar mensagens:', error);
    return { messagesToReact: [], messageToQuote: null };
  }
}

// Nova função para processar filas com buffer temporal
export async function processMilitantMessageQueues(): Promise<void> {
  const WORKER_ID = `militant-processor-${Date.now()}-${Math.random()}`;
  
  try {
    const queues = await storage.getMilitantQueuesReadyForProcessing();
    
    if (queues.length === 0) {
      return;
    }
    
    console.log(`[Militant Agent] 📬 ${queues.length} fila(s) pronta(s) para processar`);
    
    for (const queue of queues) {
      const claimed = await storage.claimMilitantQueueForProcessing(queue.id, WORKER_ID);
      
      if (!claimed) {
        console.log(`[Militant Agent] ⚠️ Não foi possível clamar a fila ${queue.id} (outra instância está processando)`);
        continue;
      }
      
      console.log(`[Militant Agent] 🔒 Fila ${queue.id} clamada para processamento`);
      
      try {
        const agent = await storage.getMilitantAgent(queue.agentId);
        
        if (!agent) {
          console.error(`[Militant Agent] ❌ Agente ${queue.agentId} não encontrado`);
          await storage.failMilitantQueue(queue.id, "Agente não encontrado");
          continue;
        }
        
        if (!agent.isActive) {
          console.log(`[Militant Agent] ⚠️ Agente ${agent.name} está inativo - ignorando fila`);
          await storage.failMilitantQueue(queue.id, "Agente está inativo");
          continue;
        }
        
        console.log(`[Militant Agent] 🤖 Processando fila para agente: ${agent.name} | Grupo: ${queue.groupName || queue.groupId}`);
        
        const wahaUrl = agent.wahaUrl;
        const wahaApiKey = agent.wahaApiKey;
        const wahaSession = agent.wahaSession;
        const ollamaApiKey = process.env.OLLAMA_API_KEY_MILITANT;
        
        if (!ollamaApiKey) {
          console.error(`[Militant Agent] ❌ OLLAMA_API_KEY_MILITANT não configurada`);
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `❌ OLLAMA_API_KEY_MILITANT não configurada - impossível gerar resposta`
          );
          await storage.failMilitantQueue(queue.id, "OLLAMA_API_KEY_MILITANT não configurada");
          continue;
        }
        
        if (!wahaUrl || !wahaApiKey || !wahaSession) {
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `❌ Credenciais WAHA incompletas para ${queue.groupName || queue.groupId}`
          );
          await storage.failMilitantQueue(queue.id, "Credenciais WAHA incompletas");
          continue;
        }
        
        const wahaConfig: WahaConfig = {
          url: wahaUrl,
          apiKey: wahaApiKey,
          session: wahaSession
        };
        
        const lastMessageTimestamps = JSON.parse(agent.lastMessageTimestamp || "{}") as Record<string, string>;
        const now = Date.now();
        const lastRunForGroup = parseInt(lastMessageTimestamps[queue.groupId + "_sent"] || "0");
        const timeSinceLastMessage = now - lastRunForGroup;
        const flowMinutesMs = (agent.flowMinutes || 10) * 60 * 1000;
        
        if (timeSinceLastMessage < flowMinutesMs) {
          const waitTime = Math.ceil((flowMinutesMs - timeSinceLastMessage) / 1000);
          const waitTimeMinutes = Math.ceil(waitTime / 60);
          console.log(`[Militant Agent] ⏱️ Rate limiting: aguardando ${waitTimeMinutes} minuto(s) para grupo ${queue.groupName || queue.groupId}`);
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `⏱️ Rate limiting: aguardando ${waitTimeMinutes} minuto(s) para ${queue.groupName || queue.groupId}`
          );
          await storage.failMilitantQueue(queue.id, `Rate limiting: aguardando ${waitTimeMinutes} minuto(s)`);
          continue;
        }
        
        let messages: any[] = [];
        try {
          messages = JSON.parse(queue.messages || "[]");
        } catch (error) {
          console.error(`[Militant Agent] ❌ Erro ao parsear mensagens da fila:`, error);
          await storage.failMilitantQueue(queue.id, "Erro ao parsear mensagens");
          continue;
        }
        
        if (messages.length === 0) {
          console.log(`[Militant Agent] ⚠️ Fila ${queue.id} está vazia - marcando como completada`);
          await storage.markMilitantQueueSucceeded(queue.id, "Fila vazia");
          continue;
        }
        
        console.log(`[Militant Agent] 📝 Processando ${messages.length} mensagem(ns) do grupo ${queue.groupName || queue.groupId}`);
        
        const llmModel = agent.ollamaModel || "deepseek-v3.1:671b-cloud";
        console.log(`[Militant Agent] 🤖 Usando modelo LLM: ${llmModel}`);
        
        // ========== BUSCAR MENSAGENS HISTÓRICAS DO GRUPO (incluindo próprias mensagens) ==========
        console.log(`[Militant Agent] 📜 Buscando mensagens históricas do grupo para contexto...`);
        const historicalMessages = await fetchGroupMessages(queue.groupId, wahaConfig);
        
        // Separar mensagens próprias (fromMe: true) das mensagens de outros (fromMe: false)
        const ownMessages = historicalMessages.filter(msg => msg.fromMe);
        const othersHistoricalMessages = historicalMessages.filter(msg => !msg.fromMe);
        
        console.log(`[Militant Agent] 📊 Histórico: ${ownMessages.length} mensagens próprias, ${othersHistoricalMessages.length} mensagens de outros`);
        
        // ========== FILTRAR MENSAGENS DA FILA - NÃO PROCESSAR PRÓPRIAS MENSAGENS ==========
        // LÓGICA APLICADA: Usar próprias mensagens como contexto, mas NÃO responder a elas
        const messagesToProcess = messages.filter((msg: any) => !msg.fromMe);
        
        if (messagesToProcess.length === 0) {
          console.log(`[Militant Agent] ⚠️ Todas as mensagens da fila são próprias - não há nada para processar`);
          await storage.markMilitantQueueSucceeded(queue.id, "Apenas mensagens próprias na fila");
          continue;
        }
        
        console.log(`[Militant Agent] ✅ ${messagesToProcess.length} mensagem(ns) de outros usuários para processar (${messages.length - messagesToProcess.length} próprias ignoradas)`);
        
        // ========== MEMÓRIA PERSISTENTE DO GRUPO ==========
        console.log(`[Militant Agent] 🧠 Recuperando memória do grupo...`);
        let groupMemory = await storage.getMilitantGroupMemory(queue.groupId);
        
        if (!groupMemory) {
          try {
            groupMemory = await storage.createMilitantGroupMemory({
              groupId: queue.groupId,
              groupName: queue.groupName || null,
              firstInteraction: new Date(),
              lastInteraction: new Date(),
              totalInteractions: 1,
            });
            console.log(`[Militant Agent] ✨ Nova memória criada para grupo ${queue.groupName || queue.groupId}`);
          } catch (createError: any) {
            if (createError.message?.includes('duplicate key') || createError.message?.includes('unique constraint')) {
              groupMemory = await storage.getMilitantGroupMemory(queue.groupId);
              if (!groupMemory) {
                throw new Error('Não foi possível criar ou recuperar memória do grupo');
              }
            } else {
              throw createError;
            }
          }
        } else {
          console.log(`[Militant Agent] 📚 Memória existente recuperada - ${groupMemory.totalInteractions} interação(ões) anterior(es)`);
        }
        
        // ========== EXTRAÇÃO DE INFORMAÇÕES (apenas de mensagens de outros) ==========
        console.log(`[Militant Agent] 🔍 Extraindo informações das mensagens...`);
        const extractedInfo = extractGroupInfo(messagesToProcess);
        
        // Atualizar memória com informações extraídas
        if (extractedInfo.topics && extractedInfo.topics.length > 0) {
          await storage.appendToMilitantGroupMemory(queue.groupId, 'topics', extractedInfo.topics);
          console.log(`[Militant Agent] 📌 Tópicos identificados: ${extractedInfo.topics.join(', ')}`);
        }
        if (extractedInfo.commonQuestions && extractedInfo.commonQuestions.length > 0) {
          await storage.appendToMilitantGroupMemory(queue.groupId, 'commonQuestions', extractedInfo.commonQuestions);
          console.log(`[Militant Agent] ❓ Perguntas comuns identificadas: ${extractedInfo.commonQuestions.length}`);
        }
        if (extractedInfo.keyMembers && extractedInfo.keyMembers.length > 0) {
          await storage.appendToMilitantGroupMemory(queue.groupId, 'keyMembers', extractedInfo.keyMembers.map(m => JSON.stringify(m)));
          console.log(`[Militant Agent] 👥 Membros ativos: ${extractedInfo.keyMembers.length}`);
        }
        if (extractedInfo.politicalLeaning) {
          await storage.updateMilitantGroupMemory(queue.groupId, { 
            politicalLeaning: extractedInfo.politicalLeaning 
          });
          console.log(`[Militant Agent] 🎯 Inclinação política: ${extractedInfo.politicalLeaning}`);
        }
        if (extractedInfo.groupSentiment) {
          await storage.updateMilitantGroupMemory(queue.groupId, { 
            groupSentiment: extractedInfo.groupSentiment 
          });
          console.log(`[Militant Agent] 😊 Sentimento do grupo: ${extractedInfo.groupSentiment}`);
        }
        
        // Recarregar memória atualizada
        groupMemory = await storage.getMilitantGroupMemory(queue.groupId);
        
        // ========== ANALISAR APENAS MENSAGENS DE OUTROS PARA REAÇÕES E CITAÇÕES ==========
        console.log(`[Militant Agent] 🔍 Analisando mensagens para determinar ações...`);
        const { messagesToReact, messageToQuote } = await analyzeMessagesForActions(
          messagesToProcess,
          agent.systemPrompt,
          ollamaApiKey,
          llmModel
        );
        
        // NOVA FUNCIONALIDADE: Enviar reações para mensagens que apoiam a causa
        if (messagesToReact.length > 0) {
          console.log(`[Militant Agent] ❤️ Enviando ${messagesToReact.length} reações...`);
          for (const { messageId, emoji } of messagesToReact) {
            try {
              await wahaSendReaction(wahaConfig, { messageId, reaction: emoji });
              console.log(`[Militant Agent] ✅ Reação ${emoji} enviada para mensagem ${messageId.substring(0, 20)}...`);
            } catch (error) {
              console.warn(`[Militant Agent] ⚠️ Erro ao enviar reação:`, error);
            }
          }
        }
        
        // ========== CONSTRUIR CONTEXTO ENRIQUECIDO COM MEMÓRIA E HISTÓRICO COMPLETO ==========
        let messageContext = '';
        
        // Adicionar informações da memória do grupo ao contexto
        if (groupMemory) {
          messageContext += '=== CONTEXTO DO GRUPO ===\n';
          messageContext += `📱 Grupo: ${groupMemory.groupName || queue.groupName || queue.groupId}\n`;
          
          if (groupMemory.totalInteractions > 0) {
            messageContext += `🔄 Total de interações anteriores: ${groupMemory.totalInteractions}\n`;
          }
          
          if (groupMemory.topics) {
            const topics = JSON.parse(groupMemory.topics);
            if (topics.length > 0) {
              messageContext += `📌 Tópicos já discutidos: ${topics.join(', ')}\n`;
            }
          }
          
          if (groupMemory.politicalLeaning) {
            const leaningEmoji = groupMemory.politicalLeaning === 'favoravel' ? '👍' : 
                               groupMemory.politicalLeaning === 'contrario' ? '👎' : '🤷';
            messageContext += `${leaningEmoji} Inclinação política: ${groupMemory.politicalLeaning}\n`;
          }
          
          if (groupMemory.groupSentiment) {
            const sentimentEmoji = groupMemory.groupSentiment === 'positivo' ? '😊' : 
                                 groupMemory.groupSentiment === 'negativo' ? '😔' : '😐';
            messageContext += `${sentimentEmoji} Sentimento geral: ${groupMemory.groupSentiment}\n`;
          }
          
          if (groupMemory.contextSummary) {
            messageContext += `\n📋 Contexto anterior:\n${groupMemory.contextSummary}\n`;
          }
          
          messageContext += '\n';
        }
        
        // ========== ADICIONAR HISTÓRICO COMPLETO DE MENSAGENS (incluindo próprias) ==========
        // LÓGICA: Incluir as próprias mensagens no contexto para manter continuidade
        messageContext += '=== HISTÓRICO DE MENSAGENS RECENTES (Contexto Completo) ===\n';
        
        // Combinar mensagens históricas ordenadas por timestamp
        const allMessagesForContext = [...historicalMessages]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-30); // Últimas 30 mensagens para contexto
        
        if (allMessagesForContext.length > 0) {
          messageContext += allMessagesForContext
            .map((msg: any) => {
              const author = msg.fromMe ? 'VOCÊ (Agente)' : (msg.pushName || msg.fromName || msg.from || "Usuário");
              return `${author}: ${msg.body || msg.message || ""}`;
            })
            .join("\n");
          messageContext += '\n\n';
        }
        
        // Adicionar mensagens atuais da fila (destacando mensagens novas)
        messageContext += '=== MENSAGENS NOVAS PARA PROCESSAR ===\n';
        messageContext += messagesToProcess
          .map((msg: any) => `${msg.pushName || msg.fromName || msg.from || "Usuário"}: ${msg.body || msg.message || ""}`)
          .join("\n");
        
        console.log(`[Militant Agent] 🎯 Contexto enriquecido com histórico completo (${allMessagesForContext.length} mensagens históricas + ${messagesToProcess.length} novas)`);
        
        // Se vai citar uma mensagem, adicionar instrução adicional ao prompt
        let enhancedPrompt = agent.systemPrompt;
        if (messageToQuote) {
          // Encontrar qual mensagem será citada (buscar em messagesToProcess, não em messages)
          const quotedMessage = messagesToProcess.find((msg: any) => msg.id === messageToQuote);
          if (quotedMessage) {
            const quotedText = quotedMessage.body || quotedMessage.message || "";
            console.log(`[Militant Agent] 📌 Citando mensagem: "${quotedText.substring(0, 100)}..."`);
            
            // Verificar se a mensagem demonstra dúvida sobre voto
            const isDoubtAboutVoting = /(?:não sei|dúvida|indecis|quem.*votar|ainda.*pens|não.*decid)/i.test(quotedText);
            
            if (isDoubtAboutVoting) {
              enhancedPrompt = agent.systemPrompt + `\n\nINSTRUÇÃO URGENTE: A pessoa citada está COM DÚVIDA sobre em quem votar! Esta é uma OPORTUNIDADE CRÍTICA. Você DEVE:
- Responder de forma ENTUSIASMADA e CONFIANTE
- Incentivar FORTEMENTE o voto no candidato
- Destacar os PRINCIPAIS benefícios e qualidades do candidato
- Ser PERSUASIVO mas natural e amigável
- Demonstrar SEGURANÇA na sua escolha
Lembre-se: esta pessoa está indecisa - sua resposta pode fazer diferença!`;
              console.log(`[Militant Agent] 🎯 DÚVIDA SOBRE VOTO DETECTADA - usando prompt enfático`);
            }
          }
        }
        
        const response = await generateResponse(
          enhancedPrompt,
          messageContext,
          ollamaApiKey,
          llmModel
        );
        
        if (!response) {
          console.log(`[Militant Agent] ⚠️ Não foi possível gerar resposta para grupo ${queue.groupName || queue.groupId}`);
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `⚠️ Falha ao gerar resposta para ${queue.groupName || queue.groupId}`
          );
          await storage.failMilitantQueue(queue.id, "Falha ao gerar resposta com LLM");
          continue;
        }
        
        const finalMessage = response.trim();
        
        console.log(`[Militant Agent] 💬 Resposta gerada: "${finalMessage.substring(0, 100)}..." (${finalMessage.length} caracteres)`);
        console.log(`[Militant Agent] 📊 Mensagem ${finalMessage.length > 150 ? 'SERÁ DIVIDIDA' : 'NÃO PRECISA SER DIVIDIDA'} em chunks (limite: 150+ chars)`);
        
        // NOVA FUNCIONALIDADE: Enviar mensagem com citação se necessário
        const sent = await sendGroupMessage(
          queue.groupId,
          finalMessage,
          wahaConfig,
          messageToQuote || undefined
        );
        
        if (sent) {
          const updatedTimestamps = { ...lastMessageTimestamps };
          // Usar a última mensagem processada (de outros usuários) para timestamp
          const lastProcessedMessage = messagesToProcess[messagesToProcess.length - 1];
          updatedTimestamps[queue.groupId] = lastProcessedMessage?.timestamp?.toString() || now.toString();
          updatedTimestamps[queue.groupId + "_sent"] = now.toString();
          
          await storage.updateMilitantAgentLastRun(queue.agentId, updatedTimestamps);
          
          // ========== ATUALIZAR MEMÓRIA DO GRUPO - INCREMENTAR INTERAÇÕES ==========
          await storage.incrementMilitantGroupInteraction(queue.groupId);
          console.log(`[Militant Agent] 🧠 Memória do grupo atualizada - interação registrada`);
          
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `✅ Mensagem enviada para ${queue.groupName || queue.groupId}: "${finalMessage.substring(0, 100)}..."`
          );
          
          await storage.markMilitantQueueSucceeded(queue.id, finalMessage);
          
          console.log(`[Militant Agent] ✅ Fila ${queue.id} processada com sucesso`);
        } else {
          await storage.appendMilitantAgentLog(
            queue.agentId,
            `❌ Falha ao enviar mensagem para ${queue.groupName || queue.groupId}`
          );
          await storage.failMilitantQueue(queue.id, "Falha ao enviar mensagem via WAHA");
        }
        
      } catch (error) {
        console.error(`[Militant Agent] ❌ Erro ao processar fila ${queue.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        await storage.failMilitantQueue(queue.id, errorMessage);
      }
    }
    
  } catch (error) {
    console.error("[Militant Agent] ❌ Erro ao buscar filas para processamento:", error);
  }
}

// DEPRECATED: Função antiga que usa messagesQueue (tabela deprecated)
// Usar processMilitantMessageQueues() ao invés desta função
// Esta função será removida em versões futuras
export async function runMilitantAgentWorkflow(
  agentId: string,
  agent: MilitantAgent
): Promise<void> {
  console.log(`[Militant Agent] 🤖 Iniciando workflow para agente: ${agent.name}`);

  // Validar que todas as credenciais WAHA estão configuradas
  const wahaUrl = agent.wahaUrl;
  const wahaApiKey = agent.wahaApiKey;
  const wahaSession = agent.wahaSession;
  const ollamaApiKey = process.env.OLLAMA_API_KEY_MILITANT;
  
  if (!ollamaApiKey) {
    await storage.appendMilitantAgentLog(
      agentId,
      "❌ OLLAMA_API_KEY_MILITANT não configurada"
    );
    return;
  }
  
  if (!wahaUrl || !wahaApiKey || !wahaSession) {
    await storage.appendMilitantAgentLog(
      agentId,
      "❌ Credenciais WAHA incompletas. Todos os campos são obrigatórios (URL, API Key e Session)"
    );
    console.error(`[Militant Agent] ❌ Credenciais WAHA incompletas para o agente ${agent.name}`);
    return;
  }

  const wahaConfig: WahaConfig = {
    url: wahaUrl,
    apiKey: wahaApiKey,
    session: wahaSession
  };
  
  console.log(`[Militant Agent] 🔑 Usando credenciais WAHA do agente ${agent.name}`);
  await storage.appendMilitantAgentLog(
    agentId,
    `🔑 Usando credenciais WAHA do agente`
  );
  
  // Log das credenciais para debug (sem expor os valores completos)
  console.log(`[Militant Agent] 📝 WAHA URL: ${wahaUrl}`);
  console.log(`[Militant Agent] 📝 Session: ${wahaSession}`);

  try {
    // Buscar configuração global para obter o modelo LLM
    const config = await storage.getCloneAgentConfig();
    const llmModel = config?.ollamaModel || "deepseek-v3.1:671b-cloud";
    console.log(`[Militant Agent] 🤖 Usando modelo LLM: ${llmModel}`);
    
    // Buscar mensagens não processadas da fila para este agente
    const unprocessedMessages = await storage.getUnprocessedMessages(agentId, 50);
    
    if (unprocessedMessages.length === 0) {
      console.log(`[Militant Agent] ℹ️ Nenhuma mensagem na fila para ${agent.name}`);
      return;
    }

    console.log(`[Militant Agent] 📬 ${unprocessedMessages.length} mensagens na fila para processar`);

    // Parsear timestamps do último envio
    const lastMessageTimestamps = JSON.parse(
      agent.lastMessageTimestamp || "{}"
    ) as Record<string, string>;

    // Agrupar mensagens por grupo
    const messagesByGroup = new Map<string, typeof unprocessedMessages>();
    for (const message of unprocessedMessages) {
      const groupMessages = messagesByGroup.get(message.groupId) || [];
      groupMessages.push(message);
      messagesByGroup.set(message.groupId, groupMessages);
    }

    console.log(`[Militant Agent] 👥 Mensagens agrupadas em ${messagesByGroup.size} grupos`);

    const updatedTimestamps: Record<string, string> = { ...lastMessageTimestamps };

    // Processar cada grupo
    for (const [groupId, messages] of Array.from(messagesByGroup)) {
      const groupName = messages[0].groupName || "Grupo";
      console.log(`[Militant Agent] 📱 Processando grupo: ${groupName} (${groupId})`);

      // Ordenar mensagens por timestamp
      messages.sort((a: MessagesQueue, b: MessagesQueue) => a.timestamp - b.timestamp);

      // Rate limiting - verificar se passou o tempo de fluxo configurado desde última mensagem enviada
      const now = Date.now();
      const lastRunForGroup = parseInt(lastMessageTimestamps[groupId + "_sent"] || "0");
      const timeSinceLastMessage = now - lastRunForGroup;
      const flowMinutesMs = (agent.flowMinutes || 10) * 60 * 1000; // Converter minutos para milissegundos
      
      if (timeSinceLastMessage < flowMinutesMs) {
        const waitTime = Math.ceil((flowMinutesMs - timeSinceLastMessage) / 1000);
        const waitTimeMinutes = Math.ceil(waitTime / 60);
        console.log(`[Militant Agent] ⏱️ Rate limiting: aguardando ${waitTimeMinutes} minuto(s) para grupo ${groupName}`);
        await storage.appendMilitantAgentLog(
          agentId,
          `⏱️ Rate limiting: aguardando ${waitTimeMinutes} minuto(s) para ${groupName}`
        );
        // Não marcar como processadas, deixar para próxima execução
        continue;
      }

      // Pegar últimas 5 mensagens para contexto
      const contextMessages = messages.slice(-5);
      const messageContext = contextMessages
        .map((msg: MessagesQueue) => `${msg.fromName || "Usuário"}: ${msg.message}`)
        .join("\n");

      console.log(`[Militant Agent] 🎯 Contexto das mensagens:\n${messageContext}`);

      // Gerar resposta usando o modelo LLM configurado
      const response = await generateResponse(
        agent.systemPrompt,
        messageContext,
        ollamaApiKey,
        llmModel
      );

      if (!response) {
        console.log(`[Militant Agent] ⚠️ Não foi possível gerar resposta para grupo ${groupName}`);
        // Marcar mensagens como processadas mesmo sem resposta (para evitar loop)
        for (const msg of messages) {
          await storage.markMessageAsProcessed(msg.id);
        }
        continue;
      }

      const finalMessage = response.trim();

      console.log(`[Militant Agent] 💬 Resposta gerada: "${finalMessage.substring(0, 100)}..."`);

      // Enviar resposta usando WAHA
      const sent = await sendGroupMessage(
        groupId,
        finalMessage,
        wahaConfig
      );

      if (sent) {
        // Atualizar timestamp da última mensagem enviada
        const lastMessage = messages[messages.length - 1];
        updatedTimestamps[groupId] = lastMessage.timestamp.toString();
        updatedTimestamps[groupId + "_sent"] = now.toString();

        await storage.appendMilitantAgentLog(
          agentId,
          `✅ Mensagem enviada para ${groupName}: "${finalMessage.substring(0, 100)}..."`
        );

        // Marcar todas as mensagens do grupo como processadas
        console.log(`[Militant Agent] 📝 Marcando ${messages.length} mensagens como processadas`);
        for (const msg of messages) {
          await storage.markMessageAsProcessed(msg.id);
        }
      } else {
        await storage.appendMilitantAgentLog(
          agentId,
          `❌ Falha ao enviar mensagem para ${groupName}`
        );
        // Não marcar como processadas para tentar novamente
      }
    }

    // Atualizar agente com novos timestamps
    if (Object.keys(updatedTimestamps).length > 0) {
      await storage.updateMilitantAgentLastRun(agentId, updatedTimestamps);
    }

    console.log(`[Militant Agent] ✅ Workflow concluído para agente: ${agent.name}`);
  } catch (error) {
    console.error("[Militant Agent] ❌ Erro no workflow:", error);
    await storage.appendMilitantAgentLog(
      agentId,
      `❌ Erro no workflow: ${error instanceof Error ? error.message : "Erro desconhecido"}`
    );
  }
}

// Função para executar todos os agentes ativos
export async function runAllMilitantAgents(): Promise<void> {
  try {
    const agents = await storage.getMilitantAgents();
    const activeAgents = agents.filter((agent) => agent.isActive);

    if (activeAgents.length === 0) {
      return;
    }

    console.log(`[Militant Agent] 🚀 Executando ${activeAgents.length} agentes ativos`);

    // Executar agentes em paralelo
    const promises = activeAgents.map((agent) =>
      runMilitantAgentWorkflow(agent.id, agent)
    );

    await Promise.all(promises);

    console.log("[Militant Agent] ✅ Todos os agentes foram executados");
  } catch (error) {
    console.error("[Militant Agent] ❌ Erro ao executar agentes:", error);
  }
}