/**
 * Worker para processar filas de mensagens do Agente Militante
 * Executa periodicamente para processar mensagens coletadas com buffer temporal
 */

import { processMilitantMessageQueues } from "../workflows/militant-agent.js";

let intervalId: NodeJS.Timeout | null = null;
let isProcessing = false;

const WORKER_ID = `militant-worker-${Date.now()}-${Math.random()}`;

export function startMilitantAgentWorker(): void {
  console.log('[Militant Agent Worker] Worker iniciado - processando filas a cada 10 segundos');
  
  intervalId = setInterval(async () => {
    if (isProcessing) {
      return;
    }
    
    try {
      isProcessing = true;
      await processMilitantMessageQueues();
    } catch (error) {
      console.error('[Militant Agent Worker] Erro no worker:', error);
    } finally {
      isProcessing = false;
    }
  }, 10000);
}

export function stopMilitantAgentWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
