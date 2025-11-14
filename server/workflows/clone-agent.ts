import { storage } from "../storage";
import { OllamaQueue } from "../lib/ollama-queue";
import { transcribeAudio, describeImage } from "../lib/openai-media";
import { processDocument } from "../lib/document-processor";
import { analyzeVoteIntent } from "../lib/vote-intent-detector";
import type { VoterMemory } from "@shared/schema";
import { 
  formatDateBrazil, 
  isWithinWorkingHours, 
  getNextValidProcessTime,
  toSaoPauloTime,
  isTimeInRange
} from "../lib/timezone";
// Imports removidos (não mais necessários com envio via Scheduled Worker apenas):
// - wahaSendText, wahaStartTyping, wahaStopTyping, calculateTypingDuration, phoneToChatId
// - createHash (usado para generateMessageHash)
// - splitMessageBySentences, sleep, getChunkDelay (usados em sendResponseInChunks)

/**
 * Detecta se a mensagem é uma pergunta genérica sobre documentos
 * (sem especificar a finalidade/situação específica)
 * Retorna true se detectar pergunta genérica sobre documentos
 * 
 * IMPORTANTE: Só detecta quando há INTENÇÃO INTERROGATIVA + palavra "documento"
 * Não intercepta afirmações como "enviei o documento" ou "perdi meu documento"
 */
function isGenericDocumentQuestion(message: string): boolean {
  const normalizedMessage = message.toLowerCase().trim();
  
  // PRÉ-REQUISITO: Verificar se é uma PERGUNTA (tem ?)
  const hasQuestionMark = normalizedMessage.includes('?');
  
  // Se NÃO tem ?, NÃO é pergunta, retorna false imediatamente
  if (!hasQuestionMark) {
    return false;
  }
  
  // PASSO 1: Verificar se é uma pergunta GENÉRICA sobre IDENTIDADE/NECESSIDADE de documentos
  // Usa regex específicos que detectam a ESTRUTURA da pergunta, não apenas palavras soltas
  // 
  // GENÉRICO: "qual documento eu levo?" "que documento preciso?" "preciso apresentar algum documento?"
  // NÃO-GENÉRICO: "por que o documento atrasou?" "o que aconteceu com o documento?"
  
  const genericDocumentPatterns = [
    // Padrões "qual/quais documento(s)" - sempre genérico se tem ?
    /\b(qual|quais)\s+(.{0,20})?\s*documento(s)?\b/i,
    
    // Padrões "que documento(s)" seguido de verbo de NECESSIDADE/IDENTIDADE
    // NÃO aceita "por que" (pergunta sobre motivo) nem "que bagunça" (exclamação)
    // Exemplos: "que documento preciso?" "que documento eu levo?"
    /\bque\s+documento(s)?\s+(.{0,15})?\s*(preciso|levo|necessito|devo|tenho\s+que|é|são|seria|seria|usar|apresentar|levar|entregar)/i,
    
    // Padrões de NECESSIDADE: "preciso/levo/necessito/devo/tenho que... (verbo ação)? ... documento"
    // Permite verbos de ação no meio: "preciso apresentar algum documento?"
    // Permite palavras no meio: "algum tipo de documento", "um documento específico"
    /\b(preciso|levo|necessito|devo|tenho\s+que)\s+(de\s+)?(apresentar|levar|entregar|ter|trazer)?\s*(.{0,25})?\s*documento(s)?\b/i,
    
    // Padrões "documento(s) que/para... preciso/apresentar" (ordem invertida)
    // Só com ? para evitar "documentos que preciso entregar já estão separados"
    /\bdocumento(s)?\s+(que|para)\s+(.{0,20})?\s*(preciso|levo|apresentar|entregar|levar|necessário)\b/i,
    
    // Padrões com determinantes: "algum/há/tem... documento(s)" (sempre genérico se tem ?)
    // Exemplos: "algum documento é necessário?" "tem documento pra levar?" "há documentos obrigatórios?"
    /\b(algum|há|tem)\s+(.{0,15})?\s*documento(s)?\b/i
  ];
  
  const hasGenericPattern = genericDocumentPatterns.some(pattern => 
    pattern.test(normalizedMessage)
  );
  
  // Se NÃO corresponde a padrão genérico, NÃO é pergunta genérica
  if (!hasGenericPattern) {
    return false;
  }
  
  // PASSO 2: Verificar se menciona "documento" ou "documentos"
  if (!normalizedMessage.includes('documento')) {
    return false; // Não menciona documento, não é pergunta sobre documento
  }
  
  // PASSO 3: Palavras que indicam finalidade específica (se presentes, NÃO é genérico)
  const specificPurposeKeywords = [
    'aposentadoria',
    'aposentar',
    'pensão',
    'pensao',
    'auxílio',
    'auxilio',
    'doença',
    'doenca',
    'votação',
    'votacao',
    'votar',
    'eleição',
    'eleicao',
    'casamento',
    'nascimento',
    'óbito',
    'obito',
    'morte',
    'salário',
    'salario',
    'maternidade',
    'benefício',
    'beneficio',
    'inss',
    'previdência',
    'previdencia'
  ];
  
  // Se a mensagem contém alguma finalidade específica, NÃO é genérica
  const hasSpecificPurpose = specificPurposeKeywords.some(keyword => 
    normalizedMessage.includes(keyword)
  );
  
  if (hasSpecificPurpose) {
    return false; // Tem finalidade específica, não é genérico
  }
  
  // PASSO 4: Se chegou até aqui, é uma pergunta genérica sobre documentos!
  // Passou por: tem intenção interrogativa + menciona documento + NÃO tem finalidade específica
  // Isso É suficiente para caracterizar como pergunta genérica
  return true;
}

// REMOVED: detectVotingIntention function that was causing incorrect vote detection
// This function only checked for positive patterns and ignored rejections,
// causing messages like "não vou votar em você" to be marked as confirmed.
// The correct vote detection is now handled by analyzeVoteIntent from vote-intent-detector.ts

/**
 * Detecta se a mensagem contém apenas emojis (sem texto)
 * Retorna true se a mensagem tem apenas emojis e espaços em branco
 */
function isOnlyEmojis(message: string): boolean {
  // Remover espaços em branco
  const trimmed = message.trim();
  
  // Se vazio, não é apenas emoji
  if (trimmed.length === 0) {
    return false;
  }
  
  // Verificar se tem pelo menos um emoji usando a propriedade Emoji Unicode
  const hasEmoji = /\p{Emoji}/u.test(trimmed);
  
  // Se não tem emoji, não pode ser "apenas emojis"
  if (!hasEmoji) {
    return false;
  }
  
  // Remover todos os emojis, componentes, modificadores, variação seletores e ZWJ
  // \p{Emoji} - Todos os emojis
  // \uFE0F - Seletor de variação (emoji style)
  // \u200D - Zero Width Joiner (usado em sequências complexas como família)
  const withoutEmojis = trimmed.replace(/\p{Emoji}|\uFE0F|\u200D/gu, '');
  
  // Remover espaços em branco restantes
  const textOnly = withoutEmojis.replace(/\s+/g, '');
  
  // Retorna true se não sobrou nenhum texto após remover emojis e espaços
  return textOnly.length === 0;
}

