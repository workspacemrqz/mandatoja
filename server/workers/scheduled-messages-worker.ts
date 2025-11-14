/**
 * Worker para enviar mensagens agendadas do Clone Agent
 * Executa a cada 10 segundos para enviar mensagens cujo scheduledSendTime já chegou
 */

import { storage } from "../storage.js";
import { WahaConfig, wahaSendText, wahaStartTyping, wahaStopTyping, wahaSendSeen, calculateTypingDuration, phoneToChatId } from "../lib/waha-client.js";
import { createHash } from 'crypto';
import { splitMessageBySentences, sleep, getChunkDelay } from "../lib/message-chunker.js";

let intervalId: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * Set para rastrear mensagens que foram recém-enviadas pelo Clone Agent Queue
 * Evita duplicação quando mensagens são enviadas imediatamente (dentro do horário)
 */
const recentlySentByQueue = new Map<string, NodeJS.Timeout>();

/**
 * Gera um hash único para deduplicação de mensagens
 * Combina telefone + texto da mensagem + timestamp truncado para minuto
 */
function generateMessageHash(phoneNumber: string, messageText: string, timestamp: Date): string {
  // Truncar timestamp para o minuto (ignorar segundos) para permitir pequenas variações de tempo
  const truncatedTimestamp = new Date(timestamp);
  truncatedTimestamp.setSeconds(0, 0);
  
  // Criar string única combinando elementos
  const uniqueString = `${phoneNumber}|${messageText}|${truncatedTimestamp.toISOString()}`;
  
  // Gerar hash SHA-256
  const hash = createHash('sha256').update(uniqueString).digest('hex');
  
  // Retornar apenas os primeiros 64 caracteres (suficiente para unicidade)
  return hash.substring(0, 64);
}

/**
 * Marca uma mensagem como recém-enviada pelo Clone Agent Queue
 * A mensagem será ignorada pelo worker por 60 segundos
 */
export function markAsSentByQueue(messageId: string): void {
  // Limpar timeout anterior se existir
  const existingTimeout = recentlySentByQueue.get(messageId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // Adicionar ao set e remover após 60 segundos
  const timeout = setTimeout(() => {
    recentlySentByQueue.delete(messageId);
  }, 60000); // 60 segundos
  
  recentlySentByQueue.set(messageId, timeout);
}

/**
 * Remove o ponto final do fim de uma mensagem
 */
function removeFinalPeriod(text: string): string {
  return text.replace(/\.$/, '');
}

/**
 * Divide o texto em chunks e envia um a um com simulação de digitação
 */
async function sendResponseInChunks(phoneNumber: string, text: string, wahaConfig: WahaConfig): Promise<void> {
  console.log('[Scheduled Messages Worker] 🚀 INICIANDO sendResponseInChunks');
  console.log('[Scheduled Messages Worker] 📞 Telefone:', phoneNumber);
  console.log('[Scheduled Messages Worker] 📝 Texto completo a ser enviado:', text);
  console.log('[Scheduled Messages Worker] 📝 Tamanho do texto:', text.length, 'caracteres');
  console.log('[Scheduled Messages Worker] 🔍 Origem:', 'Scheduled Messages Worker');
  
  try {
    const chatId = phoneToChatId(phoneNumber);
    
    // PASSO 1: Marcar mensagens do eleitor como visualizadas/lidas
    try {
      console.log('[Scheduled Messages Worker] 👁️  Visualizando mensagens do eleitor...');
      await wahaSendSeen(wahaConfig, chatId);
      console.log('[Scheduled Messages Worker] ✅ Mensagens visualizadas com sucesso');
    } catch (seenError) {
      // Se houver erro ao visualizar, continuar mesmo assim (não é crítico)
      console.warn('[Scheduled Messages Worker] ⚠️  Erro ao visualizar mensagens:', seenError);
    }
    
    // Divide a mensagem em chunks usando a mesma função do Clone Agent
    const chunks = splitMessageBySentences(text);
    
    console.log(`[Scheduled Messages Worker] Enviando mensagem em ${chunks.length} chunk(s)`);
    
    // Envia cada chunk com delay entre eles
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      
      // Remove o ponto final de cada chunk antes de enviar
      chunk = removeFinalPeriod(chunk);
      
      // Calcular tempo de digitação aleatório entre 2-6 segundos
      const chunkTypingDuration = calculateTypingDuration(chunk.length);
      console.log(`[Scheduled Messages Worker] ⌨️  Iniciando indicador de digitação por ${chunkTypingDuration.toFixed(1)}s para chunk ${i + 1}/${chunks.length}`);
      
      try {
        // Iniciar indicador de digitação
        await wahaStartTyping(wahaConfig, { chatId });
        
        // Aguardar tempo de digitação simulado (aleatório entre 2-6 segundos)
        await sleep(chunkTypingDuration * 1000);
      } catch (typingError) {
        // Se houver erro no typing, continuar mesmo assim (não é crítico)
        console.warn(`[Scheduled Messages Worker] ⚠️  Erro ao gerenciar indicador de digitação:`, typingError);
      } finally {
        // Sempre tentar parar o indicador de digitação
        try {
          await wahaStopTyping(wahaConfig, { chatId });
        } catch (stopError) {
          console.warn(`[Scheduled Messages Worker] ⚠️  Erro ao parar indicador de digitação:`, stopError);
        }
      }
      
      console.log(`[Scheduled Messages Worker] 📤 Enviando chunk ${i + 1}/${chunks.length} (${chunk.length} caracteres)`);
      
      await wahaSendText(wahaConfig, { chatId, text: chunk });
      
      // Aguarda delay entre chunks (exceto após o último)
      if (i < chunks.length - 1) {
        await sleep(getChunkDelay());
      }
    }
    
    console.log(`[Scheduled Messages Worker] ✅ Todos os chunks enviados com sucesso`);
    
  } catch (error: any) {
    console.error('[Scheduled Messages Worker] Erro ao enviar mensagem:', error.message);
    throw error;
  }
}

