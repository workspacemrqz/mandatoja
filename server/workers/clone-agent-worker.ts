/**
 * Worker para processar filas de mensagens do Agente Clone
 * Executa periodicamente para processar mensagens coletadas
 */

import { processMessageQueues } from "../workflows/clone-agent.js";

let intervalId: NodeJS.Timeout | null = null;
let isProcessing = false; // Flag global para evitar execução simultânea

// ID único do worker para garantir locking único
const WORKER_ID = `clone-worker-${Date.now()}-${Math.random()}`;

export function startCloneAgentWorker(): void {
  console.log('[Clone Agent Worker] Worker iniciado - processando filas a cada 10 segundos');
  
  intervalId = setInterval(async () => {
    if (isProcessing) {
      return;
    }
    
    try {
      isProcessing = true;
      await processMessageQueues();
    } catch (error) {
      console.error('[Clone Agent Worker] Erro no worker:', error);
    } finally {
      isProcessing = false;
    }
  }, 10000);
}

export function stopCloneAgentWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}