/**
 * Detecta se a mensagem indica encerramento de conversa
 * Retorna true se a mensagem é apenas um agradecimento ou confirmação simples de encerramento
 */
function isConversationClosing(message: string): boolean {
  // Normalizar mensagem para lowercase e remover espaços extras
  const normalizedMessage = message.toLowerCase().trim();
  
  // IMPORTANTE: Se a mensagem tem ponto de interrogação, é uma PERGUNTA, não um encerramento
  // Exemplos: "falou?", "beleza?", "ok?" são perguntas, não encerramentos
  if (normalizedMessage.includes('?')) {
    return false;
  }
  
  // Remover pontuação para comparação mais flexível (exceto ? que já verificamos)
  const cleanMessage = normalizedMessage.replace(/[.,!;:]/g, '').trim();
  
  // Padrões exatos de encerramento (mensagens curtas e diretas)
  const exactClosingPhrases = [
    'entendi',
    'entendi obrigado',
    'entendi obrigada',
    'obrigado',
    'obrigada',
    'ok',
    'ok obrigado',
    'ok obrigada',
    'tá certo',
    'ta certo',
    'beleza',
    'beleza valeu',
    'valeu',
    'combinado',
    'era só isso',
    'era so isso',
    'está bem',
    'esta bem',
    'está bem obrigado',
    'esta bem obrigado',
    'está bem obrigada',
    'esta bem obrigada',
    'tá bom',
    'ta bom',
    'tá bom obrigado',
    'ta bom obrigado',
    'tá bom obrigada',
    'ta bom obrigada',
    'agradeço',
    'agradeço pela ajuda',
    'agradeco',
    'agradeco pela ajuda',
    'ok até mais',
    'ok ate mais',
    'perfeito',
    'perfeito obrigado',
    'perfeito obrigada',
    'certo',
    'certo obrigado',
    'certo obrigada',
    'show',
    'show obrigado',
    'show obrigada',
    'tranquilo',
    'tranquilo obrigado',
    'tranquilo obrigada',
    'vlw',
    'vlw obrigado',
    'vlw obrigada',
    'blz',
    'blz obrigado',
    'blz obrigada',
    'de boa',
    'de boa obrigado',
    'de boa obrigada',
    'até mais',
    'ate mais',
    'abraço',
    'abraços',
    'abracos',
    'até logo',
    'ate logo',
    'tchau',
    'falou',
    'falou obrigado',
    'falou obrigada'
  ];
  
  // Verificar se a mensagem é exatamente uma das frases de encerramento
  if (exactClosingPhrases.includes(cleanMessage)) {
    console.log('[Clone Agent] 🚫 Mensagem de encerramento detectada:', message);
    return true;
  }
  
  // Padrões compostos (permitir pequenas variações)
  const composedClosingPatterns = [
    /^(ok|okay|beleza|valeu|vlw|blz)\s+(obrigad[oa]|valeu|vlw)$/,
    /^(entendi|entendido)\s+(obrigad[oa]|valeu|vlw)$/,
    /^(perfeito|show|tranquilo|certo)\s+(obrigad[oa]|valeu|vlw)$/,
    /^(t[aá]|est[aá])\s+(certo|bom|bem)\s*(obrigad[oa])?$/,
    /^era\s+(s[oó]|apenas)\s+(isso|isto)$/,
    /^(muito\s+)?obrigad[oa]\s+(pela\s+)?(ajuda|aten[çc][ãa]o|informa[çc][ãa]o)$/,
    /^agradesso\s+(pela\s+)?(ajuda|aten[çc][ãa]o|informa[çc][ãa]o)$/,
    /^at[eé]\s+(mais|logo|breve)$/,
    /^(ok|beleza|certo|show)\s+at[eé]\s+(mais|logo)$/
  ];
  
  for (const pattern of composedClosingPatterns) {
    if (pattern.test(cleanMessage)) {
      console.log('[Clone Agent] 🚫 Mensagem de encerramento detectada:', message);
      return true;
    }
  }
  
  return false;
}

interface WhatsAppMessage {
  phone: string;
  fromMe: boolean;
  isGroup: boolean;
  text?: {
    message: string;
  };
  image?: {
    url?: string;
    caption?: string;
  };
  audio?: {
    url?: string;
    caption?: string;
  };
  document?: {
    url?: string;
    filename?: string;
  };
  messageId: string;
  instanceId: string;
  senderName?: string;
}

/**
 * Extrai informações importantes de uma mensagem do eleitor
 */
function extractImportantInfo(message: string): {
  problems?: string[];
  needs?: string[];
  topics?: string[];
  profession?: string;
  personalInfo?: Record<string, any>;
} {
  const info: any = {};
  
  // Detectar menção a problemas
  const problemKeywords = [
    'problema', 'dificuldade', 'preciso de', 'falta', 'não tem', 
    'está ruim', 'péssimo', 'terrível', 'complicado', 'difícil'
  ];
  
  // Detectar necessidades
  const needKeywords = [
    'preciso', 'necessito', 'quero', 'gostaria', 'seria bom',
    'poderia', 'deveria ter', 'falta'
  ];
  
  // Detectar profissões
  const professionKeywords = [
    'trabalho como', 'sou', 'atuo como', 'profissão', 'emprego',
    'faço', 'minha área', 'formado em'
  ];

  const lowerMessage = message.toLowerCase();
  
  // Extrair problemas mencionados
  const problems: string[] = [];
  for (const keyword of problemKeywords) {
    if (lowerMessage.includes(keyword)) {
      // Extrai a frase ao redor do keyword
      const sentences = message.split(/[.!?]/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          problems.push(sentence.trim());
          break;
        }
      }
    }
  }
  if (problems.length > 0) info.problems = problems;
  
  // Extrair necessidades
  const needs: string[] = [];
  for (const keyword of needKeywords) {
    if (lowerMessage.includes(keyword)) {
      const sentences = message.split(/[.!?]/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword) && !problems.includes(sentence.trim())) {
          needs.push(sentence.trim());
          break;
        }
      }
    }
  }
  if (needs.length > 0) info.needs = needs;
  
  // Extrair profissão
  for (const keyword of professionKeywords) {
    if (lowerMessage.includes(keyword)) {
      const sentences = message.split(/[.!?]/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          info.profession = sentence.trim();
          break;
        }
      }
    }
  }
  
  // Extrair tópicos gerais (palavras-chave importantes)
  const importantTopics = [
    'saúde', 'educação', 'segurança', 'transporte', 'emprego',
    'moradia', 'saneamento', 'cultura', 'esporte', 'lazer',
    'família', 'filhos', 'escola', 'hospital', 'rua', 'bairro'
  ];
  
  const topics: string[] = [];
  for (const topic of importantTopics) {
    if (lowerMessage.includes(topic)) {
      topics.push(topic);
    }
  }
  if (topics.length > 0) info.topics = Array.from(new Set(topics)); // Remove duplicatas
  
  return info;
}