/**
 * Processa mensagens agendadas que estão prontas para envio
 */
async function processScheduledMessages(): Promise<void> {
  try {
    const messagesToSend = await storage.getScheduledMessagesForSending();
    
    if (messagesToSend.length === 0) {
      return;
    }
    
    for (const message of messagesToSend) {
      try {
        if (recentlySentByQueue.has(message.id)) {
          continue;
        }
        
        const instance = await storage.getCloneAgentInstance(message.instanceId);
        
        if (!instance) {
          console.error('[Scheduled Messages Worker] Instância não encontrada:', message.instanceId);
          continue;
        }
        
        if (!instance.isActive) {
          continue;
        }
        
        const wahaConfig: WahaConfig = {
          url: instance.wahaUrl,
          apiKey: instance.wahaApiKey,
          session: instance.wahaSession
        };
        
        const responseText = message.generatedResponse;
        
        if (!responseText) {
          console.error('[Scheduled Messages Worker] Mensagem sem resposta gerada');
          continue;
        }
        
        const messageHash = generateMessageHash(message.phoneNumber, responseText, new Date());
        
        const isDuplicate = await storage.checkMessageHash(messageHash);
        if (isDuplicate) {
          await storage.markMessageAsSent(message.id);
          continue;
        }
        
        await storage.saveMessageHash(message.id, messageHash);
        
        try {
          await sendResponseInChunks(message.phoneNumber, responseText, wahaConfig);
          
          await storage.markMessageAsSent(message.id);
        } catch (sendError) {
          console.error('[Scheduled Messages Worker] Erro ao enviar, removendo hash para permitir reenvio');
          await storage.removeMessageHash(message.id);
          throw sendError;
        }
        
      } catch (error: any) {
        console.error('[Scheduled Messages Worker] Erro ao processar mensagem:', error.message);
      }
    }
    
  } catch (error: any) {
    console.error('[Scheduled Messages Worker] Erro ao processar mensagens agendadas:', error.message);
  }
}

export function startScheduledMessagesWorker(): void {
  console.log('[Scheduled Messages Worker] Worker iniciado - processando mensagens a cada 10 segundos');
  
  intervalId = setInterval(async () => {
    if (isProcessing) {
      return;
    }
    
    try {
      isProcessing = true;
      await processScheduledMessages();
    } catch (error) {
      console.error('[Scheduled Messages Worker] Erro no worker:', error);
    } finally {
      isProcessing = false;
    }
  }, 10000);
}

export function stopScheduledMessagesWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
