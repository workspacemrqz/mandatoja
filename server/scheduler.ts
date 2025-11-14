import type { IStorage } from "./storage";
import { runInstagramAgentWorkflow } from "./workflows/instagram-agent";
import { runCollectorAgentWorkflow } from "./workflows/collector-agent";
import { runAllMilitantAgents } from "./workflows/militant-agent";

export function startAgentScheduler(storage: IStorage): void {
  const runScheduledAgents = async () => {
    try {
      // Run Instagram agents
      const instagramAgents = await storage.getInstagramAgents();
      const activeInstagramAgents = instagramAgents.filter(agent => agent.isActive);

      for (const agent of activeInstagramAgents) {
        try {
          const shouldRun = !agent.lastRunAt || 
            (Date.now() - new Date(agent.lastRunAt).getTime() >= 3 * 60 * 60 * 1000); // 3 horas

          if (shouldRun) {
            console.log(`[Scheduler] Running Instagram agent ${agent.id} for ${agent.instagramUrl}`);
            
            const result = await runInstagramAgentWorkflow(
              agent.id, 
              agent.instagramUrl, 
              agent.whatsappRecipient, 
              agent.personName,
              agent.personInstagram,
              agent.lastPostId,
              agent.lastRunAt,
              storage
            );
            
            if (result.success) {
              await storage.updateLastRun(agent.id, result.postId || null, new Date());
              console.log(`[Scheduler] Successfully ran Instagram agent ${agent.id}, postId: ${result.postId}`);
            } else {
              console.error(`[Scheduler] Failed to run Instagram agent ${agent.id}:`, result.error);
            }
          }
        } catch (error) {
          console.error(`[Scheduler] Error running Instagram agent ${agent.id}:`, error);
        }
      }

      // Run Collector agents (every 5 minutes)
      const collectorAgents = await storage.getCollectorAgents();
      const activeCollectorAgents = collectorAgents.filter(agent => agent.isActive);

      for (const agent of activeCollectorAgents) {
        try {
          const shouldRun = !agent.lastRunAt || 
            (Date.now() - new Date(agent.lastRunAt).getTime() >= 5 * 60 * 1000); // 5 minutes

          if (shouldRun) {
            console.log(`[Scheduler] Running Collector agent ${agent.id} for group ${agent.groupName}`);
            await runCollectorAgentWorkflow(agent.id);
            console.log(`[Scheduler] Successfully ran Collector agent ${agent.id}`);
          }
        } catch (error) {
          console.error(`[Scheduler] Error running Collector agent ${agent.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error fetching agents:', error);
    }
  };

  // DEPRECATED: Militant agents scheduler replaced by worker system (militant-agent-worker.ts)
  // The new system uses temporal buffer processing with optimistic locking
  // Keeping this code commented for reference during migration period
  /*
  // Agendar agentes militantes para executar a cada 30 segundos
  let isMilitantAgentsRunning = false;
  const runMilitantAgents = async () => {
    // Guard: Skip execution if previous run is still in progress
    if (isMilitantAgentsRunning) {
      console.log('[Scheduler] Skipping militant agents run - previous execution still in progress');
      return;
    }
    
    try {
      isMilitantAgentsRunning = true;
      await runAllMilitantAgents();
    } catch (error) {
      console.error('[Scheduler] Error running militant agents:', error);
    } finally {
      isMilitantAgentsRunning = false;
    }
  };
  */

  // Executar agentes imediatamente na inicialização
  runScheduledAgents().catch(error => {
    console.error('[Scheduler] Initial scheduled agents run failed:', error);
  });
  
  // DEPRECATED: Militant agents now use worker-based processing
  /*
  runMilitantAgents().catch(error => {
    console.error('[Scheduler] Initial militant agents run failed:', error);
  });
  */

  // Configurar intervalos
  setInterval(runScheduledAgents, 5 * 60 * 1000); // Run every 5 minutes
  // DEPRECATED: Militant agents now use worker-based processing
  // setInterval(runMilitantAgents, 30 * 1000); // Run militant agents every 30 seconds
  
  console.log('[Scheduler] Agent scheduler started - checking every 5 minutes (Instagram/Collector). Militant agents use worker-based processing.');
}