/**
 * Extrai o primeiro nome de um nome completo
 */
function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

/**
 * Formata o contexto enriquecido com memória persistente para o Ollama
 */
async function buildEnrichedContext(
  phoneNumber: string,
  currentMessages: string | string[],
  conversationHistory: Array<{role: string, content: string}>,
  voterMemory?: VoterMemory
): Promise<string> {
  let context = '';
  
  // Adicionar informações da memória persistente se existir
  if (voterMemory) {
    context += '=== INFORMAÇÕES DO ELEITOR ===\n';
    
    // NOME REMOVIDO: Não incluir o nome do eleitor no contexto para evitar uso acidental
    
    if (voterMemory.profession) {
      context += `💼 Profissão: ${voterMemory.profession}\n`;
    }
    
    if (voterMemory.totalInteractions > 0) {
      context += `🔄 Total de interações: ${voterMemory.totalInteractions}\n`;
      
      if (voterMemory.firstInteraction) {
        const firstDate = new Date(voterMemory.firstInteraction);
        context += `📅 Primeira conversa: ${formatDateBrazil(firstDate)}\n`;
      }
      
      if (voterMemory.lastInteraction) {
        const lastDate = new Date(voterMemory.lastInteraction);
        const daysSinceLastInteraction = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        context += `📅 Última conversa: ${formatDateBrazil(lastDate)} (há ${daysSinceLastInteraction} dias)\n`;
        
        if (daysSinceLastInteraction > 0) {
          context += `⚠️  Nota: O eleitor voltou a conversar após ${daysSinceLastInteraction} dia(s). Seja acolhedor!\n`;
        }
      }
    }
    
    // Problemas mencionados
    if (voterMemory.problems) {
      const problems = JSON.parse(voterMemory.problems);
      if (problems.length > 0) {
        context += `\n🚨 Problemas mencionados anteriormente:\n`;
        problems.forEach((problem: string, index: number) => {
          context += `  ${index + 1}. ${problem}\n`;
        });
      }
    }
    
    // Necessidades identificadas
    if (voterMemory.needs) {
      const needs = JSON.parse(voterMemory.needs);
      if (needs.length > 0) {
        context += `\n🎯 Necessidades identificadas:\n`;
        needs.forEach((need: string, index: number) => {
          context += `  ${index + 1}. ${need}\n`;
        });
      }
    }
    
    // Tópicos discutidos
    if (voterMemory.topics) {
      const topics = JSON.parse(voterMemory.topics);
      if (topics.length > 0) {
        context += `\n💬 Assuntos já discutidos: ${topics.join(', ')}\n`;
      }
    }
    
    // Resumo de contexto
    if (voterMemory.contextSummary) {
      context += `\n📋 Resumo do contexto anterior:\n${voterMemory.contextSummary}\n`;
    }
    
    // Sentimento
    if (voterMemory.sentiment) {
      const sentimentEmoji = voterMemory.sentiment === 'positivo' ? '😊' : 
                           voterMemory.sentiment === 'negativo' ? '😔' : '😐';
      context += `\n${sentimentEmoji} Sentimento geral: ${voterMemory.sentiment}\n`;
    }
    
    context += '\n================================\n\n';
  }
  
  // Adicionar histórico de conversas com timestamps
  if (conversationHistory.length > 0) {
    context += '=== HISTÓRICO DE CONVERSAS ===\n';
    
    let lastMessageTime: Date | null = null;
    
    conversationHistory.forEach((msg, index) => {
      // Adicionar indicador de tempo se houver grande gap (simulado para agora)
      const isSystemMessage = msg.role === 'system';
      
      if (isSystemMessage) {
        // Mensagem do sistema indicando gap temporal
        context += `\n${msg.content}\n\n`;
      } else {
        const role = msg.role === 'user' ? 'Eleitor' : 'Assistente';
        context += `${role}: ${msg.content}\n`;
      }
    });
    
    context += '\n================================\n\n';
  }
  
  // Adicionar mensagem(ns) atual(is)
  const messages = Array.isArray(currentMessages) ? currentMessages : [currentMessages];
  
  if (messages.length === 1) {
    context += '=== MENSAGEM ATUAL ===\n';
    context += `Eleitor: ${messages[0]}\n`;
  } else {
    context += `=== ${messages.length} MENSAGENS SEQUENCIAIS DO ELEITOR ===\n`;
    context += `⚠️  O eleitor enviou ${messages.length} mensagens seguidas. Você DEVE responder a TODAS elas.\n\n`;
    messages.forEach((msg, index) => {
      context += `📩 Mensagem ${index + 1}/${messages.length}:\n`;
      context += `Eleitor: ${msg}\n\n`;
    });
  }
  
  return context;
}

/**
 * Coleta mensagem do WhatsApp e adiciona à fila para processamento posterior
 * NÃO processa ou gera resposta - apenas armazena para o worker processar
 */
export async function processWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  if (message.isGroup || message.fromMe) {
    return;
  }

  try {
    let messageContent: string | null = null;
    let messageType = 'text';
    
    if (message.document?.url) {
      messageType = 'document';
      try {
        const theme = await processDocument(
          message.document.url,
          message.document.filename,
          undefined
        );
        messageContent = (theme === '[DOCUMENTO_NAO_PROCESSAVEL]') ? '[DOCUMENTO_NAO_PROCESSAVEL]' : theme;
      } catch (error) {
        console.error('[Clone Agent] Erro ao processar documento:', error);
        messageContent = '[DOCUMENTO_NAO_PROCESSAVEL]';
      }
    } else if (message.audio?.url) {
      messageType = 'audio';
      try {
        const transcription = await transcribeAudio(message.audio.url);
        // IMPORTANTE: Não adicionar prefixo ao áudio transcrito para não confundir o modelo
        messageContent = transcription;
        console.log('[Clone Agent] 🎤 Áudio transcrito com sucesso:', transcription);
      } catch (error) {
        console.error('[Clone Agent] Erro ao transcrever áudio:', error);
        messageContent = 'Não consegui ouvir o áudio direito, pode escrever por favor?';
      }
    } else if (message.image?.url) {
      messageType = 'image';
      try {
        const description = await describeImage(message.image.url);
        // Para imagens mantemos o prefixo pois é uma descrição
        messageContent = `[Imagem descrita]: ${description}`;
        if (message.image.caption) {
          messageContent += ` | Legenda: ${message.image.caption}`;
        }
      } catch (error) {
        console.error('[Clone Agent] Erro ao descrever imagem:', error);
        messageContent = '[Imagem recebida - não foi possível descrever]';
      }
    } else if (message.text?.message) {
      messageContent = message.text.message;
    } else {
      return;
    }

    // Verificar se a mensagem contém apenas emojis
    // Se for, não processar (não adicionar à fila e não gerar resposta)
    if (messageType === 'text' && messageContent && isOnlyEmojis(messageContent)) {
      console.log('[Clone Agent] 🚫 Mensagem com apenas emojis detectada, não será processada');
      return;
    }

    // Verificar se a mensagem é de encerramento de conversa
    // Se for, não processar (não adicionar à fila e não gerar resposta)
    if (messageType === 'text' && messageContent && isConversationClosing(messageContent)) {
      console.log('[Clone Agent] 🚫 Mensagem de encerramento detectada, não será processada');
      return;
    }

    const config = await storage.getCloneAgentConfig();
    if (!config) {
      return;
    }

    const allInstances = await storage.getCloneAgentInstances();
    const activeInstances = allInstances.filter(instance => instance.isActive);
    if (activeInstances.length === 0) {
      return;
    }

    const matchingInstance = activeInstances.find(
      instance => instance.wahaSession === message.instanceId
    );
    if (!matchingInstance) {
      return;
    }

    try {
      const existingVoter = await storage.getVoterByWhatsapp(message.phone);
      
      if (!existingVoter) {
        await storage.createVoter({
          nome: message.senderName || 'Desconhecido',
          whatsapp: message.phone,
          voto: 'em_progresso',
          material: 'sem_material',
          municipio: '',
          bairro: '',
          indicacao: 'Agente clone',
          nameSource: 'webhook-pushName'
        });
      }
    } catch (voterError: any) {
      console.error('[Clone Agent] Erro ao verificar/cadastrar eleitor:', voterError.message);
    }

    const queue = await storage.getOrCreateActiveQueue(
      matchingInstance.id,
      message.phone,
      config.messageCollectionTime
    );

    const collectedMessage = {
      content: messageContent,
      timestamp: new Date().toISOString(),
      senderName: message.senderName || 'Desconhecido',
      type: messageType
    };

    await storage.appendMessageToQueue(queue.id, JSON.stringify(collectedMessage));

  } catch (error: any) {
    console.error('[Clone Agent] Erro ao coletar mensagem:', error.message);
  }
}


/**
 * Processa filas de mensagens que já passaram do tempo de coleta
 * Executa busca semântica na base vetorial e gera respostas inteligentes
 * 
 * NOVO FLUXO COM LOCKING OTIMISTA:
 * 1. Busca apenas filas expiradas (collectionEndTime <= agora)
 * 2. Usa locking otimista para prevenir processamento simultâneo
 * 3. Processa apenas filas que conseguiu travar com sucesso
 */
export async function processMessageQueues(): Promise<void> {
  try {
    // 1. BUSCAR FILAS PRONTAS (collectionEndTime expirado)
    const readyQueues = await storage.getQueuesReadyForProcessing();
    
    if (readyQueues.length === 0) {
      return;
    }


    // 1.5. BUSCAR INSTÂNCIAS ATIVAS PARA VALIDAÇÃO DE AUTORIZAÇÃO
    const allInstances = await storage.getCloneAgentInstances();
    const activeInstanceIds = new Set(
      allInstances.filter(instance => instance.isActive).map(instance => instance.id)
    );
    
    if (activeInstanceIds.size > 0) {
    }

    // 2. PROCESSAR CADA FILA COM LOCKING OTIMISTA E VALIDAÇÃO DE INSTÂNCIA
    for (const queue of readyQueues) {
      
      // VERIFICAÇÃO DE AUTORIZAÇÃO: Apenas processar se a instância estiver ativa
      if (!activeInstanceIds.has(queue.instanceId)) {
        
        // Marcar fila como falha para não ficar presa eternamente
        await storage.failQueue(queue.id, 'Instância inativa ou inexistente - não autorizada a responder');
        continue;
      }
      
      
      // Gerar lockId único para este worker
      const lockId = `worker-${Date.now()}-${Math.random()}`;
      
      // 3. TENTAR TRAVAR A FILA (locking otimista)
      const claimed = await storage.claimQueueForProcessing(queue.id, lockId);
      
      if (!claimed) {
        continue;
      }
      
      
      // 4. PROCESSAR FILA (já travada, então não há risco de duplicação)
      try {
        await processQueuedMessages(queue);
      } catch (error) {
        console.error(`[Clone Agent Queue] ❌ Erro ao processar fila ${queue.phoneNumber}:`, error);
      }
    }
  } catch (error: any) {
    console.error('[Clone Agent Queue] ❌ Erro ao processar filas:', error.message);
    console.error('[Clone Agent Queue] Stack:', error.stack);
  }
}

/**
 * Detecta se já houve cumprimento anterior no histórico de conversa
 * Retorna true se o assistente já cumprimentou anteriormente
 */
function hasAssistantGreeting(conversationHistory: Array<{role: string, content: string}>): boolean {
  // Padrões de cumprimentos comuns no português brasileiro
  // Usa word boundary (\b) para evitar falsos positivos com palavras como "oitavo", "oitenta"
  const greetingPatterns = [
    /^(oi|olá|ola|opa|hey)\b[!\s.,?]*/i,
    /^e\s+(aí|ai)\b[!\s.,?]*/i,
    /^(bom\s+dia|boa\s+tarde|boa\s+noite)\b[!\s.,?]*/i,
    /^(tudo\s+bem|tudo\s+certo|como\s+vai|td\s+bem|td\s+certo)\b[?\s!.,]*/i,
    /^(salve|fala|coé)\b[!\s.,?]*/i,
    /^fala\s+aí\b[!\s.,?]*/i
  ];
  
  // Verificar mensagens do assistente no histórico
  for (const message of conversationHistory) {
    if (message.role === 'assistant') {
      const content = message.content.trim();
      
      // Verificar se a mensagem começa com um cumprimento
      for (const pattern of greetingPatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Remove cumprimentos do início da resposta (sanitizador fail-safe)
 * Retorna o texto sanitizado e um booleano indicando se houve remoção
 * Usa word boundary (\b) para evitar falsos positivos com palavras como "oitavo", "oitenta"
 */
function sanitizeGreeting(text: string): { sanitized: string; hadGreeting: boolean } {
  const greetingPatterns = [
    /^(oi|olá|ola|opa|hey)\b[!\s.,?]*/i,
    /^e\s+(aí|ai)\b[!\s.,?]*/i,
    /^(bom\s+dia|boa\s+tarde|boa\s+noite)\b[!\s.,?]*/i,
    /^(tudo\s+bem|tudo\s+certo|como\s+vai|td\s+bem|td\s+certo)\b[?\s!.,]*/i,
    /^(salve|fala|coé)\b[!\s.,?]*/i,
    /^fala\s+aí\b[!\s.,?]*/i
  ];
  
  let sanitized = text.trim();
  let hadGreeting = false;
  
  // Continuar removendo cumprimentos até não sobrar nenhum
  // Isso lida com casos como "Oi e aí..." que têm múltiplos cumprimentos
  let hasMoreGreetings = true;
  let maxIterations = 10; // Proteção contra loops infinitos
  let iterationCount = 0;
  
  while (hasMoreGreetings && iterationCount < maxIterations) {
    hasMoreGreetings = false;
    iterationCount++;
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '').trim();
        hadGreeting = true;
        hasMoreGreetings = true; // Continua procurando mais cumprimentos
        break; // Reinicia o loop para verificar desde o início
      }
    }
  }
  
  // PROTEÇÃO: Se após remover ficou completamente vazio, substituir por mensagem genérica
  // (o LLM gerou APENAS cumprimento sem conteúdo, o que viola a regra)
  // IMPORTANTE: Preservamos respostas curtas legítimas como "Sim.", "Claro.", etc.
  if (hadGreeting && sanitized.length === 0) {
    const fallbackMessages = [
      'Como posso ajudar?',
      'Em que posso ajudar?',
      'Pois não?',
      'Diga.',
      'Pode falar.'
    ];
    const fallback = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    console.log('[Clone Agent] ⚠️ Sanitizador: LLM gerou APENAS cumprimento (sem conteúdo), substituindo por mensagem genérica');
    console.log('[Clone Agent]    Original:', text.trim());
    console.log('[Clone Agent]    Substituído por:', fallback);
    return { sanitized: fallback, hadGreeting: true };
  }
  
  // Se removeu o cumprimento, capitalizar primeira letra da resposta restante
  // Suporta caracteres acentuados (á, é, í, etc.)
  if (hadGreeting && sanitized.length > 0) {
    // Encontrar primeiro caractere alfabético (incluindo acentuados)
    const firstLetterMatch = sanitized.match(/[a-záàâãéèêíìîóòôõúùûçñ]/i);
    if (firstLetterMatch && firstLetterMatch.index !== undefined) {
      const index = firstLetterMatch.index;
      sanitized = 
        sanitized.substring(0, index) + 
        sanitized.charAt(index).toUpperCase() + 
        sanitized.substring(index + 1);
    }
  }
  
  return { sanitized, hadGreeting };
}

/**
 * Processa uma fila específica de mensagens - VERSÃO SIMPLIFICADA
 * Extrai resposta pronta e envia ao eleitor
 */
async function processQueuedMessages(queue: any): Promise<void> {
  const MAX_RETRIES = 3;
  const processStartTime = Date.now();
  
  console.log(`[Clone Agent Queue] Processando ${queue.phoneNumber}`);
  
  try {
    // ========== VERIFICAÇÕES DE PRÉ-CONDIÇÕES ==========
    
    // Buscar config global
    const config = await storage.getCloneAgentConfig();
    if (!config) {
      const errorMsg = 'Config do Clone Agent não encontrada';
      console.error('[Clone Agent Queue] ❌', errorMsg);
      await storage.failQueue(queue.id, errorMsg);
      return;
    }

    // VERIFICAÇÃO DE AUTORIZAÇÃO: Buscar instância e validar se está ativa
    const instance = await storage.getCloneAgentInstance(queue.instanceId);
    if (!instance) {
      const errorMsg = `🚫 BLOQUEADO: Instância ${queue.instanceId} NÃO EXISTE - não autorizada a responder`;
      console.error('[Clone Agent Queue] ❌', errorMsg);
      await storage.failQueue(queue.id, errorMsg);
      return;
    }
    
    if (!instance.isActive) {
      const errorMsg = `🚫 BLOQUEADO: Instância ${queue.instanceId} (${instance.instanceName}) está INATIVA - não autorizada a responder`;
      console.error('[Clone Agent Queue] ❌', errorMsg);
      console.error('[Clone Agent Queue] ⚠️  IMPORTANTE: Apenas a instância que RECEBEU a mensagem pode responder');
      await storage.failQueue(queue.id, errorMsg);
      return;
    }
    

    // ========== EXTRAIR MENSAGENS COLETADAS ==========
    let collectedMessages: any[] = [];
    try {
      collectedMessages = JSON.parse(queue.messages);
      if (!Array.isArray(collectedMessages)) {
        collectedMessages = [collectedMessages];
      }
    } catch (error) {
      const errorMsg = 'Formato inválido de mensagens na fila';
      console.error('[Clone Agent Queue] ❌', errorMsg, error);
      await storage.failQueue(queue.id, errorMsg);
      return;
    }
    
    
    // Mostrar resumo das mensagens coletadas
    collectedMessages.forEach((msg, i) => {
      const preview = typeof msg === 'string' ? msg : msg.content;
      console.log(`[Clone Agent Queue]    ${i+1}. ${preview?.substring(0, 50)}...`);
    });

    // ========== EXTRAIR CONTEÚDO DAS MENSAGENS ==========
    // Extrair conteúdo individual de cada mensagem (para manter separado)
    const individualMessages = collectedMessages.map((msg: any) => {
      if (typeof msg === 'string') {
        return msg;
      }
      return msg.content || '';
    });
    
    // Texto consolidado para busca vetorial (junta tudo)
    const consolidatedText = individualMessages.join('\n\n');
    

    // ========== MEMÓRIA PERSISTENTE DO ELEITOR ==========
    let voterMemory = await storage.getVoterMemory(queue.phoneNumber);
    
    if (!voterMemory) {
      try {
        voterMemory = await storage.createVoterMemory({
          phoneNumber: queue.phoneNumber,
          fullName: null,
          firstInteraction: new Date(),
          lastInteraction: new Date(),
          totalInteractions: 1
        });
      } catch (createError: any) {
        if (createError.message?.includes('duplicate key') || createError.message?.includes('unique constraint')) {
          voterMemory = await storage.getVoterMemory(queue.phoneNumber);
          if (!voterMemory) {
            throw new Error('Não foi possível criar ou recuperar memória do eleitor');
          }
        } else {
          throw createError;
        }
      }
    } else {
      voterMemory = await storage.incrementVoterInteraction(queue.phoneNumber);
    }

    // ========== EXTRAÇÃO DE INFORMAÇÕES ==========
    const extractedInfo = extractImportantInfo(consolidatedText);
    
    if (extractedInfo.problems && extractedInfo.problems.length > 0) {
      await storage.appendToVoterMemory(queue.phoneNumber, 'problems', extractedInfo.problems);
    }
    if (extractedInfo.needs && extractedInfo.needs.length > 0) {
      await storage.appendToVoterMemory(queue.phoneNumber, 'needs', extractedInfo.needs);
    }
    if (extractedInfo.topics && extractedInfo.topics.length > 0) {
      await storage.appendToVoterMemory(queue.phoneNumber, 'topics', extractedInfo.topics);
    }
    if (extractedInfo.profession) {
      await storage.updateVoterMemory(queue.phoneNumber, { profession: extractedInfo.profession });
    }

    // ========== DETECÇÃO DE INTENÇÃO DE VOTO ==========
    // Analisar todas as mensagens para detectar declarações de apoio/rejeição
    const voteIntentResult = analyzeVoteIntent(consolidatedText);
    
    if (voteIntentResult.hasIntent) {
      console.log('[Clone Agent Queue] 🗳️ Intenção de voto detectada:', {
        isSupport: voteIntentResult.isSupport,
        confidence: voteIntentResult.confidence,
        reason: voteIntentResult.reason
      });
      
      // Atualizar voto apenas se for apoio com confiança alta ou média
      if (voteIntentResult.isSupport && 
          (voteIntentResult.confidence === 'high' || voteIntentResult.confidence === 'medium')) {
        try {
          // Usar apenas os dígitos do número de telefone (remover formatação)
          const cleanPhone = queue.phoneNumber.replace(/\D/g, '');
          const updatedVoter = await storage.updateVoterConfirmedVote(cleanPhone);
          
          if (updatedVoter) {
            console.log('[Clone Agent Queue] ✅ Voto do eleitor atualizado para CONFIRMADO:', cleanPhone);
          } else {
            console.log('[Clone Agent Queue] ⚠️ Eleitor não encontrado para atualizar voto:', cleanPhone);
          }
        } catch (voteError: any) {
          console.error('[Clone Agent Queue] Erro ao atualizar voto:', voteError.message);
        }
      } else if (!voteIntentResult.isSupport && voteIntentResult.hasIntent) {
        // Registrar rejeição no log (sem salvar na memória por enquanto)
        console.log('[Clone Agent Queue] 🚫 Rejeição detectada para eleitor:', queue.phoneNumber);
      }
    }

    // ========== VERIFICAR SE JÁ EXISTE RESPOSTA GERADA (evitar duplicação) ==========
    let responseText: string;
    let relevantKnowledge: Array<{ content: string; similarity: number }> = [];
    
    // Se já tem resposta gerada (por tentativa anterior), usar ela
    if (queue.generatedResponse) {
      responseText = queue.generatedResponse;
    } else {
    
    // ========== VERIFICAÇÃO: PERGUNTA GENÉRICA SOBRE DOCUMENTOS ==========
    if (isGenericDocumentQuestion(consolidatedText)) {
      console.log('[Clone Agent Queue] 💡 Retornando pergunta de clarificação diretamente');
      
      const clarificationResponses = [
        'Para qual situação você precisa do documento? Por exemplo: aposentadoria, votação ou outro serviço?',
        'Pra que você precisa? Aposentadoria, votar, ou outra situação?',
        'Qual o motivo? É para aposentadoria, pensão, auxílio doença ou outra coisa?'
      ];
      
      responseText = clarificationResponses[Math.floor(Math.random() * clarificationResponses.length)];
    } else {
      // ========== BUSCA SEMÂNTICA NA BASE DE CONHECIMENTO ==========
      console.log('[Clone Agent Queue] 🔎 Query de busca:', consolidatedText.substring(0, 200) + '...');
      
      try {
        relevantKnowledge = await storage.searchKnowledgeSemantic(
          config.id, 
          consolidatedText,
          5 // Limitar a 5 resultados mais relevantes
        );
        
        if (relevantKnowledge.length > 0) {
          relevantKnowledge.forEach((k, i) => {
            console.log(`   ${i+1}. Similaridade: ${(k.similarity * 100).toFixed(1)}% - ${k.content.substring(0, 100)}...`);
          });
        } else {
        }
      } catch (error) {
        console.error('[Clone Agent Queue] ⚠️ Erro ao buscar Base de Conhecimento:', error);
      }

      // ========== HISTÓRICO DE CONVERSAS ==========
      const conversation = await storage.getConversation(queue.instanceId, queue.phoneNumber);
      let conversationHistory: Array<{role: string, content: string}> = [];
      
      if (conversation) {
        conversationHistory = JSON.parse(conversation.messages);
        console.log('[Clone Agent Queue] 📜 Histórico encontrado:', conversationHistory.length, 'mensagens');
      }

      // ========== DETECÇÃO DE CUMPRIMENTO ANTERIOR ==========
      const alreadyGreeted = hasAssistantGreeting(conversationHistory);
      if (alreadyGreeted) {
        console.log('[Clone Agent Queue] 👋 Cumprimento anterior detectado - instruindo agente a não cumprimentar novamente');
      } else {
        console.log('[Clone Agent Queue] 👋 Primeira conversa - permitindo cumprimento');
      }

      // ========== CONTEXTO ENRIQUECIDO ==========
      const enrichedContext = await buildEnrichedContext(
        queue.phoneNumber,
        individualMessages,
        conversationHistory,
        voterMemory
      );

      // Montar contexto com conhecimento relevante
      const knowledgeContext = relevantKnowledge.length > 0
        ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 BASE DE CONHECIMENTO RELEVANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ATENÇÃO: Use as informações abaixo para responder de forma precisa e informada.
Priorize estas informações quando forem relevantes para a pergunta do eleitor.

${relevantKnowledge.map((k, i) => `📌 CONHECIMENTO ${i+1} (Relevância: ${(k.similarity * 100).toFixed(0)}%):\n${k.content}`).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        : '';
      
      if (knowledgeContext) {
      } else {
      }

      const nameUsageRule = `\n\n━━━ REGRA CRÍTICA: NUNCA USE O NOME DO ELEITOR ━━━
ATENÇÃO: Você NUNCA deve usar o nome do eleitor nas suas mensagens.
- Use saudações neutras como "Oi!", "Olá!", "Boa tarde!", "Tudo certo?" etc.
- Converse de forma natural e direta SEM mencionar o nome em nenhum momento.
- NUNCA inicie mensagens com o nome do eleitor (ex: "Oi, João!" ❌)
- Use apenas saudações genéricas (ex: "Oi! Tudo certo?" ✅)
- Mantenha a conversa calorosa e pessoal, mas sem usar nomes próprios.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      const greetingRule = alreadyGreeted
        ? `\n\n━━━ REGRA CRÍTICA: NÃO CUMPRIMENTE NOVAMENTE ━━━
🚨 ATENÇÃO: Você JÁ cumprimentou este eleitor anteriormente nesta conversa.

COMPORTAMENTO OBRIGATÓRIO:
❌ NÃO inicie sua resposta com cumprimentos como "Oi!", "Olá!", "Bom dia!", etc.
❌ NÃO use saudações no início da mensagem
✅ Vá DIRETO ao ponto respondendo à pergunta ou mensagem do eleitor
✅ Mantenha tom amigável e natural, mas SEM cumprimentar novamente

Exemplos CORRETOS (sem cumprimento):
- "Claro! Para isso você precisa..."
- "Sim, consigo te ajudar com isso..."
- "Os documentos necessários são..."

Exemplos ERRADOS (com cumprimento repetido):
- "Oi! Claro, para isso você precisa..." ❌
- "Olá! Sim, consigo te ajudar..." ❌
- "Boa tarde! Os documentos são..." ❌

Esta regra é ABSOLUTA: humanos não cumprimentam duas vezes na mesma conversa.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
        : `\n\n━━━ REGRA: CUMPRIMENTO INICIAL ━━━
Esta é a PRIMEIRA mensagem desta conversa.

COMPORTAMENTO ESPERADO:
✅ Inicie com um cumprimento CURTO e NATURAL (ex: "Oi!", "Oi! Tudo certo?")
✅ Use apenas UM cumprimento simples no início
✅ Após o cumprimento, responda diretamente à mensagem do eleitor

Exemplo CORRETO:
- "Oi! Claro, posso te ajudar com isso..."

Exemplo ERRADO (cumprimento muito longo):
- "Oi! Olá! Bom dia! Tudo bem? Como vai? Posso te ajudar..." ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      const documentQuestionRule = `\n\n━━━ REGRA CRÍTICA E OBRIGATÓRIA: PERGUNTAS SOBRE DOCUMENTOS ━━━
⚠️ ATENÇÃO MÁXIMA: Esta regra tem prioridade ABSOLUTA sobre qualquer conhecimento da base de dados!

Quando o eleitor perguntar sobre documentos de forma genérica (SEM especificar a finalidade NA PERGUNTA ATUAL), você DEVE SEMPRE e OBRIGATORIAMENTE pedir que ele especifique primeiro.

Perguntas genéricas sobre documentos (detecte qualquer variação):
- "Qual documento eu levo?"
- "Que documento eu preciso?"
- "Mas qual documento eu levo?"
- "E qual documento?"
- "Preciso de que documento?"
- "Quais os documentos necessários?"
- Qualquer pergunta sobre documento que NÃO mencione a finalidade específica

🚨 COMPORTAMENTO OBRIGATÓRIO:
1. Se a pergunta atual menciona "documento" mas NÃO menciona a finalidade (aposentadoria, votação, auxílio, pensão, etc.)
2. IGNORE toda a base de conhecimento
3. IGNORE o histórico da conversa
4. Responda APENAS com uma pergunta de clarificação curta e objetiva

Exemplos de respostas OBRIGATÓRIAS:
- "Para qual situação você precisa do documento? Por exemplo: aposentadoria, votação ou outro serviço?"
- "Pra que você precisa? Aposentadoria, votar, ou outra situação?"
- "Qual o motivo? Aposentadoria, pensão, auxílio doença?"

❌ PROIBIDO: Listar documentos para múltiplas situações diferentes (aposentadoria E auxílio E pensão)
❌ PROIBIDO: Assumir a finalidade baseado em conversa anterior
✅ OBRIGATÓRIO: Perguntar a finalidade específica quando a pergunta não a menciona

EXCEÇÃO: Se o eleitor JÁ especificou a finalidade NA PERGUNTA ATUAL (ex: "qual documento para aposentadoria?"), aí sim forneça a lista específica de documentos para aquela finalidade.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      const documentNotProcessableRule = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 REGRA ESPECIAL: DOCUMENTOS NÃO PROCESSÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se a mensagem do usuário contém exatamente "[DOCUMENTO_NAO_PROCESSAVEL]", isso significa que o usuário enviou um documento mas não foi possível identificar o conteúdo.

🚨 RESPOSTA OBRIGATÓRIA:
Responda de forma natural e coloquial, como se você não conseguisse abrir/ler o arquivo.

Exemplos de respostas apropriadas (100% HUMANAS):
- "Recebi o documento aqui, mas infelizmente não consegui abrir. Pode me contar o que você precisa ou mandar em texto?"
- "Vi que você mandou um arquivo, mas não tô conseguindo ver. Pode me explicar sobre o que é?"
- "Puts, não consegui ler esse arquivo não. Me explica com suas palavras o que você precisa?"
- "Tá dando problema pra abrir esse documento aqui. Melhor você me contar mesmo o que precisa, vai ser mais rápido!"

❌ PALAVRAS PROIBIDAS (são robotizadas):
- "processar", "processamento", "formato", "sistema", "tipo de arquivo"
- "suportado", "compatível", "técnico"

✅ PALAVRAS PERMITIDAS (são humanas):
- "abrir", "ver", "ler", "entender", "olhar"
- "mandar", "enviar", "contar", "explicar", "falar"

✅ OBRIGATÓRIO:
- Resposta curta (máximo 2 frases)
- Usar gírias e linguagem coloquial ("tô", "pra", "puts")
- Oferecer alternativa simples (falar/escrever em texto)
- Tom casual e prestativo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      // Adicionar instruções específicas para múltiplas mensagens
      const multiMessageInstruction = collectedMessages.length > 1
        ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ATENÇÃO CRÍTICA - REGRA OBRIGATÓRIA 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O eleitor enviou ${collectedMessages.length} mensagens DIFERENTES em sequência.
Você está PROIBIDO de responder apenas a uma delas.

OBRIGATÓRIO:
✅ Leia TODAS as ${collectedMessages.length} mensagens na seção "MENSAGEM ATUAL"
✅ Responda CADA pergunta que foi feita
✅ Aborde CADA assunto mencionado
✅ Se houver cumprimento + perguntas, responda o cumprimento E todas as perguntas

❌ PROIBIDO ignorar qualquer mensagem
❌ PROIBIDO responder apenas o cumprimento
❌ PROIBIDO deixar perguntas sem resposta

Exemplo CORRETO se houver cumprimento + 2 perguntas:
"Oi! Tudo certo sim! [resposta pergunta 1]. [resposta pergunta 2]."

FALHAR NESTA REGRA É INACEITÁVEL.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
        : '';

      // Montar o system prompt (SEM incluir as mensagens do eleitor, que já estão no enrichedContext)
      const systemPrompt = config.promptSystem + nameUsageRule + greetingRule + documentQuestionRule + documentNotProcessableRule + knowledgeContext + multiMessageInstruction;
      const messageContext = enrichedContext;

      // ========== GERAR RESPOSTA COM OLLAMA ==========
      const ollamaQueue = OllamaQueue.getInstance();
      const ollamaApiKey = process.env.OLLAMA_API_KEY_CLONE;
      
      if (!ollamaApiKey) {
        const errorMsg = 'OLLAMA_API_KEY_CLONE não configurada';
        console.error('[Clone Agent Queue] ❌', errorMsg);
        await storage.failQueue(queue.id, errorMsg);
        return;
      }

      console.log('[Clone Agent Queue]    🧑 Memória do eleitor:', voterMemory ? 'Disponível' : 'Nova conversa');
      
      // Log detalhado das mensagens (apenas para debug interno)
      individualMessages.forEach((content: string, idx: number) => {
        const preview = content || '[vazio]';
        console.log(`[Clone Agent Queue]    Mensagem ${idx + 1}: ${preview.substring(0, 150)}${preview.length > 150 ? '...' : ''}`);
      });
      
      // Log do sistema prompt usado (apenas primeiros caracteres para não poluir)
      
      const startTime = Date.now();
      
      const generatedResponse = await ollamaQueue.addToQueue({
        systemPrompt,
        messageContext,
        ollamaApiKey: ollamaApiKey,
        model: config.ollamaModel
      });

      const processingTime = Date.now() - startTime;

      if (!generatedResponse) {
        const errorMsg = 'Não foi possível gerar resposta';
        console.error('[Clone Agent Queue] ❌', errorMsg);
        await storage.failQueue(queue.id, errorMsg);
        return;
      }

      responseText = generatedResponse;
      
      // ========== SANITIZAR CUMPRIMENTOS DUPLICADOS (FAIL-SAFE) ==========
      if (alreadyGreeted) {
        const { sanitized, hadGreeting } = sanitizeGreeting(responseText);
        
        if (hadGreeting) {
          console.log('[Clone Agent Queue] 🧹 Sanitizador: Cumprimento duplicado removido da resposta');
          console.log('[Clone Agent Queue]    Antes:', responseText.substring(0, 100));
          console.log('[Clone Agent Queue]    Depois:', sanitized.substring(0, 100));
          responseText = sanitized;
        }
      }
      
      // Salvar resposta imediatamente no campo generatedResponse
      await storage.saveGeneratedResponse(queue.id, responseText);
    }
    } // Fechar o else da verificação de resposta existente

    // ========== SALVAR CONVERSA NO HISTÓRICO ==========
    const conversation = await storage.getConversation(queue.instanceId, queue.phoneNumber);
    const conversationHistory = conversation ? JSON.parse(conversation.messages) : [];
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: consolidatedText },
      { role: 'assistant', content: responseText }
    ];
    await storage.saveConversation(queue.instanceId, queue.phoneNumber, updatedHistory);

    // ========== ANÁLISE DE SENTIMENTO ==========
    const negativeSentiments = ['problema', 'ruim', 'péssimo', 'triste', 'irritado', 'decepcionado', 'frustrado'];
    const positiveSentiments = ['obrigado', 'ótimo', 'excelente', 'feliz', 'satisfeito', 'apoio', 'ajuda', 'bom'];
    
    const lowerCombined = consolidatedText.toLowerCase();
    const negativeScore = negativeSentiments.filter(word => lowerCombined.includes(word)).length;
    const positiveScore = positiveSentiments.filter(word => lowerCombined.includes(word)).length;
    
    let sentiment = 'neutro';
    if (negativeScore > positiveScore) {
      sentiment = 'negativo';
    } else if (positiveScore > negativeScore) {
      sentiment = 'positivo';
    }
    
    const contextSummary = `Última conversa em ${formatDateBrazil(new Date())}: ${consolidatedText.substring(0, 100)}...`;
    await storage.updateVoterContext(queue.phoneNumber, contextSummary, sentiment);

    // REMOVED: Duplicate vote detection that was incorrectly marking rejections as confirmations
    // The correct vote detection already happens earlier at lines 1044-1075 using analyzeVoteIntent

    // ========== CALCULAR TYPING DURATION ==========
    // Usa config.sendDelaySeconds com jitter de ±2 segundos para parecer mais humano
    const baseDelay = config.sendDelaySeconds || 5; // Fallback para 5 segundos
    const jitter = Math.floor(Math.random() * 5) - 2; // -2 a +2 segundos
    const typingDuration = Math.max(1, Math.min(60, baseDelay + jitter)); // Limita entre 1-60 segundos

    // ========== AGENDAR ENVIO VIA SCHEDULED WORKER ==========
    // TODAS as mensagens passam pelo Scheduled Worker para evitar duplicação
    // Isso garante um único ponto de envio, eliminando race conditions
    const isWorkingHours = isWithinWorkingHours();
    let scheduledSendTime: Date;

    if (isWorkingHours) {
      // Em horário comercial, agenda para daqui alguns segundos (typing duration)
      // O Scheduled Worker pegará e enviará em até 10 segundos
      scheduledSendTime = new Date(Date.now() + typingDuration * 1000);
      console.log('[Clone Agent Queue] 📅 Agendando envio imediato para:', scheduledSendTime.toISOString());
    } else {
      // Fora de horário, agenda para próximo slot disponível
      scheduledSendTime = await storage.getNextAvailableGlobalSlot();
      console.log('[Clone Agent Queue] 📅 Agendando envio fora de horário para:', scheduledSendTime.toISOString());
    }

    // ========== SALVAR DADOS DE AGENDAMENTO NO BANCO ==========
    await storage.updateCloneScheduledMessage(queue.id, {
      scheduledSendTime,
      typingDuration
    });

    // ========== MARCAR COMO PROCESSADA ==========
    await storage.completeQueueWithResponse(queue.id, responseText);
    
    console.log('[Clone Agent Queue] ✅ Mensagem processada e agendada com sucesso');
    console.log('[Clone Agent Queue] 📬 O Scheduled Worker enviará a mensagem automaticamente');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    const MAX_RETRIES = 3;
    const currentRetry = (queue.retryCount || 0) + 1;
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[Clone Agent Queue] ❌❌❌ ERRO CRÍTICO ❌❌❌');
    console.error('[Clone Agent Queue] 📱 Telefone:', queue.phoneNumber);
    console.error('[Clone Agent Queue] 🆔 Queue ID:', queue.id);
    console.error('[Clone Agent Queue] 🔢 Tentativa:', currentRetry, '/', MAX_RETRIES);
    console.error('[Clone Agent Queue] ❌ Mensagem de erro:', error.message);
    console.error('[Clone Agent Queue] 📚 Stack trace:', error.stack);
    
    await storage.failQueue(queue.id, error.message);
    
    if (currentRetry < MAX_RETRIES) {
      console.error('[Clone Agent Queue] 🔄 A fila será reprocessada automaticamente');
    } else {
      console.error('[Clone Agent Queue] 🛑 LIMITE DE RETRIES ATINGIDO');
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

/**
 * FLUXO SIMPLIFICADO DE ENVIO (Opção 3 - Evita Duplicação)
 * 
 * TODAS as mensagens passam APENAS pelo Scheduled Worker:
 * 1. processQueuedMessages() processa e AGENDA a mensagem
 * 2. Scheduled Worker encontra mensagens agendadas e ENVIA em chunks
 * 
 * BENEFÍCIOS:
 * ✅ Zero duplicação - apenas um worker envia
 * ✅ Código mais simples e confiável
 * ✅ Mais fácil de monitorar e debugar
 * ✅ Delay adicional de 0-10s é imperceptível
 * 
 * O que foi REMOVIDO para evitar duplicação:
 * - Envio imediato via sendResponseInChunks() no Clone Agent
 * - Lógica de markAsSentByQueue() e proteções de race condition
 * - Verificação e salvamento de hash de deduplicação no Clone Agent
 * 
 * O que foi MANTIDO:
 * - Verificações de horário de funcionamento (para calcular scheduledSendTime)
 * - Processamento completo da resposta com Ollama
 * - Agendamento via scheduledSendTime
 * - Todo envio real fica com o Scheduled Worker
 */


// Funções removidas (não mais necessárias - agora o Scheduled Worker é responsável pelo envio):
// - removeFinalPeriod(): movida para scheduled-messages-worker.ts
// - sendResponseInChunks(): movida para scheduled-messages-worker.ts
// - generateMessageHash(): movida para scheduled-messages-worker.ts