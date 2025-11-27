import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, DuplicateWhatsAppError } from "./storage";
import { insertVoterSchema, insertCampaignMaterialSchema, insertConfigOptionSchema, insertLeadershipSchema, insertAssessorSchema, insertInstagramAgentSchema, insertCollectorAgentSchema, insertReplicadorAgentInstanceSchema, insertColetorAgentInstanceSchema, insertCloneAgentConfigSchema, insertCloneAgentInstanceSchema, insertCloneAgentKnowledgeSchema, insertWahaWebhookConfigSchema, insertMilitantAgentSchema, wahaInstances } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { runInstagramAgentWorkflow } from "./workflows/instagram-agent";
import { processWhatsAppMessage } from "./workflows/clone-agent";
import { ZodError, z } from "zod";
import * as XLSX from "xlsx";
import { wahaGetContact, wahaSendText, wahaCheckNumberExists, phoneToChatId, groupIdToWaha, wahaGetGroups, wahaGetGroup, wahaGetGroupParticipants, wahaGetSession, wahaCreateSession, wahaStartSession, wahaDeleteSession, wahaGetQrCode, wahaListSessions, type WahaConfig } from "./lib/waha-client";
import { extractPhoneNumber } from "./lib/whatsapp-normalizer";

// Query parameter validation schemas
const conversationsQuerySchema = z.object({
  instanceId: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const conversationMessagesQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ message: "Não autenticado" });
  }
}

// Helper function to determine if a new name is better/more complete than existing
function isNameBetter(existingName: string, newName: string): boolean {
  const existing = existingName.trim();
  const newValue = newName.trim();
  
  // If new name is empty or same, don't update
  if (!newValue || newValue === existing) return false;
  
  // CRITICAL: Never downgrade a real name to a placeholder
  // If new name is a placeholder, only accept it if existing is also a placeholder
  const newIsPlaceholder = newValue.startsWith('Novo Membro');
  const existingIsPlaceholder = existing.startsWith('Novo Membro');
  
  if (newIsPlaceholder && !existingIsPlaceholder) return false; // Don't replace real name with placeholder
  if (!newIsPlaceholder && existingIsPlaceholder) return true;  // Always replace placeholder with real name
  
  // Prefer name without initials over name with initials (e.g., "João Silva" > "João S.")
  const existingHasInitials = /\b[A-Z]\.$/.test(existing);
  const newHasInitials = /\b[A-Z]\.$/.test(newValue);
  if (existingHasInitials && !newHasInitials) return true;
  if (!existingHasInitials && newHasInitials) return false;
  
  // Compare word count (more words = more complete)
  const existingWords = existing.split(/\s+/).length;
  const newWords = newValue.split(/\s+/).length;
  if (newWords > existingWords) return true;
  if (newWords < existingWords) return false;
  
  // Same word count: prefer longer name (more characters)
  return newValue.length > existing.length;
}

// Helper function to fetch contact data from WAHA with caching and concurrency control
async function fetchContactDataBatch(
  phones: string[],
  wahaConfig: WahaConfig
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const CONCURRENCY_LIMIT = 5;

  for (let i = 0; i < phones.length; i += CONCURRENCY_LIMIT) {
    const batch = phones.slice(i, i + CONCURRENCY_LIMIT);
    const batchPromises = batch.map(async (phone) => {
      try {
        const chatId = phoneToChatId(phone);
        const contactData = await wahaGetContact(wahaConfig, chatId);
        
        // Log complete response for debugging
        
        // Extract name from WAHA contact data
        // Priority: name > pushName > notify
        const nome = contactData.name || contactData.pushName || contactData.notify || '';
        
        // Log which field was used
        const source = contactData.name ? 'name' : 
                      contactData.pushName ? 'pushName' : 
                      contactData.notify ? 'notify' : 'none';
        
        if (nome) {
        }
        
        return { phone, nome };
      } catch (error) {
        console.error(`Error fetching contact ${phone}:`, error);
        return { phone, nome: '' };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ phone, nome }) => results.set(phone, nome));
  }

  return results;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Apply authentication middleware to all /api/* routes except auth and health
  app.use("/api", (req, res, next) => {
    const publicPaths = ["/health", "/auth/login", "/auth/logout", "/auth/check", "/webhooks/whatsapp", "/webhooks/whatsapp-messages", "/webhooks/zapi/messages", "/webhook/waha", "/webhooks/waha/messages", "/test/send-whatsapp"];
    if (publicPaths.includes(req.path)) {
      return next();
    }
    requireAuth(req, res, next);
  });

  // WAHA session status endpoint
  app.get("/api/waha/session-status", async (req, res) => {
    try {
      const { wahaUrl, wahaApiKey, session } = req.query;

      // Validate required parameters
      if (!wahaUrl || !wahaApiKey || !session) {
        return res.status(200).json({
          status: "FAILED",
          connected: false,
          error: "Missing required parameters: wahaUrl, wahaApiKey, or session"
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl as string,
        apiKey: wahaApiKey as string,
        session: session as string
      };

      // Call WAHA API to get session status
      const sessionInfo = await wahaGetSession(wahaConfig);
      
      // Extract status from session info
      const status = sessionInfo.status || "UNKNOWN";
      const connected = status === "WORKING";

      return res.status(200).json({
        status,
        connected
      });
    } catch (error) {
      console.error("Error checking WAHA session status:", error);
      
      // Always return 200 with valid JSON even on error
      return res.status(200).json({
        status: "FAILED",
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // WAHA Instance Management Routes
  // Uses environment variables WAHA_URL and WAHA_API for all operations
  // Only shows instances created through this interface (stored in waha_instances table)
  
  // Create WAHA instance (session)
  app.post("/api/waha/instances", async (req, res) => {
    try {
      const { sessionName } = req.body;
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API;

      if (!wahaUrl || !wahaApiKey) {
        return res.status(500).json({
          success: false,
          error: "WAHA_URL ou WAHA_API não configurados no servidor"
        });
      }

      if (!sessionName) {
        return res.status(400).json({
          success: false,
          error: "Nome da sessão é obrigatório"
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: sessionName
      };

      // Create the session in WAHA
      const result = await wahaCreateSession(wahaConfig);
      
      // Save to our database to track instances created through this interface
      await db.insert(wahaInstances).values({ sessionName }).onConflictDoNothing();
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error creating WAHA instance:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete WAHA instance (session)
  app.delete("/api/waha/instances/:sessionName", async (req, res) => {
    try {
      const { sessionName } = req.params;
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API;

      if (!wahaUrl || !wahaApiKey) {
        return res.status(500).json({
          success: false,
          error: "WAHA_URL ou WAHA_API não configurados no servidor"
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: sessionName
      };

      // Delete the session from WAHA
      const result = await wahaDeleteSession(wahaConfig);
      
      // Remove from our database
      await db.delete(wahaInstances).where(eq(wahaInstances.sessionName, sessionName));
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error deleting WAHA instance:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Connect/Start WAHA instance (session)
  app.post("/api/waha/instances/:sessionName/start", async (req, res) => {
    try {
      const { sessionName } = req.params;
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API;

      if (!wahaUrl || !wahaApiKey) {
        return res.status(500).json({
          success: false,
          error: "WAHA_URL ou WAHA_API não configurados no servidor"
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: sessionName
      };

      // Start the session
      const result = await wahaStartSession(wahaConfig);
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error starting WAHA instance:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get QR Code for WAHA instance
  app.get("/api/waha/instances/:sessionName/qr", async (req, res) => {
    try {
      const { sessionName } = req.params;
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API;

      if (!wahaUrl || !wahaApiKey) {
        return res.status(500).json({
          success: false,
          error: "WAHA_URL ou WAHA_API não configurados no servidor"
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: sessionName
      };

      // Get the QR code
      const qrData = await wahaGetQrCode(wahaConfig);
      
      return res.status(200).json({
        success: true,
        data: qrData
      });
    } catch (error) {
      console.error("Error getting QR code:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // List WAHA instances (sessions) - only those created through this interface
  app.get("/api/waha/instances", async (req, res) => {
    try {
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API;

      if (!wahaUrl || !wahaApiKey) {
        return res.status(500).json({
          success: false,
          error: "WAHA_URL ou WAHA_API não configurados no servidor"
        });
      }

      // Get our tracked instances from database
      const trackedInstances = await db.select().from(wahaInstances);
      const trackedNames = new Map(trackedInstances.map(i => [i.sessionName, i]));

      // List all sessions from WAHA
      const allSessions = await wahaListSessions(wahaUrl, wahaApiKey);
      const wahaSessionMap = new Map((allSessions || []).map((s: any) => [s.name, s]));
      
      // Build result: show all tracked instances, with WAHA status if available
      const result = [];
      for (const [sessionName, dbInstance] of trackedNames) {
        const wahaSession = wahaSessionMap.get(sessionName);
        if (wahaSession) {
          // Session exists in WAHA - use WAHA data
          result.push(wahaSession);
        } else {
          // Session is tracked but not in WAHA - show as STOPPED
          result.push({
            name: sessionName,
            status: "STOPPED",
            config: {}
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error listing WAHA instances:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Voters endpoints
  app.get("/api/voters", async (req, res) => {
    try {
      const voters = await storage.getVoters();
      res.json(voters);
    } catch (error) {
      console.error("Error fetching voters:", error);
      res.status(500).json({ message: "Failed to fetch voters" });
    }
  });

  // Export voters to Excel (must be before /api/voters/:id)
  app.get("/api/voters/export-excel", async (req, res) => {
    try {
      const voters = await storage.getVoters();

      // Prepare data for Excel
      const excelData = voters.map((voter: any) => ({
        'Nome': voter.nome,
        'WhatsApp': voter.whatsapp,
        'Município': voter.municipio,
        'Bairro': voter.bairro,
        'Indicação': voter.indicacao,
        'Status do Voto': voter.voto === 'confirmado' ? 'Confirmado' : 'Em Progresso',
        'Material': voter.material === 'entregue' ? 'Entregue' : 
                   voter.material === 'enviado' ? 'Enviado' : 'Sem Material',
        'Data de Cadastro': voter.dataCadastro ? new Date(voter.dataCadastro).toLocaleDateString('pt-BR') : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 30 }, // Nome
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // Município
        { wch: 20 }, // Bairro
        { wch: 20 }, // Indicação
        { wch: 18 }, // Status do Voto
        { wch: 15 }, // Material
        { wch: 15 }, // Data de Cadastro
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Eleitores');

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=eleitores_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting voters to Excel:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to export voters to Excel",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/voters/:id", async (req, res) => {
    try {
      const voter = await storage.getVoter(req.params.id);
      if (!voter) {
        return res.status(404).json({ message: "Voter not found" });
      }
      res.json(voter);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voter" });
    }
  });

  app.post("/api/voters", async (req, res) => {
    try {
      const validatedData = insertVoterSchema.parse(req.body);
      const voter = await storage.createVoter(validatedData);
      res.status(201).json(voter);
    } catch (error) {
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid voter data" });
      }
    }
  });

  app.put("/api/voters/:id", async (req, res) => {
    try {
      const validatedData = insertVoterSchema.partial().parse(req.body);
      const voter = await storage.updateVoter(req.params.id, validatedData);
      if (!voter) {
        return res.status(404).json({ message: "Voter not found" });
      }
      res.json(voter);
    } catch (error) {
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid voter data" });
      }
    }
  });

  app.delete("/api/voters/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVoter(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Voter not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete voter" });
    }
  });

  app.delete("/api/voters", async (req, res) => {
    try {
      const result = await storage.deleteAllVoters();
      res.status(200).json(result);
    } catch (error) {
      console.error("Error deleting all voters:", error);
      res.status(500).json({ message: "Failed to delete all voters" });
    }
  });

  // Sync voter names with WAHA contacts
  app.post("/api/voters/sync-contacts", async (req, res) => {
    try {
      // Get WAHA instance from Coletor Agent (used for collecting voters)
      const instance = await storage.getColetorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        return res.status(500).json({ 
          success: false,
          message: "WAHA credentials not configured. Please configure the Coletor Agent instance first." 
        });
      }

      const wahaConfig: WahaConfig = {
        url: instance.wahaUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      // Get all voters to sync their contacts
      const voters = await storage.getVoters();

      // Statistics
      let totalContacts = 0;
      let votersUpdated = 0;
      let votersNotFound = 0;
      let votersUnchanged = 0;

      // Process each voter's contact
      for (const voter of voters) {
        const phone = voter.whatsapp;
        
        if (!phone || phone.length < 10) {
          continue;
        }

        try {
          const chatId = phoneToChatId(phone);
          const contact = await wahaGetContact(wahaConfig, chatId);
          totalContacts++;
          
          // Extract name using priority: name > pushName > notify
          const nome = contact.name || contact.pushName || contact.notify || '';
          
          if (!nome) {
            votersNotFound++;
            continue;
          }

          // Check if name is better
          if (isNameBetter(voter.nome, nome)) {
            await storage.updateVoter(voter.id, {
              nome: nome,
              nameSource: 'contacts'
            });
            votersUpdated++;
          } else {
            votersUnchanged++;
          }
        } catch (error) {
          console.error(`Error fetching contact for ${phone}:`, error);
          votersNotFound++;
        }
      }

      res.json({
        success: true,
        totalContacts,
        votersUpdated,
        votersNotFound,
        votersUnchanged
      });
    } catch (error) {
      console.error("Error syncing contacts:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync contacts",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Leaderships endpoints
  app.get("/api/leaderships", async (req, res) => {
    try {
      const leaderships = await storage.getLeaderships();
      res.json(leaderships);
    } catch (error) {
      console.error("Error fetching leaderships:", error);
      res.status(500).json({ message: "Failed to fetch leaderships" });
    }
  });

  // Export leaderships to Excel (must be before /api/leaderships/:id)
  app.get("/api/leaderships/export-excel", async (req, res) => {
    try {
      const leaderships = await storage.getLeaderships();

      // Prepare data for Excel
      const excelData = leaderships.map((leadership: any) => ({
        'Nome': leadership.nome,
        'WhatsApp': leadership.whatsapp,
        'Município': leadership.municipio,
        'Bairro': leadership.bairro,
        'Investimento': leadership.investimento || 'Não informado',
        'Material Enviado': leadership.materialEnviado === 'sim' ? 'Sim' : 'Não',
        'Data de Cadastro': leadership.dataCadastro ? new Date(leadership.dataCadastro).toLocaleDateString('pt-BR') : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 30 }, // Nome
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // Município
        { wch: 20 }, // Bairro
        { wch: 20 }, // Investimento
        { wch: 18 }, // Material Enviado
        { wch: 15 }, // Data de Cadastro
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Lideranças');

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=liderancas_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting leaderships to Excel:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to export leaderships to Excel",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/leaderships/:id", async (req, res) => {
    try {
      const leadership = await storage.getLeadership(req.params.id);
      if (!leadership) {
        return res.status(404).json({ message: "Leadership not found" });
      }
      res.json(leadership);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leadership" });
    }
  });

  app.post("/api/leaderships", async (req, res) => {
    try {
      const validatedData = insertLeadershipSchema.parse(req.body);
      const leadership = await storage.createLeadership(validatedData);
      res.status(201).json(leadership);
    } catch (error) {
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid leadership data" });
      }
    }
  });

  app.put("/api/leaderships/:id", async (req, res) => {
    try {
      console.log("[PUT /api/leaderships/:id] Request body:", req.body);
      const validatedData = insertLeadershipSchema.partial().parse(req.body);
      const leadership = await storage.updateLeadership(req.params.id, validatedData);
      if (!leadership) {
        return res.status(404).json({ message: "Leadership not found" });
      }
      res.json(leadership);
    } catch (error) {
      console.error("[PUT /api/leaderships/:id] Error:", error);
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid leadership data", errors: error.errors });
      } else {
        res.status(400).json({ message: "Invalid leadership data" });
      }
    }
  });

  app.delete("/api/leaderships/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLeadership(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Leadership not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete leadership" });
    }
  });

  // Assessores endpoints
  app.get("/api/assessores", async (req, res) => {
    try {
      const assessores = await storage.getAssessores();
      res.json(assessores);
    } catch (error) {
      console.error("Error fetching assessores:", error);
      res.status(500).json({ message: "Failed to fetch assessores" });
    }
  });

  // Export assessores to Excel (must be before /api/assessores/:id)
  app.get("/api/assessores/export-excel", async (req, res) => {
    try {
      const assessores = await storage.getAssessores();

      // Prepare data for Excel
      const excelData = assessores.map((assessor: any) => ({
        'Nome': assessor.nome,
        'WhatsApp': assessor.whatsapp,
        'Município': assessor.municipio,
        'Bairro': assessor.bairro,
        'Investimento': assessor.investimento || 'Não informado',
        'Material Enviado': assessor.materialEnviado === 'sim' ? 'Sim' : 'Não',
        'Data de Cadastro': assessor.dataCadastro ? new Date(assessor.dataCadastro).toLocaleDateString('pt-BR') : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 30 }, // Nome
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // Município
        { wch: 20 }, // Bairro
        { wch: 20 }, // Investimento
        { wch: 18 }, // Material Enviado
        { wch: 15 }, // Data de Cadastro
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Assessores');

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=assessores_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting assessores to Excel:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to export assessores to Excel",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/assessores/:id", async (req, res) => {
    try {
      const assessor = await storage.getAssessor(req.params.id);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessor" });
    }
  });

  app.post("/api/assessores", async (req, res) => {
    try {
      const validatedData = insertAssessorSchema.parse(req.body);
      const assessor = await storage.createAssessor(validatedData);
      res.status(201).json(assessor);
    } catch (error) {
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid assessor data" });
      }
    }
  });

  app.put("/api/assessores/:id", async (req, res) => {
    try {
      console.log("[PUT /api/assessores/:id] Request body:", req.body);
      const validatedData = insertAssessorSchema.partial().parse(req.body);
      const assessor = await storage.updateAssessor(req.params.id, validatedData);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      console.error("[PUT /api/assessores/:id] Error:", error);
      if (error instanceof DuplicateWhatsAppError) {
        res.status(409).json({ message: error.message });
      } else if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid assessor data", errors: error.errors });
      } else {
        res.status(400).json({ message: "Invalid assessor data" });
      }
    }
  });

  app.delete("/api/assessores/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAssessor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assessor" });
    }
  });

  // Campaign Materials endpoints
  app.get("/api/materials", async (req, res) => {
    try {
      const materials = await storage.getCampaignMaterials();
      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  // Export materials to Excel (must be before /api/materials/:id)
  app.get("/api/materials/export-excel", async (req, res) => {
    try {
      const materials = await storage.getCampaignMaterials();

      // Prepare data for Excel
      const excelData = materials.map((material: any) => ({
        'Tipo de Material': material.tipoMaterial,
        'Entrega': material.entrega === 'online' ? 'Online' : 'Presencial',
        'Destinatário': material.destinatario,
        'Quantidade': material.quantidade,
        'Status': material.status === 'distribuido' ? 'Distribuído' : 'Em Preparação',
        'Data de Cadastro': material.dataCadastro ? new Date(material.dataCadastro).toLocaleDateString('pt-BR') : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 25 }, // Tipo de Material
        { wch: 15 }, // Entrega
        { wch: 30 }, // Destinatário
        { wch: 12 }, // Quantidade
        { wch: 18 }, // Status
        { wch: 15 }, // Data de Cadastro
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Materiais');

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=materiais_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting materials to Excel:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to export materials to Excel",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/materials/:id", async (req, res) => {
    try {
      const material = await storage.getCampaignMaterial(req.params.id);
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch material" });
    }
  });

  app.post("/api/materials", async (req, res) => {
    try {
      const validatedData = insertCampaignMaterialSchema.parse(req.body);
      const material = await storage.createCampaignMaterial(validatedData);
      res.status(201).json(material);
    } catch (error) {
      res.status(400).json({ message: "Invalid material data" });
    }
  });

  app.put("/api/materials/:id", async (req, res) => {
    try {
      const validatedData = insertCampaignMaterialSchema.partial().parse(req.body);
      const material = await storage.updateCampaignMaterial(req.params.id, validatedData);
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      res.status(400).json({ message: "Invalid material data" });
    }
  });

  app.delete("/api/materials/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCampaignMaterial(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Configuration Options endpoints
  app.get("/api/config-options", async (req, res) => {
    try {
      const options = await storage.getConfigOptions();
      res.json(options);
    } catch (error) {
      console.error("Error fetching config options:", error);
      res.status(500).json({ message: "Failed to fetch config options" });
    }
  });

  app.get("/api/config-options/:fieldType", async (req, res) => {
    try {
      const { fieldType } = req.params;
      const { municipio } = req.query;
      
      // Se estiver buscando bairros e tiver município, filtrar por município
      if (fieldType === 'bairro' && municipio) {
        const options = await storage.getBairrosByMunicipio(municipio as string);
        res.json(options);
      } else {
        const options = await storage.getConfigOptionsByType(fieldType);
        res.json(options);
      }
    } catch (error) {
      console.error("Error fetching config options by type:", error);
      res.status(500).json({ message: "Failed to fetch config options" });
    }
  });

  app.post("/api/config-options", async (req, res) => {
    try {
      const validatedData = insertConfigOptionSchema.parse(req.body);
      const option = await storage.createConfigOption(validatedData);
      res.status(201).json(option);
    } catch (error) {
      res.status(400).json({ message: "Invalid config option data" });
    }
  });

  app.delete("/api/config-options/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteConfigOption(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Config option not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete config option" });
    }
  });

  // WhatsApp Groups endpoint
  app.get("/api/whatsapp-groups", async (req, res) => {
    try {
      const wahaUrl = process.env.WAHA_URL;
      const wahaApiKey = process.env.WAHA_API_KEY;
      const wahaSession = process.env.WAHA_SESSION;
      
      if (!wahaUrl || !wahaApiKey || !wahaSession) {
        return res.json([]); // Return empty array if not configured
      }

      // Create WAHA config
      const wahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: wahaSession
      };
      
      // Use WAHA client to get groups
      const groups = await wahaGetGroups(wahaConfig);

      res.json(groups);
    } catch (error) {
      console.error("Error fetching WhatsApp groups from WAHA:", error);
      res.json([]); // Return empty array on error
    }
  });

  // Armazenar mensagens processadas recentemente para evitar duplicação
  // WAHA envia tanto evento "message" quanto "message.any" para a mesma mensagem
  const recentMessageIds = new Set<string>();
  
  // Limpar mensagens antigas a cada 5 minutos
  setInterval(() => {
    recentMessageIds.clear();
  }, 5 * 60 * 1000);

  // WAHA Webhook for Clone Agent (alternative route for WAHA compatibility)
  app.post("/api/webhook/waha", async (req, res) => {
    try {
      console.log('[WAHA Webhook] 📨 Webhook chamado');

      // Normalizar mensagem do formato WAHA para formato interno
      const payload = req.body;
      
      // Extrair dados do payload WAHA
      const event = payload.event;
      const session = payload.session;
      const data = payload.payload || payload.data || payload;

      console.log(`[WAHA Webhook] Event: ${event}, Session: ${session}`);

      // Apenas processar eventos de mensagem
      if (event !== 'message' && event !== 'message.any') {
        console.log(`[WAHA Webhook] Evento ${event} ignorado`);
        return res.json({ success: true, message: 'Event ignored' });
      }

      // Extrair messageId e verificar duplicação
      const messageId = data.id || '';
      if (messageId && recentMessageIds.has(messageId)) {
        return res.json({ success: true, message: 'Duplicate message ignored' });
      }

      // Adicionar ao conjunto de mensagens processadas
      if (messageId) {
        recentMessageIds.add(messageId);
      }

      // Extrair campos base
      const fromMe = data.fromMe || data.from_me || false;
      const fromChat = data.from || data.chatId || '';
      const isGroup = fromChat.includes('@g.us'); // Grupos têm @g.us no identificador
      
      // Ignorar mensagens enviadas por nós (fromMe: true)
      if (fromMe) {
        return res.json({ success: true, message: 'Own message ignored' });
      }

      // =================================================================
      // REGRA: IGNORAR STICKERS/FIGURINHAS DO WHATSAPP
      // =================================================================
      // Stickers podem ser identificados por múltiplas propriedades:
      // - data._data?.Info?.MediaType === 'sticker'
      // - data._data?.Message?.stickerMessage (objeto presente)
      // - data.type === 'sticker'
      // - data._data?.isSticker === true
      const isSticker = 
        data._data?.Info?.MediaType === 'sticker' ||
        data._data?.Message?.stickerMessage !== undefined ||
        data.type === 'sticker' ||
        data._data?.isSticker === true ||
        data.media?.isSticker === true ||
        data._data?.isAnimatedSticker === true;

      if (isSticker) {
        console.log('[WAHA Webhook] 🚫 Sticker/figurinha detectado e ignorado');
        return res.json({ success: true, message: 'Sticker ignored' });
      }
      // =================================================================

      // =================================================================
      // NOVA FUNCIONALIDADE: Salvar/atualizar eleitor imediatamente
      // =================================================================
      
      // DEBUG: Mostrar TODOS os campos do payload antes de processar
      console.log('[WAHA Webhook] 🔍 DEBUG - Payload completo:', JSON.stringify({
        event,
        session,
        'data.from': data.from,
        'data.chatId': data.chatId,
        'data.phone': data.phone,
        'data._data?.Info?.Chat': data._data?.Info?.Chat,
        'data._data?.Info?.Sender': data._data?.Info?.Sender,
        'data._data?.Info?.SenderAlt': data._data?.Info?.SenderAlt,
        'payload.from': payload.from,
        'payload.chatId': payload.chatId,
        'payload.phone': payload.phone,
        'payload.data?.from': payload.data?.from,
        'payload.data?.chatId': payload.data?.chatId,
        'payload.data?.phone': payload.data?.phone,
        'payload.payload?.from': payload.payload?.from,
      }, null, 2));
      
      // Extrair telefone do remetente usando função centralizada
      // IMPORTANTE: Usa hierarquia correta Chat → Sender → from → fromChat (NUNCA SenderAlt!)
      const senderPhone = extractPhoneNumber(data);
      
      // Validar que temos um número válido (mas permitir mensagens de grupo)
      if (!isGroup && (!senderPhone || senderPhone.length < 10)) {
        console.log('[WAHA Clone-Eleitor] ❌ Número inválido ou não extraído, abortando processamento de mensagem individual');
        // Não processar mensagem individual sem número válido
        return res.json({ success: true, message: 'No valid phone number found' });
      }
      
      // LOG: Mostrar payload completo
      console.log(`[WAHA Clone-Eleitor] 📦 Payload recebido:`, JSON.stringify({
        event,
        session,
        from: data.from,
        fromMe: data.fromMe,
        pushName: data.pushName,
        push_name: data.push_name,
        notifyName: data.notifyName,
        notify: data.notify,
        name: data.name,
        _data: data._data
      }, null, 2));
      
      // Processar criação/atualização do eleitor de forma assíncrona (não bloquear)
      if (senderPhone && senderPhone.length >= 10 && !isGroup) {
        
        // Executar de forma assíncrona para não bloquear o webhook
        (async () => {
          try {
            // Extrair nome diretamente do payload do webhook
            // O nome pode estar em diferentes locais dependendo do formato do payload
            let voterName = 
              data._data?.Info?.PushName ||  // Formato WAHA com _data
              data.pushName || 
              data.push_name || 
              data.notifyName || 
              data.notify || 
              data.name || 
              '';
            
            console.log(`[WAHA Clone-Eleitor] 📝 Nome extraído do payload: "${voterName}"`);
            
            // Se não tiver nome no payload, tentar buscar via API
            if (!voterName || voterName.trim() === '') {
              console.log(`[WAHA Clone-Eleitor] ⚠️  Nome não veio no payload, tentando buscar via API...`);
              
              try {
                // Buscar TODAS as instâncias do Clone Agent e tentar com cada uma
                const instances = await storage.getCloneAgentInstances();
                console.log(`[WAHA Clone-Eleitor] Encontradas ${instances.length} instâncias do Clone Agent`);
                
                for (const cloneInstance of instances) {
                  if (cloneInstance?.wahaUrl && cloneInstance?.wahaApiKey && cloneInstance?.wahaSession) {
                    try {
                      const wahaConfig: WahaConfig = {
                        url: cloneInstance.wahaUrl,
                        apiKey: cloneInstance.wahaApiKey,
                        session: cloneInstance.wahaSession
                      };
                      
                      const chatId = phoneToChatId(senderPhone);
                      const contactData = await wahaGetContact(wahaConfig, chatId);
                      
                      const fetchedName = contactData.name || contactData.pushName || contactData.notify || '';
                      if (fetchedName) {
                        voterName = fetchedName;
                        console.log(`[WAHA Clone-Eleitor] ✅ Nome buscado via API: "${voterName}"`);
                        break;
                      }
                    } catch (apiError) {
                      console.log(`[WAHA Clone-Eleitor] Falha ao buscar com instância ${cloneInstance.id}:`, apiError instanceof Error ? apiError.message : 'erro desconhecido');
                      continue;
                    }
                  }
                }
              } catch (contactError) {
                console.error(`[WAHA Clone-Eleitor] ❌ Erro ao buscar nome via API:`, contactError);
              }
            }
            
            // Verificar se o eleitor já existe
            const existingVoter = await storage.getVoterByWhatsapp(senderPhone);
            
            if (existingVoter) {
              
              // Verificar se o nome recebido é melhor que o existente
              if (voterName && isNameBetter(existingVoter.nome, voterName)) {
                
                const updatedVoter = await storage.updateVoter(existingVoter.id, {
                  nome: voterName,
                  nameSource: 'waha-contact'
                });
                
                console.log(`[WAHA Clone-Eleitor] ✅ Nome atualizado: ${senderPhone} -> ${voterName}`);
              } else {
              }
            } else {
              // Criar novo eleitor
              
              // Se não tiver nome, usar um padrão
              let finalName = voterName;
              if (!finalName || finalName.trim() === "") {
                finalName = `Eleitor ${senderPhone.slice(-4)}`;
              }
              
              const newVoter = await storage.createVoter({
                nome: finalName,
                whatsapp: senderPhone,
                municipio: "", // Será preenchido posteriormente
                indicacao: "Agente Clone", // Indicação padrão para eleitores criados via Clone Agent
                voto: "neutro", // Status inicial
                material: "sem_material" // Status inicial
              });
              
              console.log(`[WAHA Clone-Eleitor] ✅ Novo eleitor criado: ${senderPhone} -> ${finalName}`);
            }
          } catch (error) {
            // Não bloquear o processamento mesmo se houver erro
            if (error instanceof DuplicateWhatsAppError) {
            } else {
              console.error(`[WAHA Clone-Eleitor] Erro ao processar eleitor:`, error);
            }
          }
        })();
      } else if (!isGroup) {
      }
      
      // =================================================================
      // FIM DA NOVA FUNCIONALIDADE
      // =================================================================

      // =================================================================
      // BRANCHING: PROCESSAR GRUPOS vs MENSAGENS INDIVIDUAIS
      // =================================================================
      if (isGroup) {
        // =================================================================
        // PROCESSAR MENSAGENS DE GRUPOS PARA AGENTES MILITANTES
        // =================================================================
        console.log(`[Militant Agent Webhook] 🔍 Mensagem de GRUPO detectada: ${fromChat}`);
        (async () => {
          try {
            // Extrair conteúdo da mensagem
            const textContent = data.body || data.text || data.message || 
                              data._data?.Message?.conversation || '';
            
            console.log(`[Militant Agent Webhook] 📝 Conteúdo extraído: "${textContent?.substring(0, 100)}..."`);
            
            if (!textContent) {
              console.log('[Militant Agent Webhook] ❌ Mensagem de grupo sem texto, ignorada');
              return;
            }

            // Extrair informações do remetente
            const senderPhone = data._data?.Info?.Sender?.split('@')[0] || 
                              data._data?.Info?.SenderAlt?.split('@')[0] ||  // Corrigido: usar @ ao invés de :
                              data.author?.split('@')[0] || 
                              '';
            const senderName = data._data?.Info?.PushName || 
                             data.pushName || 
                             data.push_name || 
                             data.notifyName || 
                             'Usuário';
            
            // Extrair informações do grupo
            const groupId = fromChat; // Já está no formato correto (ex: 120363421745783332@g.us)
            
            // Tentar extrair nome do grupo dos dados
            let groupName = data._data?.Info?.Chat || 
                          data.chatName || 
                          data.chat?.name || 
                          'Grupo';
            
            // Se o nome do grupo vier como ID, buscar nome real
            if (groupName.includes('@g.us') || !groupName || groupName === 'Grupo') {
              // Buscar agentes militantes ativos para usar suas credenciais WAHA
              const allAgents = await storage.getMilitantAgents();
              const activeAgents = allAgents.filter(a => a.isActive);
              
              if (activeAgents.length > 0) {
                // Usar credenciais do primeiro agente ativo para buscar info do grupo
                const firstAgent = activeAgents[0];
                try {
                  const wahaConfig: WahaConfig = {
                    url: firstAgent.wahaUrl,
                    apiKey: firstAgent.wahaApiKey,
                    session: firstAgent.wahaSession
                  };
                  const groupInfo = await wahaGetGroup(wahaConfig, groupId);
                  groupName = groupInfo.name || groupInfo.subject || groupName;
                } catch (error) {
                  console.log('[Militant Agent Webhook] Erro ao buscar nome do grupo:', error instanceof Error ? error.message : 'erro desconhecido');
                }
              }
            }

            console.log(`[Militant Agent Webhook] 📨 Mensagem de grupo recebida: ${groupName} (${groupId})`);
            console.log(`[Militant Agent Webhook] 👤 Remetente: ${senderName} (${senderPhone})`);
            console.log(`[Militant Agent Webhook] 💬 Mensagem: "${textContent.substring(0, 100)}..."`);

            // Buscar todos os agentes militantes ativos
            const agents = await storage.getMilitantAgents();
            const activeAgents = agents.filter(agent => agent.isActive);

            if (activeAgents.length === 0) {
              console.log('[Militant Agent Webhook] Nenhum agente militante ativo encontrado');
              return;
            }

            console.log(`[Militant Agent Webhook] 🔍 Verificando ${activeAgents.length} agente(s) ativo(s)`);

            // Para cada agente ativo, verificar se monitora este grupo
            for (const agent of activeAgents) {
              try {
                // Parsear lista de grupos do agente
                const agentGroups = JSON.parse(agent.groups || '[]') as Array<{id: string, name: string, active: boolean}>;
                
                // Verificar se o grupo está na lista e está ativo
                const monitoredGroup = agentGroups.find(g => g.id === groupId && g.active);
                
                if (monitoredGroup) {
                  console.log(`[Militant Agent Webhook] ✅ Agente "${agent.name}" monitora este grupo, adicionando à fila`);
                  
                  // Buscar agente completo para pegar messageCollectionTime
                  const fullAgent = await storage.getMilitantAgent(agent.id);
                  if (!fullAgent) {
                    console.error(`[Militant Agent Webhook] ❌ Agente ${agent.id} não encontrado`);
                    continue;
                  }
                  const collectionTime = fullAgent.messageCollectionTime || 30;
                  const collectionEndTime = new Date(Date.now() + (collectionTime * 1000));

                  // Criar mensagem no formato do buffer temporal (mesmo formato do clone agent)
                  const message = {
                    body: textContent,
                    timestamp: data.timestamp || Date.now(),
                    pushName: senderName,
                    fromMe: data.fromMe || data.from_me || false,
                    from: senderPhone
                  };

                  // Adicionar à fila de mensagens com buffer temporal
                  await storage.createOrUpdateMilitantMessageQueue({
                    agentId: agent.id,
                    groupId: groupId,
                    groupName: groupName,
                    messages: JSON.stringify([message]),
                    status: 'collecting',
                    collectionEndTime
                  });

                  console.log(`[Militant Agent Webhook] 📥 Mensagem adicionada ao buffer temporal do agente "${agent.name}"`);
                  
                  await storage.appendMilitantAgentLog(
                    agent.id,
                    `📥 Nova mensagem em ${groupName}: "${textContent.substring(0, 50)}..."`
                  );
                } else {
                  console.log(`[Militant Agent Webhook] ⏭️  Agente "${agent.name}" não monitora este grupo`);
                }
              } catch (error) {
                console.error(`[Militant Agent Webhook] ❌ Erro ao processar agente ${agent.name}:`, error);
              }
            }
          } catch (error) {
            console.error('[Militant Agent Webhook] ❌ Erro ao processar mensagem de grupo para agentes militantes:', error);
          }
        })();
        
        // Responder rapidamente ao WAHA para mensagens de grupo
        return res.json({ success: true, message: 'Group message processed' });
      } else {
        // =================================================================
        // PROCESSAR CLONE AGENT PARA MENSAGENS INDIVIDUAIS
        // =================================================================
        // Normalizar mensagem para o formato esperado pelo Clone Agent
        const phoneNumber = extractPhoneNumber(data);
        
        // Se não tiver número válido, não processar a mensagem
        if (!phoneNumber || phoneNumber.length < 10) {
          console.log('[Clone Agent] ❌ Sem número válido para processar mensagem');
          return res.json({ success: true, message: 'No valid phone number for Clone Agent' });
        }
        
        const normalizedMessage: any = {
          messageId: data.id || '',
          instanceId: session || '',
          phone: phoneNumber,
          senderName: data._data?.Info?.PushName || data.pushName || data.push_name || data.notifyName || '',
          timestamp: data.timestamp || Date.now(),
          isGroup: false,
          fromMe: fromMe
        };

        // Extrair conteúdo baseado no tipo
        if (data.hasMedia && data.media) {
          // Verificar se tem URL de mídia válida
          if (!data.media.url) {
            return res.json({ success: true, message: 'Invalid media message ignored' });
          }
          const mimetype = data.media.mimetype || '';
          const mediaUrl = data.media.url;
          const filename = data.media.filename || 'arquivo';
          const caption = data.body || data.text || '';

          if (mimetype.startsWith('image/')) {
            normalizedMessage.image = { url: mediaUrl, caption: caption };
          } else if (mimetype.startsWith('audio/')) {
            normalizedMessage.audio = { url: mediaUrl };
          } else if (mimetype.startsWith('application/') || mimetype === 'application/pdf') {
            normalizedMessage.document = { url: mediaUrl, filename: filename };
          } else if (mimetype.startsWith('video/')) {
            normalizedMessage.document = { url: mediaUrl, filename: filename };
          } else {
            normalizedMessage.document = { url: mediaUrl, filename: filename };
          }
          
          if (caption) {
            normalizedMessage.text = { message: caption };
          }
        } else {
          const textContent = data.body || data.text || data.message || '';
          if (textContent) {
            normalizedMessage.text = { message: textContent };
          } else {
            return res.json({ success: true, message: 'Empty message ignored' });
          }
        }

        // Processar mensagem de forma assíncrona (não bloquear o webhook)
        processWhatsAppMessage(normalizedMessage).catch(error => {
          console.error('[WAHA Webhook Clone] Erro ao processar mensagem:', error);
        });
        
        // Responder rapidamente ao WAHA para mensagens individuais
        return res.json({ success: true, message: 'Individual message processed' });
      }
      // =================================================================
      // FIM DO BRANCHING GRUPOS vs INDIVIDUAIS
      // =================================================================
    } catch (error) {
      console.error('[WAHA Webhook Clone] Erro ao processar webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Instagram Agents endpoints
  app.get("/api/instagram-agents", async (req, res) => {
    try {
      const agents = await storage.getInstagramAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching Instagram agents:", error);
      res.status(500).json({ message: "Failed to fetch Instagram agents" });
    }
  });

  app.post("/api/instagram-agents", async (req, res) => {
    try {
      const validatedData = insertInstagramAgentSchema.parse(req.body);
      const agent = await storage.upsertInstagramAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error upserting Instagram agent:", error);
      res.status(400).json({ message: "Invalid Instagram agent data" });
    }
  });

  app.patch("/api/instagram-agents/:id", async (req, res) => {
    try {
      const agent = await storage.getInstagramAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Instagram agent not found" });
      }
      
      const validatedData = insertInstagramAgentSchema.partial().parse(req.body);
      const updatedAgent = await storage.updateInstagramAgent(req.params.id, validatedData);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating Instagram agent:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update Instagram agent" });
    }
  });

  app.post("/api/instagram-agents/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      // Guard: only allow activation when Replicador instance exists and is active
      if (isActive) {
        try {
          const replicadorInstance = await storage.getReplicadorAgentInstance();
          if (!replicadorInstance || !replicadorInstance.isActive) {
            return res.status(400).json({
              message: "Instância do Agente Replicador não configurada ou inativa. Configure e ative a instância antes de ativar agentes.",
            });
          }
        } catch (err) {
          console.error("Error checking Replicador instance before activation:", err);
          return res.status(500).json({ message: "Failed to validate Replicador instance" });
        }
      }
      const agent = await storage.toggleInstagramAgent(req.params.id, isActive);
      
      if (isActive) {
        const result = await runInstagramAgentWorkflow(
          agent.id, 
          agent.instagramUrl, 
          agent.whatsappRecipient,
          agent.personName || "",
          agent.personInstagram || "",
          agent.lastPostId,
          agent.lastRunAt,
          storage
        );
        
        if (result.success) {
          const updatedAgent = await storage.updateLastRun(agent.id, result.postId || null, new Date());
          return res.json(updatedAgent);
        } else {
          console.error(`Error running workflow on activation: ${result.error}`);
        }
      }
      
      res.json(agent);
    } catch (error) {
      console.error("Error toggling Instagram agent:", error);
      res.status(500).json({ message: "Failed to toggle Instagram agent" });
    }
  });

  app.delete("/api/instagram-agents/:id", async (req, res) => {
    try {
      const success = await storage.deleteInstagramAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Instagram agent not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting Instagram agent:", error);
      res.status(500).json({ message: "Failed to delete Instagram agent" });
    }
  });

  app.post("/api/instagram-agents/:id/run", async (req, res) => {
    try {
      const agent = await storage.getInstagramAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Instagram agent not found" });
      }

      const result = await runInstagramAgentWorkflow(
        req.params.id, 
        agent.instagramUrl, 
        agent.whatsappRecipient,
        agent.personName || "",
        agent.personInstagram || "",
        agent.lastPostId,
        agent.lastRunAt,
        storage
      );
      
      if (result.success) {
        const updatedAgent = await storage.updateLastRun(req.params.id, result.postId || null, new Date());
        res.json({ success: true, agent: updatedAgent, postId: result.postId });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error running Instagram agent:", error);
      res.status(500).json({ message: "Failed to run Instagram agent", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // TESTE TEMPORÁRIO: Enviar mensagem de teste para verificar se WAHA funciona para contatos individuais
  app.post("/api/test/send-whatsapp", async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      // Get WAHA instance from Replicador Agent
      const instance = await storage.getReplicadorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        return res.status(500).json({ message: "WAHA credentials not configured. Please configure the Replicador Agent instance first." });
      }

      const wahaConfig: WahaConfig = {
        url: instance.wahaUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      const chatId = phoneToChatId(phoneNumber);
      const textMessage = message || "🧪 Mensagem de teste do Agente Replicador. Se você recebeu esta mensagem, a integração WAHA está funcionando corretamente!";
      
      const response = await wahaSendText(wahaConfig, {
        chatId,
        text: textMessage
      });
      
      res.json({ 
        success: true, 
        message: "Mensagem enviada com sucesso!",
        chatId,
        response 
      });
    } catch (error) {
      console.error("[TEST] Error sending test message:", error);
      res.status(500).json({ 
        message: "Failed to send test message", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Collect voters from WhatsApp group
  app.post("/api/whatsapp/collect-voters", async (req, res) => {
    try {
      const { groupId, indicacao, municipio, bairro } = req.body;
      
      if (!groupId) {
        return res.status(400).json({ message: "Group ID is required" });
      }

      if (!indicacao) {
        return res.status(400).json({ message: "Indicação is required" });
      }

      if (!municipio) {
        return res.status(400).json({ message: "Município is required" });
      }

      // Get WAHA instance from Coletor Agent
      const instance = await storage.getColetorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        return res.status(500).json({ message: "WAHA credentials not configured. Please configure the Coletor Agent instance first." });
      }

      const wahaConfig: WahaConfig = {
        url: instance.wahaUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      // Convert groupId to WAHA format
      const wahaGroupId = groupIdToWaha(groupId);

      // Fetch group participants from WAHA
      const participants = await wahaGetGroupParticipants(wahaConfig, wahaGroupId);
      
      // Identify participants that need contact lookup
      const phonesNeedingLookup: string[] = [];
      for (const participant of participants) {
        const phone = participant.id?.replace(/@.*$/, '') || '';
        // WAHA participants have name fields: pushName, name, notify
        const hasName = participant.pushName || participant.name || participant.notify;
        if (!hasName && phone && phone.length >= 10) {
          phonesNeedingLookup.push(phone);
        }
      }

      // Fetch missing contact data in batch
      let contactLookups = new Map<string, string>();
      if (phonesNeedingLookup.length > 0) {
        contactLookups = await fetchContactDataBatch(phonesNeedingLookup, wahaConfig);
      }
      
      // Process and save voters
      let savedCount = 0;

      for (const participant of participants) {
        // Extract phone number from WAHA participant ID (format: 5511999999999@c.us)
        const phone = participant.id?.replace(/@.*$/, '') || '';
        
        // Extract name from WAHA participant fields in order of priority
        // Priority: pushName > name > notify
        let nome = participant.pushName ||  // User's WhatsApp profile name (most reliable!)
                   participant.name ||       // Full name
                   participant.notify ||     // Name saved in contacts
                   '';
        
        // Determine the source of the name for logging
        const nameSource = participant.pushName ? 'pushName' :
                          participant.name ? 'name' :
                          participant.notify ? 'notify' : 'none';
        
        // If no name in metadata, check batch lookup results
        if (!nome && phone) {
          nome = contactLookups.get(phone) || '';
          if (nome) {
          }
        }
        
        // Final fallback: use placeholder
        if (!nome) {
          nome = `Novo Membro ${phone.slice(-4)}`;
        } else if (nameSource !== 'none') {
        }
        
        if (!phone || phone.length < 10) continue;

        try {
          // Check if voter already exists
          const existingVoter = await storage.getVoterByWhatsapp(phone);
          
          if (!existingVoter) {
            await storage.createVoter({
              nome,
              whatsapp: phone,
              voto: "em_progresso",
              material: "sem_material",
              municipio,
              bairro: bairro || "",
              indicacao,
            });
            savedCount++;
          } else {
            // Update voter name if the new one is better/more complete
            if (isNameBetter(existingVoter.nome, nome)) {
              await storage.updateVoter(existingVoter.id, { nome });
            }
          }
        } catch (error) {
          console.error(`Error saving voter ${nome}:`, error);
        }
      }

      res.json({ 
        success: true, 
        count: savedCount,
        message: `${savedCount} novos eleitores cadastrados de ${participants.length} participantes encontrados`
      });
    } catch (error) {
      console.error("Error collecting voters:", error);
      res.status(500).json({ 
        message: "Failed to collect voters", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Collector Agents endpoints
  app.get("/api/collector-agents", async (req, res) => {
    try {
      const agents = await storage.getCollectorAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching collector agents:", error);
      res.status(500).json({ message: "Failed to fetch collector agents" });
    }
  });

  app.post("/api/collector-agents", async (req, res) => {
    try {
      const validatedData = insertCollectorAgentSchema.parse(req.body);
      const agent = await storage.upsertCollectorAgent(validatedData);
      res.json(agent);
    } catch (error) {
      console.error("Error creating/updating collector agent:", error);
      res.status(500).json({ message: "Failed to create/update collector agent" });
    }
  });

  app.patch("/api/collector-agents/:id", async (req, res) => {
    try {
      const agent = await storage.getCollectorAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Collector agent not found" });
      }
      
      const validatedData = insertCollectorAgentSchema.partial().parse(req.body);
      const updatedAgent = await storage.updateCollectorAgent(req.params.id, validatedData);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating Collector agent:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update Collector agent" });
    }
  });

  app.post("/api/collector-agents/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      await storage.toggleCollectorAgent(req.params.id, isActive);
      
      // If agent is being activated, run it immediately
      if (isActive) {
        const { runCollectorAgentWorkflow } = await import("./workflows/collector-agent");
        try {
          await runCollectorAgentWorkflow(req.params.id);
        } catch (runError) {
          console.error("Error running agent immediately:", runError);
          // Continue even if immediate run fails - the scheduled task will retry
        }
      }
      
      // Fetch updated agent after workflow execution
      const updatedAgent = await storage.getCollectorAgent(req.params.id);
      res.json(updatedAgent);
    } catch (error) {
      console.error("Error toggling collector agent:", error);
      res.status(500).json({ message: "Failed to toggle collector agent" });
    }
  });

  app.delete("/api/collector-agents/:id", async (req, res) => {
    try {
      const success = await storage.deleteCollectorAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Collector agent not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting collector agent:", error);
      res.status(500).json({ message: "Failed to delete collector agent" });
    }
  });


  app.post("/api/collector-agents/:id/run", async (req, res) => {
    try {
      const agent = await storage.getCollectorAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Collector agent not found" });
      }

      // Get WAHA instance from Coletor Agent
      const instance = await storage.getColetorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        await storage.appendCollectorExecutionLog(agent.id, "❌ WAHA credentials not configured");
        return res.status(500).json({ message: "WAHA credentials not configured" });
      }

      const wahaConfig: WahaConfig = {
        url: instance.wahaUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      // Convert groupId to WAHA format
      const wahaGroupId = groupIdToWaha(agent.groupId);

      // Fetch group participants from WAHA
      const participants = await wahaGetGroupParticipants(wahaConfig, wahaGroupId);
      const currentMemberCount = participants.length;
      
      // Use the ID field as unique identifier (format: phone@c.us or phone@g.us)
      const currentMemberIds = participants.map((p: any) => p.id?.replace(/@.*$/, '') || '').filter(Boolean);
      
      // Get previously processed member IDs
      const previousMemberIds = agent.lastProcessedMemberIds 
        ? JSON.parse(agent.lastProcessedMemberIds) 
        : [];
      
      // Find new members by comparing IDs (members that exist now but weren't in previous run)
      const newMemberIds = currentMemberIds.filter((id: string) => !previousMemberIds.includes(id));

      if (newMemberIds.length === 0) {
        await storage.appendCollectorExecutionLog(agent.id, `✅ Verificado: ${currentMemberCount} membros (nenhum novo)`);
        await storage.updateCollectorLastRun(agent.id, currentMemberCount, currentMemberIds, new Date());
        return res.json({ 
          success: true, 
          newVoters: 0, 
          totalMembers: currentMemberCount,
          message: "Nenhum novo membro encontrado"
        });
      }

      // Process only new members
      let savedCount = 0;
      const newMembers = participants.filter((p: any) => {
        const phone = p.id?.replace(/@.*$/, '') || '';
        return newMemberIds.includes(phone);
      });

      // Identify new members that need contact lookup
      const phonesNeedingLookup: string[] = [];
      for (const participant of newMembers) {
        const phone = participant.id?.replace(/@.*$/, '') || '';
        // WAHA participants have name fields: pushName, name, notify
        const hasName = participant.pushName || participant.name || participant.notify;
        if (!hasName && phone && phone.length >= 10) {
          phonesNeedingLookup.push(phone);
        }
      }

      // Fetch missing contact data in batch
      let contactLookups = new Map<string, string>();
      if (phonesNeedingLookup.length > 0) {
        contactLookups = await fetchContactDataBatch(phonesNeedingLookup, wahaConfig);
      }

      for (const participant of newMembers) {
        const phone = participant.id?.replace(/@.*$/, '') || '';
        
        // Extract name from WAHA participant fields in order of priority
        // Priority: pushName > name > notify
        let nome = participant.pushName ||  // User's WhatsApp profile name (most reliable!)
                   participant.name ||       // Full name
                   participant.notify ||     // Name saved in contacts
                   '';
        
        // Determine the source of the name for logging
        const nameSource = participant.pushName ? 'pushName' :
                          participant.name ? 'name' :
                          participant.notify ? 'notify' : 'none';
        
        // If no name in metadata, check batch lookup results
        if (!nome && phone) {
          nome = contactLookups.get(phone) || '';
          if (nome) {
          }
        }
        
        // Final fallback: use placeholder
        if (!nome) {
          nome = `Novo Membro ${phone.slice(-4)}`;
        } else if (nameSource !== 'none') {
        }
        
        if (!phone || phone.length < 10) {
          continue;
        }

        try {
          const existingVoter = await storage.getVoterByWhatsapp(phone);
          
          if (!existingVoter) {
            await storage.createVoter({
              nome,
              whatsapp: phone,
              voto: "em_progresso",
              material: "sem_material",
              municipio: agent.municipio,
              bairro: agent.bairro || "",
              indicacao: agent.indicacao,
            });
            savedCount++;
          } else {
            // Update voter name if the new one is better/more complete
            if (isNameBetter(existingVoter.nome, nome)) {
              await storage.updateVoter(existingVoter.id, { nome });
            }
          }
        } catch (error) {
          console.error(`Error saving voter ${nome}:`, error);
        }
      }

      await storage.appendCollectorExecutionLog(
        agent.id, 
        `✅ ${savedCount} novos eleitores cadastrados de ${newMemberIds.length} novos membros`
      );
      await storage.updateCollectorLastRun(agent.id, currentMemberCount, currentMemberIds, new Date());

      res.json({ 
        success: true, 
        newVoters: savedCount,
        totalMembers: currentMemberCount,
        message: `${savedCount} novos eleitores cadastrados`
      });
    } catch (error) {
      console.error("Error running collector agent:", error);
      const agent = await storage.getCollectorAgent(req.params.id);
      if (agent) {
        await storage.appendCollectorExecutionLog(agent.id, `Erro: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      res.status(500).json({ 
        message: "Failed to run collector agent", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post("/api/collector-agents/:id/reset", async (req, res) => {
    try {
      const agent = await storage.getCollectorAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Collector agent not found" });
      }

      // Reset lastProcessedMemberIds to empty array
      await storage.updateCollectorAgent(req.params.id, {
        lastProcessedMemberIds: "[]",
        lastMemberCount: 0
      });

      await storage.appendCollectorExecutionLog(
        req.params.id, 
        "🔄 Agente resetado - todos os membros serão reprocessados na próxima execução"
      );

      // If agent is active, run workflow immediately to process all members
      if (agent.isActive) {
        try {
          const { runCollectorAgentWorkflow } = await import("./workflows/collector-agent");
          await runCollectorAgentWorkflow(req.params.id);
        } catch (runError) {
          console.error("Error running agent after reset:", runError);
        }
      }

      const updatedAgent = await storage.getCollectorAgent(req.params.id);
      res.json({ 
        success: true, 
        agent: updatedAgent,
        message: "Agente resetado com sucesso"
      });
    } catch (error) {
      console.error("Error resetting collector agent:", error);
      res.status(500).json({ 
        message: "Failed to reset collector agent", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Clone Agent Config endpoints (Singleton)
  app.get("/api/clone-agent/config", async (req, res) => {
    try {
      const config = await storage.getCloneAgentConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching clone agent config:", error);
      res.status(500).json({ message: "Failed to fetch clone agent config" });
    }
  });

  app.post("/api/clone-agent/config", async (req, res) => {
    try {
      const validatedData = insertCloneAgentConfigSchema.parse(req.body);
      
      // Validação: Garantir tempo mínimo de coleta de 30 segundos
      if (validatedData.messageCollectionTime !== undefined && validatedData.messageCollectionTime < 30) {
        return res.status(400).json({ 
          message: "O tempo de coleta deve ser de no mínimo 30 segundos",
          error: "messageCollectionTime deve ser >= 30"
        });
      }
      
      const config = await storage.createCloneAgentConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating clone agent config:", error);
      res.status(400).json({ message: "Invalid clone agent config data" });
    }
  });

  app.patch("/api/clone-agent/config", async (req, res) => {
    try {
      const config = await storage.getCloneAgentConfig();
      if (!config) {
        return res.status(404).json({ message: "Clone agent config not found" });
      }
      const validatedData = insertCloneAgentConfigSchema.partial().parse(req.body);
      
      // Validação: Garantir tempo mínimo de coleta de 30 segundos
      if (validatedData.messageCollectionTime !== undefined && validatedData.messageCollectionTime < 30) {
        return res.status(400).json({ 
          message: "O tempo de coleta deve ser de no mínimo 30 segundos",
          error: "messageCollectionTime deve ser >= 30"
        });
      }
      
      const updatedConfig = await storage.updateCloneAgentConfig(config.id, validatedData);
      res.json(updatedConfig);
    } catch (error) {
      console.error("Error updating clone agent config:", error);
      res.status(500).json({ message: "Failed to update clone agent config" });
    }
  });

  // Replicador Agent Instance endpoints
  app.get("/api/replicador-agent/instance", async (req, res) => {
    try {
      const instance = await storage.getReplicadorAgentInstance();
      res.json(instance);
    } catch (error) {
      console.error("Error fetching replicador agent instance:", error);
      res.status(500).json({ message: "Failed to fetch replicador agent instance" });
    }
  });

  // Get WhatsApp groups from Replicador Agent instance
  app.get("/api/replicador-agent/groups", async (req, res) => {
    try {
      // First, get the replicador instance to get its credentials
      const instance = await storage.getReplicadorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        return res.json({ groups: [], error: null });
      }

      // Normalize URL by removing trailing slash
      const normalizedUrl = instance.wahaUrl.replace(/\/+$/, '');

      const wahaConfig: WahaConfig = {
        url: normalizedUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      // Fetch groups from WAHA
      const wahaGroups = await wahaGetGroups(wahaConfig, { limit: 100 });
      
      // Map WAHA groups to expected format
      // WAHA API returns groups with 'JID' (group ID) and 'Name' (group name) fields
      const groups = wahaGroups
        .filter((group: any) => group.Name || group.name || group.subject) // Filter by Name (uppercase) or fallbacks
        .map((group: any) => ({
          id: group.JID || group.id,  // JID is the correct field for group ID
          name: group.Name || group.name || group.subject || 'Unnamed Group'  // Name is the correct field
        }));

      res.json({ groups, error: null });
    } catch (error: any) {
      console.error("Error fetching WhatsApp groups for Replicador Agent:", error);
      
      // Detect authentication errors
      let errorMessage = "Erro ao buscar grupos do WhatsApp.";
      if (error.message?.includes("401") || error.message?.includes("WAHA API error (401)")) {
        errorMessage = "Erro de autenticação WAHA. Verifique se a API Key e a Sessão estão corretas.";
      } else if (error.message?.includes("ECONNREFUSED") || error.message?.includes("ENOTFOUND")) {
        errorMessage = "Não foi possível conectar à API WAHA. Verifique se a URL está correta e se o serviço está ativo.";
      }
      
      res.json({ groups: [], error: errorMessage });
    }
  });

  app.post("/api/replicador-agent/instance", async (req, res) => {
    try {
      const validatedData = insertReplicadorAgentInstanceSchema.parse(req.body);
      const instance = await storage.createReplicadorAgentInstance(validatedData);
      res.status(201).json(instance);
    } catch (error: any) {
      console.error("Error creating replicador agent instance:", error);
      
      if (error.message?.includes("Já existe uma instância")) {
        res.status(400).json({ message: error.message });
      } else if (error.name === 'ZodError') {
        // Provide more specific Zod validation error messages
        const issues = error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
        res.status(400).json({ message: `Dados inválidos: ${issues || 'Erro de validação'}` });
      } else {
        res.status(400).json({ message: error.message || "Invalid replicador agent instance data" });
      }
    }
  });

  app.patch("/api/replicador-agent/instance/:id", async (req, res) => {
    try {
      const validatedData = insertReplicadorAgentInstanceSchema.partial().parse(req.body);
      const instance = await storage.updateReplicadorAgentInstance(req.params.id, validatedData);
      res.json(instance);
    } catch (error) {
      console.error("Error updating replicador agent instance:", error);
      res.status(500).json({ message: "Failed to update replicador agent instance" });
    }
  });

  app.patch("/api/replicador-agent/instance/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      const instance = await storage.toggleReplicadorAgentInstance(req.params.id, isActive);
      res.json(instance);
    } catch (error) {
      console.error("Error toggling replicador agent instance:", error);
      res.status(500).json({ message: "Failed to toggle replicador agent instance" });
    }
  });

  app.delete("/api/replicador-agent/instance/:id", async (req, res) => {
    try {
      const success = await storage.deleteReplicadorAgentInstance(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Replicador agent instance not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting replicador agent instance:", error);
      res.status(500).json({ message: "Failed to delete replicador agent instance" });
    }
  });

  // Coletor Agent Instance endpoints
  app.get("/api/coletor-agent/instance", async (req, res) => {
    try {
      const instance = await storage.getColetorAgentInstance();
      res.json(instance);
    } catch (error) {
      console.error("Error fetching coletor agent instance:", error);
      res.status(500).json({ message: "Failed to fetch coletor agent instance" });
    }
  });

  // Get WhatsApp groups from Coletor Agent instance
  app.get("/api/coletor-agent/groups", async (req, res) => {
    try {
      // First, get the coletor instance to get its credentials
      const instance = await storage.getColetorAgentInstance();
      
      if (!instance || !instance.wahaUrl || !instance.wahaApiKey || !instance.wahaSession) {
        return res.json({ groups: [], error: null });
      }

      // Normalize URL by removing trailing slash
      const normalizedUrl = instance.wahaUrl.replace(/\/+$/, '');

      const wahaConfig: WahaConfig = {
        url: normalizedUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession
      };

      // Fetch groups from WAHA
      const wahaGroups = await wahaGetGroups(wahaConfig, { limit: 100 });
      
      // Map WAHA groups to expected format
      // WAHA API returns groups with 'JID' (group ID) and 'Name' (group name) fields
      const groups = wahaGroups
        .filter((group: any) => group.Name || group.name || group.subject) // Filter by Name (uppercase) or fallbacks
        .map((group: any) => ({
          id: group.JID || group.id,  // JID is the correct field for group ID
          name: group.Name || group.name || group.subject || 'Unnamed Group'  // Name is the correct field
        }));

      res.json({ groups, error: null });
    } catch (error: any) {
      console.error("Error fetching WhatsApp groups for Coletor Agent:", error);
      
      // Detect authentication errors
      let errorMessage = "Erro ao buscar grupos do WhatsApp.";
      if (error.message?.includes("401") || error.message?.includes("WAHA API error (401)")) {
        errorMessage = "Erro de autenticação WAHA. Verifique se a API Key e a Sessão estão corretas.";
      } else if (error.message?.includes("ECONNREFUSED") || error.message?.includes("ENOTFOUND")) {
        errorMessage = "Não foi possível conectar à API WAHA. Verifique se a URL está correta e se o serviço está ativo.";
      }
      
      res.json({ groups: [], error: errorMessage });
    }
  });
  // Get WhatsApp groups from a specific Militant Agent (uses agent's WAHA credentials)
  app.get("/api/militant-agents/:id/groups", async (req, res) => {
    try {
      const agentId = req.params.id;
      const agent = await storage.getMilitantAgent(agentId);

      if (!agent) {
        return res.status(404).json({ message: "Militant agent not found" });
      }

      // Only attempt to fetch groups if the agent is active and has all WAHA credentials
      if (!agent.isActive || !agent.wahaUrl || !agent.wahaApiKey || !agent.wahaSession) {
        return res.json([]);
      }

      const wahaConfig: WahaConfig = {
        url: agent.wahaUrl,
        apiKey: agent.wahaApiKey,
        session: agent.wahaSession
      };

      // Fetch groups from WAHA
      const wahaGroups = await wahaGetGroups(wahaConfig, { limit: 100 });

      const groups = wahaGroups
        .filter((group: any) => group.Name || group.name || group.subject)
        .map((group: any) => ({
          id: group.JID || group.id,
          name: group.Name || group.name || group.subject || 'Unnamed Group'
        }));

      res.json(groups);
    } catch (error) {
      console.error("Error fetching WhatsApp groups from WAHA (Militant):", error);
      res.json([]);
    }
  });

  app.post("/api/coletor-agent/instance", async (req, res) => {
    try {
      const validatedData = insertColetorAgentInstanceSchema.parse(req.body);
      const instance = await storage.createColetorAgentInstance(validatedData);
      res.status(201).json(instance);
    } catch (error: any) {
      console.error("Error creating coletor agent instance:", error);
      if (error.message?.includes("Já existe uma instância")) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid coletor agent instance data" });
      }
    }
  });

  app.patch("/api/coletor-agent/instance/:id", async (req, res) => {
    try {
      const validatedData = insertColetorAgentInstanceSchema.partial().parse(req.body);
      const instance = await storage.updateColetorAgentInstance(req.params.id, validatedData);
      res.json(instance);
    } catch (error) {
      console.error("Error updating coletor agent instance:", error);
      res.status(500).json({ message: "Failed to update coletor agent instance" });
    }
  });

  app.patch("/api/coletor-agent/instance/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      const instance = await storage.toggleColetorAgentInstance(req.params.id, isActive);
      res.json(instance);
    } catch (error) {
      console.error("Error toggling coletor agent instance:", error);
      res.status(500).json({ message: "Failed to toggle coletor agent instance" });
    }
  });

  app.delete("/api/coletor-agent/instance/:id", async (req, res) => {
    try {
      const success = await storage.deleteColetorAgentInstance(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Coletor agent instance not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting coletor agent instance:", error);
      res.status(500).json({ message: "Failed to delete coletor agent instance" });
    }
  });

  // Clone Agent Instances endpoints
  app.get("/api/clone-agent/instances", async (req, res) => {
    try {
      const instances = await storage.getCloneAgentInstances();
      res.json(instances);
    } catch (error) {
      console.error("Error fetching clone agent instances:", error);
      res.status(500).json({ message: "Failed to fetch clone agent instances" });
    }
  });

  app.get("/api/clone-agent/instances/:id", async (req, res) => {
    try {
      const instance = await storage.getCloneAgentInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Clone agent instance not found" });
      }
      res.json(instance);
    } catch (error) {
      console.error("Error fetching clone agent instance:", error);
      res.status(500).json({ message: "Failed to fetch clone agent instance" });
    }
  });

  app.post("/api/clone-agent/instances", async (req, res) => {
    try {
      const validatedData = insertCloneAgentInstanceSchema.parse(req.body);
      const instance = await storage.createCloneAgentInstance(validatedData);
      res.status(201).json(instance);
    } catch (error) {
      console.error("Error creating clone agent instance:", error);
      res.status(400).json({ message: "Invalid clone agent instance data" });
    }
  });

  app.patch("/api/clone-agent/instances/:id", async (req, res) => {
    try {
      const validatedData = insertCloneAgentInstanceSchema.partial().parse(req.body);
      const instance = await storage.updateCloneAgentInstance(req.params.id, validatedData);
      res.json(instance);
    } catch (error) {
      console.error("Error updating clone agent instance:", error);
      res.status(500).json({ message: "Failed to update clone agent instance" });
    }
  });

  app.patch("/api/clone-agent/instances/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      const instance = await storage.toggleCloneAgentInstance(req.params.id, isActive);
      res.json(instance);
    } catch (error) {
      console.error("Error toggling clone agent instance:", error);
      res.status(500).json({ message: "Failed to toggle clone agent instance" });
    }
  });

  app.delete("/api/clone-agent/instances/:id", async (req, res) => {
    try {
      const success = await storage.deleteCloneAgentInstance(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Clone agent instance not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting clone agent instance:", error);
      res.status(500).json({ message: "Failed to delete clone agent instance" });
    }
  });

  // Clone Agent Knowledge endpoints (uses configId)
  app.get("/api/clone-agent/knowledge", async (req, res) => {
    try {
      const config = await storage.getCloneAgentConfig();
      if (!config) {
        return res.status(404).json({ message: "Clone agent config not found" });
      }
      const knowledge = await storage.getCloneAgentKnowledge(config.id);
      res.json(knowledge);
    } catch (error) {
      console.error("Error fetching clone agent knowledge:", error);
      res.status(500).json({ message: "Failed to fetch knowledge" });
    }
  });

  app.post("/api/clone-agent/knowledge", async (req, res) => {
    try {
      const config = await storage.getCloneAgentConfig();
      if (!config) {
        return res.status(404).json({ message: "Clone agent config not found. Create config first." });
      }

      // Validate request body with Zod
      const validatedData = insertCloneAgentKnowledgeSchema
        .pick({ content: true })
        .parse(req.body);

      const { vectorEmbedding } = await import("./lib/vector-embedding.js");
      const { content } = validatedData;
      
      const success = await vectorEmbedding.addKnowledgeWithEmbedding(
        config.id,
        content,
        process.env.OPENAI_API_KEY
      );
      
      if (!success) {
        return res.status(500).json({ message: "Failed to add knowledge with embedding" });
      }
      
      const allKnowledge = await storage.getCloneAgentKnowledge(config.id);
      const newKnowledge = allKnowledge[allKnowledge.length - 1];
      
      res.status(201).json(newKnowledge);
    } catch (error) {
      console.error("Error creating clone agent knowledge:", error);
      res.status(400).json({ message: "Failed to create knowledge with embedding" });
    }
  });

  app.delete("/api/clone-agent/knowledge/:id", async (req, res) => {
    try {
      const success = await storage.deleteCloneAgentKnowledge(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Knowledge not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting clone agent knowledge:", error);
      res.status(500).json({ message: "Failed to delete knowledge" });
    }
  });

  // Clone Agent Conversations endpoints
  app.get("/api/clone-agent/conversations", async (req, res) => {
    try {
      const validatedQuery = conversationsQuerySchema.parse(req.query);
      const limitNum = validatedQuery.limit ?? 30;
      
      const conversations = await storage.getCloneAgentConversations(
        validatedQuery.instanceId,
        validatedQuery.search,
        limitNum
      );
      
      res.json(conversations);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      console.error("Error fetching clone agent conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/clone-agent/conversations/:id/messages", async (req, res) => {
    try {
      const validatedQuery = conversationMessagesQuerySchema.parse(req.query);
      const limitNum = validatedQuery.limit ?? 50;
      
      const messages = await storage.getCloneAgentConversationMessages(
        req.params.id,
        limitNum
      );
      
      res.json(messages);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      console.error("Error fetching conversation messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // WAHA Webhook Config endpoints
  app.get("/api/integrations/waha/webhook-config", async (req, res) => {
    try {
      const config = await storage.getWahaWebhookConfig();
      res.status(200).json(config);
    } catch (error) {
      console.error("Error fetching webhook config:", error);
      res.status(500).json({ message: "Failed to fetch webhook config" });
    }
  });

  app.put("/api/integrations/waha/webhook-config", async (req, res) => {
    try {
      const validatedData = insertWahaWebhookConfigSchema.parse(req.body);
      const existingConfig = await storage.getWahaWebhookConfig();
      
      let config;
      if (existingConfig) {
        config = await storage.updateWahaWebhookConfig(existingConfig.id, validatedData);
      } else {
        config = await storage.createWahaWebhookConfig(validatedData);
      }
      
      res.status(200).json(config);
    } catch (error) {
      console.error("Error managing webhook config:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid webhook config data", details: error.errors });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/integrations/waha/webhook-config", async (req, res) => {
    try {
      const existingConfig = await storage.getWahaWebhookConfig();
      
      if (!existingConfig) {
        return res.status(404).json({ message: "Webhook config not found" });
      }
      
      await storage.deleteWahaWebhookConfig(existingConfig.id);
      res.status(200).send();
    } catch (error) {
      console.error("Error deleting webhook config:", error);
      res.status(500).json({ message: "Failed to delete webhook config" });
    }
  });

  // WhatsApp Webhook for Clone Agent
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    try {
      // WAHA envia mensagens em diferentes formatos, vamos normalizar
      const payload = req.body;

      // Usar função centralizada para extrair número real
      // Hierarquia: Chat → Sender → phone/chatId → from → fromChat (NUNCA SenderAlt!)
      const phone = extractPhoneNumber(payload);
      
      if (!phone) {
        console.log('[Webhook WhatsApp] ❌ Não foi possível extrair número de telefone');
        return res.json({ success: true, message: 'No valid phone number found' });
      }
      
      // Extrair campos do payload WAHA (suporta múltiplos formatos)
      const text = payload.text;
      const senderName = payload._data?.Info?.PushName || payload.pushName || payload.senderName || payload.notifyName || "";
      const messageId = payload.messageId || payload.id?.id;
      const isGroup = payload.isGroup || false;
      const fromMe = payload.fromMe || false;
      const instanceId = payload.instanceId || payload.instance || payload.connectedPhone;
      
      // Extrair campos de mídia (novo suporte)
      const image = payload.image;
      const audio = payload.audio || payload.voice;
      const document = payload.document;

      // Extrair o conteúdo da mensagem
      const messageContent = text?.message || text;
      
      // Verificar se há algum conteúdo processável (texto, imagem, áudio ou documento)
      const hasContent = messageContent || image || audio || document;
      if (!hasContent) {
        return res.json({ success: true, message: 'No processable content' });
      }

      // Normalizar para o formato esperado por processWhatsAppMessage (com suporte a mídia)
      const normalizedMessage: any = {
        phone,
        fromMe,
        isGroup,
        messageId: messageId || `msg-${Date.now()}`,
        instanceId: instanceId || 'default',
        senderName
      };
      
      // Adicionar campos de acordo com o tipo de conteúdo
      if (messageContent) {
        normalizedMessage.text = {
          message: messageContent
        };
      }
      
      if (image) {
        // WAHA envia imagem com a propriedade imageUrl ao invés de url
        
        // Extrair URL da imagem de diferentes formatos possíveis
        let imageUrl = null;
        if (image.imageUrl) {
          imageUrl = image.imageUrl;
        } else if (image.url) {
          imageUrl = image.url;
        } else if (typeof image === 'string') {
          imageUrl = image;
        }
        
        if (!imageUrl) {
        }
        
        normalizedMessage.image = {
          url: imageUrl,
          caption: image.caption || '',
          // Preservar metadados adicionais se necessário
          thumbnailUrl: image.thumbnailUrl,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height
        };
      }
      
      if (audio) {
        // WAHA envia audio com a propriedade audioUrl ao invés de url
        
        // Extrair URL do áudio de diferentes formatos possíveis
        let audioUrl = null;
        if (audio.audioUrl) {
          audioUrl = audio.audioUrl;
        } else if (audio.url) {
          audioUrl = audio.url;
        } else if (typeof audio === 'string') {
          audioUrl = audio;
        }
        
        if (!audioUrl) {
        }
        
        normalizedMessage.audio = {
          url: audioUrl,
          caption: audio.caption || '',
          // Preservar metadados adicionais se necessário
          ptt: audio.ptt,
          seconds: audio.seconds,
          mimeType: audio.mimeType
        };
      }
      
      if (document) {
        // WAHA pode enviar documento com diferentes formatos
        
        // Extrair URL do documento de diferentes formatos possíveis
        let documentUrl = null;
        if (document.documentUrl) {
          documentUrl = document.documentUrl;
        } else if (document.url) {
          documentUrl = document.url;
        } else if (typeof document === 'string') {
          documentUrl = document;
        }
        
        if (!documentUrl) {
        }
        
        normalizedMessage.document = {
          url: documentUrl,
          filename: document.filename || document.name || document.caption || 'documento'
        };
      }


      // Processar mensagem de forma assíncrona (não bloquear o webhook)
      processWhatsAppMessage(normalizedMessage).catch(error => {
        console.error('[Webhook Clone Agent] Erro ao processar mensagem:', error);
      });

      // Responder rapidamente ao WAHA
      res.json({ success: true, message: 'Message received' });
    } catch (error) {
      console.error('[Webhook Clone Agent] Erro ao processar webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // WAHA Webhook for Messages (public endpoint for pushName updates)
  app.post("/api/webhooks/waha/messages", async (req, res) => {
    try {
      // 1. Buscar configuração do webhook
      const config = await storage.getWahaWebhookConfig();
      
      // Se não existe config ou não está ativa, retornar 404
      if (!config || !config.isActive) {
        return res.status(404).json({ message: 'Webhook not configured or inactive' });
      }

      // 2. Validar secret no header
      const clientToken = req.headers['x-client-token'];
      if (clientToken !== config.sharedSecret) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // 3. Extrair dados do payload WAHA
      const pushName = req.body.data?.pushName || req.body.pushName;
      let phone = req.body.data?.phone || req.body.phone;


      // Normalizar phone removendo @ e sufixos (ex: 5511999887766@c.us → 5511999887766)
      if (phone) {
        phone = phone.split('@')[0];
      }

      // 4. Buscar eleitor por WhatsApp
      const voter = await storage.getVoterByWhatsapp(phone);
      
      // Se não encontrar, apenas retornar 200 (ignora)
      if (!voter) {
        
        // Atualizar estatísticas do webhook
        await storage.updateWahaWebhookConfig(config.id, {
          lastReceivedAt: new Date(),
        }, true);
        
        return res.status(200).json({ success: true, message: 'Voter not found, ignored' });
      }

      // 5. Atualizar nome se pushName for melhor
      let updated = false;
      if (pushName && isNameBetter(voter.nome, pushName)) {
        await storage.updateVoter(voter.id, {
          nome: pushName,
          nameSource: 'webhook-pushName',
        });
        updated = true;
      } else {
      }

      // 6. Atualizar estatísticas do webhook
      await storage.updateWahaWebhookConfig(config.id, {
        lastReceivedAt: new Date(),
      }, true);

      // 7. Retornar sempre 200 OK
      return res.status(200).json({ 
        success: true, 
        updated,
        voter: { id: voter.id, nome: updated ? pushName : voter.nome }
      });

    } catch (error) {
      console.error('[WAHA Webhook] Erro ao processar webhook:', error);
      // Webhooks não devem falhar - sempre retornar 200
      return res.status(200).json({ success: false, error: 'Internal error' });
    }
  });

  // Militant Agents endpoints
  app.get("/api/militant-agents", async (req, res) => {
    try {
      const agents = await storage.getMilitantAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching militant agents:", error);
      res.status(500).json({ message: "Failed to fetch militant agents" });
    }
  });

  app.get("/api/militant-agents/:id", async (req, res) => {
    try {
      const agent = await storage.getMilitantAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Militant agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching militant agent:", error);
      res.status(500).json({ message: "Failed to fetch militant agent" });
    }
  });

  app.post("/api/militant-agents", async (req, res) => {
    try {
      const validatedData = insertMilitantAgentSchema.parse(req.body);
      const agent = await storage.createMilitantAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error creating militant agent:", error);
        res.status(400).json({ message: "Invalid militant agent data", errors: error.errors });
      } else {
        console.error("Error creating militant agent:", error);
        res.status(500).json({ message: "Failed to create militant agent" });
      }
    }
  });

  app.put("/api/militant-agents/:id", async (req, res) => {
    try {
      const validatedData = insertMilitantAgentSchema.partial().parse(req.body);
      const agent = await storage.updateMilitantAgent(req.params.id, validatedData);
      if (!agent) {
        return res.status(404).json({ message: "Militant agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error updating militant agent:", error);
        res.status(400).json({ message: "Invalid militant agent data", errors: error.errors });
      } else {
        console.error("Error updating militant agent:", error);
        res.status(500).json({ message: "Failed to update militant agent" });
      }
    }
  });

  app.delete("/api/militant-agents/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMilitantAgent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Militant agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting militant agent:", error);
      res.status(500).json({ message: "Failed to delete militant agent" });
    }
  });

  app.post("/api/militant-agents/:id/toggle", async (req, res) => {
    try {
      const { isActive } = req.body;
      const agent = await storage.toggleMilitantAgent(req.params.id, isActive);
      res.json(agent);
    } catch (error) {
      console.error("Error toggling militant agent:", error);
      res.status(500).json({ message: "Failed to toggle militant agent" });
    }
  });

  app.get("/api/militant-agents/:id/logs", async (req, res) => {
    try {
      const agent = await storage.getMilitantAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Militant agent not found" });
      }
      const logs = JSON.parse(agent.executionLogs || "[]");
      res.json(logs);
    } catch (error) {
      console.error("Error fetching militant agent logs:", error);
      res.status(500).json({ message: "Failed to fetch militant agent logs" });
    }
  });

  app.post("/api/militant-agents/:id/groups", async (req, res) => {
    try {
      const { groups } = req.body;
      if (!Array.isArray(groups)) {
        return res.status(400).json({ message: "Groups must be an array" });
      }
      const agent = await storage.updateMilitantAgentGroups(req.params.id, groups);
      res.json(agent);
    } catch (error) {
      console.error("Error updating militant agent groups:", error);
      res.status(500).json({ message: "Failed to update militant agent groups" });
    }
  });

  // Endpoint de teste para inserir mensagem na fila do agente militante
  app.post("/api/militant-agents/:id/test-message", async (req, res) => {
    try {
      const { groupId, groupName, message } = req.body;
      const agentId = req.params.id;

      // Buscar o agente
      const agent = await storage.getMilitantAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agente militante não encontrado" });
      }

      // Verificar se o agente tem grupos configurados
      const groups = JSON.parse(agent.groups || "[]");
      if (groups.length === 0) {
        return res.status(400).json({ 
          message: "Agente não tem grupos configurados. Configure os grupos primeiro." 
        });
      }

      // Usar o primeiro grupo configurado se não foi especificado
      const selectedGroup = groupId ? 
        groups.find((g: any) => g.id === groupId) : 
        groups[0];
      
      if (!selectedGroup) {
        return res.status(400).json({ 
          message: "Grupo não encontrado nas configurações do agente" 
        });
      }

      // Criar mensagem de teste
      const testMessage = await storage.createMessage({
        agentId: agentId,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name || groupName || "Grupo de Teste",
        fromPhone: "5511999999999", // Número de teste
        fromName: "Usuário de Teste",
        message: message || "Olá! Esta é uma mensagem de teste para o agente militante.",
        messageId: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Math.floor(Date.now() / 1000), // Converter para segundos (Unix timestamp)
        isProcessed: false,
        webhookPayload: JSON.stringify({ test: true })
      });

      res.json({
        success: true,
        message: "Mensagem de teste adicionada à fila. O agente irá processar na próxima execução (a cada 30 segundos).",
        messageId: testMessage.id,
        agentName: agent.name,
        groupName: testMessage.groupName
      });

    } catch (error) {
      console.error("Erro ao criar mensagem de teste:", error);
      res.status(500).json({ 
        message: "Erro ao criar mensagem de teste",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Endpoint para verificar credenciais WAHA
  app.post("/api/waha/verify", async (req, res) => {
    try {
      const { wahaUrl, wahaApiKey, wahaSession } = req.body;

      if (!wahaUrl || !wahaApiKey || !wahaSession) {
        return res.status(200).json({ 
          success: false,
          error: "URL WAHA, API Key e Sessão são obrigatórios" 
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: wahaSession
      };

      try {
        // Tentar buscar grupos para verificar se as credenciais funcionam
        await wahaGetGroups(wahaConfig);
        
        // Se chegou aqui, as credenciais estão corretas
        return res.status(200).json({ success: true });
      } catch (wahaError) {
        // Erro específico da API WAHA (credenciais inválidas, instância offline, etc)
        console.error("Erro ao verificar credenciais WAHA:", wahaError);
        const errorMessage = wahaError instanceof Error 
          ? wahaError.message 
          : "Não foi possível conectar à API WAHA. Verifique se as credenciais estão corretas e se a instância está online.";
        
        return res.status(200).json({ 
          success: false,
          error: errorMessage
        });
      }
    } catch (error) {
      console.error("Erro ao processar verificação de credenciais WAHA:", error);
      return res.status(200).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido ao verificar credenciais"
      });
    }
  });

  // Endpoint para buscar grupos WAHA com credenciais temporárias
  app.post("/api/waha/fetch-groups", async (req, res) => {
    try {
      const { wahaUrl, wahaApiKey, wahaSession } = req.body;

      if (!wahaUrl || !wahaApiKey || !wahaSession) {
        return res.status(400).json({ 
          message: "URL WAHA, API Key e Sessão são obrigatórios" 
        });
      }

      const wahaConfig: WahaConfig = {
        url: wahaUrl,
        apiKey: wahaApiKey,
        session: wahaSession
      };

      try {
        const wahaGroups = await wahaGetGroups(wahaConfig, { limit: 100 });
        
        // Formatar grupos para o formato esperado pelo frontend
        // WAHA API retorna grupos com 'JID' (group ID) e 'Name' (group name) fields
        const formattedGroups = wahaGroups
          .filter((group: any) => group.Name || group.name || group.subject)
          .map((group: any) => ({
            id: group.JID || group.id,
            name: group.Name || group.name || group.subject || 'Unnamed Group'
          }));

        res.json(formattedGroups);
      } catch (wahaError) {
        // Erro específico da API WAHA (credenciais inválidas, instância offline, etc)
        console.error("Erro ao conectar com API WAHA:", wahaError);
        return res.status(200).json([]); // Retorna array vazio ao invés de erro
      }
    } catch (error) {
      console.error("Erro ao processar requisição de grupos WAHA:", error);
      res.status(500).json({ 
        message: "Falha ao processar requisição",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Scheduled Messages endpoints
  app.get("/api/scheduled-messages/clone", async (req, res) => {
    try {
      const messages = await storage.getCloneScheduledMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching clone scheduled messages:", error);
      res.status(500).json({ message: "Failed to fetch clone scheduled messages" });
    }
  });

  app.get("/api/scheduled-messages/militant", async (req, res) => {
    try {
      const messages = await storage.getAllMilitantMessageQueues();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching militant scheduled messages:", error);
      res.status(500).json({ message: "Failed to fetch militant scheduled messages" });
    }
  });

  app.put("/api/scheduled-messages/clone/:id", async (req, res) => {
    try {
      const { messages, generatedResponse, collectionEndTime, scheduledSendTime, typingDuration } = req.body;
      const updated = await storage.updateCloneScheduledMessage(req.params.id, {
        messages,
        generatedResponse,
        collectionEndTime: collectionEndTime ? new Date(collectionEndTime) : undefined,
        scheduledSendTime: scheduledSendTime ? new Date(scheduledSendTime) : undefined,
        typingDuration
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating clone scheduled message:", error);
      res.status(500).json({ message: "Failed to update clone scheduled message" });
    }
  });

  app.put("/api/scheduled-messages/militant/:id", async (req, res) => {
    try {
      const { generatedResponse } = req.body;
      const updated = await storage.updateMilitantMessageQueue(req.params.id, { generatedResponse });
      res.json(updated);
    } catch (error) {
      console.error("Error updating militant scheduled message:", error);
      res.status(500).json({ message: "Failed to update militant scheduled message" });
    }
  });

  app.delete("/api/scheduled-messages/clone/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCloneScheduledMessage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Clone scheduled message not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting clone scheduled message:", error);
      res.status(500).json({ message: "Failed to delete clone scheduled message" });
    }
  });

  app.delete("/api/scheduled-messages/militant/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMilitantMessageQueue(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Militant scheduled message not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting militant scheduled message:", error);
      res.status(500).json({ message: "Failed to delete militant scheduled message" });
    }
  });

  // Send clone scheduled message immediately
  app.post("/api/scheduled-messages/clone/:id/send-now", async (req, res) => {
    try {
      const { id } = req.params;
      
      // 1. Buscar a mensagem agendada
      const messages = await storage.getCloneScheduledMessages();
      const message = messages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Mensagem agendada não encontrada" });
      }

      // 2. Verificar se já foi enviada
      if (message.sentAt) {
        return res.status(400).json({ message: "Mensagem já foi enviada" });
      }

      // 3. Buscar a instância do clone agent
      const instance = await storage.getCloneAgentInstance(message.instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Instância do Clone Agent não encontrada" });
      }

      // 4. Verificar se tem mensagem para enviar
      const messageToSend = message.generatedResponse || message.messages;
      if (!messageToSend) {
        return res.status(400).json({ message: "Nenhuma mensagem disponível para envio" });
      }

      // 5. Enviar a mensagem via WAHA em chunks
      const { wahaSendText, phoneToChatId } = await import("./lib/waha-client.js");
      const { splitMessageIntoChunks, sleep, getChunkDelay } = await import("./lib/message-chunker.js");
      const chatId = phoneToChatId(message.phoneNumber);
      
      const wahaConfig = {
        url: instance.wahaUrl,
        apiKey: instance.wahaApiKey,
        session: instance.wahaSession,
      };
      
      // Divide a mensagem em chunks
      const chunks = splitMessageIntoChunks(messageToSend);
      
      console.log(`[Manual Send] Enviando mensagem em ${chunks.length} chunk(s)`);
      
      // Envia cada chunk com delay entre eles
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        console.log(`[Manual Send] Enviando chunk ${i + 1}/${chunks.length} (${chunk.length} caracteres)`);
        
        await wahaSendText(wahaConfig, { chatId, text: chunk });
        
        // Aguarda delay entre chunks (exceto após o último)
        if (i < chunks.length - 1) {
          await sleep(getChunkDelay());
        }
      }
      
      console.log(`[Manual Send] Todos os chunks enviados com sucesso`);

      // 6. Marcar como enviada
      await storage.markMessageAsSent(id);

      
      res.json({ success: true, message: "Mensagem enviada com sucesso" });
    } catch (error) {
      console.error("Error sending clone scheduled message manually:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Webhook endpoint para receber mensagens do WhatsApp via WAHA
  app.post("/api/webhooks/whatsapp-messages", async (req, res) => {
    try {
      
      // Estrutura real do webhook da WAHA (formato atual)
      const { 
        phone, // ID do chat/grupo (formato: 120363403819000994-group)
        text, // Objeto com a mensagem { message: "conteúdo" }
        senderName, // Nome do remetente
        momment, // Timestamp da mensagem em millisegundos
        messageId, // ID único da mensagem
        isGroup, // Se é mensagem de grupo
        participantPhone, // Telefone do autor da mensagem no grupo
        chatName, // Nome do grupo/chat
        fromMe // Se a mensagem é enviada por nós mesmos
      } = req.body;

      // Extrair o conteúdo da mensagem
      const messageContent = text?.message || "";

      // Validações básicas
      if (!phone || !messageContent || !messageId) {
        return res.status(400).json({ message: "Dados incompletos" });
      }

      // Ignorar mensagens enviadas por nós mesmos
      if (fromMe) {
        return res.status(200).json({ message: "Mensagem própria ignorada" });
      }

      // =================================================================
      // NOVA FUNCIONALIDADE: Salvar/atualizar eleitor imediatamente
      // =================================================================
      
      // Determinar o telefone do remetente
      let senderPhone: string = "";
      
      if (isGroup && participantPhone) {
        // Em grupos, usar o participantPhone (quem enviou a mensagem)
        senderPhone = participantPhone.replace("@c.us", "").replace(/\D/g, "");
      } else if (!isGroup) {
        // Em mensagens diretas, usar o phone
        senderPhone = phone.replace("@c.us", "").replace("-group", "").replace(/\D/g, "");
      }
      
      // Processar criação/atualização do eleitor de forma assíncrona (não bloquear)
      if (senderPhone && senderPhone.length >= 10) {
        
        // Executar de forma assíncrona para não bloquear o webhook
        (async () => {
          try {
            // Buscar nome do contato via API WAHA
            let voterName = senderName || '';
            try {
              // Buscar credenciais WAHA de qualquer agente ativo
              // Tentar primeiro Replicador, depois Coletor, depois Clone
              let wahaConfig: WahaConfig | null = null;
              
              try {
                const replicador = await storage.getReplicadorAgentInstance();
                if (replicador?.wahaUrl && replicador?.wahaApiKey && replicador?.wahaSession) {
                  wahaConfig = {
                    url: replicador.wahaUrl,
                    apiKey: replicador.wahaApiKey,
                    session: replicador.wahaSession
                  };
                }
              } catch {}
              
              if (!wahaConfig) {
                try {
                  const coletor = await storage.getColetorAgentInstance();
                  if (coletor?.wahaUrl && coletor?.wahaApiKey && coletor?.wahaSession) {
                    wahaConfig = {
                      url: coletor.wahaUrl,
                      apiKey: coletor.wahaApiKey,
                      session: coletor.wahaSession
                    };
                  }
                } catch {}
              }
              
              // Buscar dados do contato se temos configuração WAHA
              if (wahaConfig) {
                const chatId = phoneToChatId(senderPhone);
                const contactData = await wahaGetContact(wahaConfig, chatId);
                
                // Extrair nome: priority name > pushName > notify > senderName
                const wahaName = contactData.name || contactData.pushName || contactData.notify || '';
                if (wahaName) {
                  voterName = wahaName;
                }
              }
            } catch (contactError) {
              console.error(`[Webhook-Eleitor] Erro ao buscar contato:`, contactError);
              // Continuar com senderName se houver erro
            }
            
            // Verificar se o eleitor já existe
            const existingVoter = await storage.getVoterByWhatsapp(senderPhone);
            
            if (existingVoter) {
              
              // Verificar se o nome recebido é melhor que o existente
              if (voterName && isNameBetter(existingVoter.nome, voterName)) {
                
                const updatedVoter = await storage.updateVoter(existingVoter.id, {
                  nome: voterName,
                  nameSource: 'waha-contact'
                });
                
                console.log(`[Webhook-Eleitor] ✅ Nome atualizado: ${senderPhone} -> ${voterName}`);
              } else {
              }
            } else {
              // Criar novo eleitor
              
              // Se não tiver nome, usar um padrão
              if (!voterName || voterName.trim() === "") {
                voterName = `Eleitor ${senderPhone.slice(-4)}`;
              }
              
              const newVoter = await storage.createVoter({
                nome: voterName,
                whatsapp: senderPhone,
                municipio: "", // Será preenchido posteriormente
                indicacao: "WhatsApp", // Indicação padrão para eleitores criados via webhook
                voto: "neutro", // Status inicial
                material: "sem_material" // Status inicial
              });
              
              console.log(`[Webhook-Eleitor] ✅ Novo eleitor criado: ${senderPhone} -> ${voterName}`);
            }
          } catch (error) {
            // Não bloquear o processamento mesmo se houver erro
            if (error instanceof DuplicateWhatsAppError) {
            } else {
              console.error(`[Webhook-Eleitor] Erro ao processar eleitor:`, error);
            }
          }
        })();
      } else {
      }
      
      // =================================================================
      // FIM DA NOVA FUNCIONALIDADE
      // =================================================================

      // Continuar com o processamento normal para mensagens de grupo
      if (!isGroup) {
        return res.status(200).json({ message: "Mensagem processada (eleitor salvo se aplicável)" });
      }

      // Extrair ID do grupo (phone já vem no formato 120363403819000994-group)
      const groupId = phone.replace("-group", "");

      // Verificar se já processamos essa mensagem (evitar duplicatas)
      const existingMessage = await storage.getMessageByMessageId(messageId);
      if (existingMessage) {
        return res.status(200).json({ message: "Mensagem já processada" });
      }

      // Buscar agentes militantes ativos
      const militantAgents = await storage.getMilitantAgents();
      const activeAgents = militantAgents.filter(agent => agent.isActive);
      

      // Verificar se algum agente monitora este grupo
      let assignedAgent = null;
      for (const agent of activeAgents) {
        const groups = JSON.parse(agent.groups || "[]");
        const monitoredGroup = groups.find((g: any) => 
          g.id === phone && g.active  // phone já vem como 120363403819000994-group
        );
        
        if (monitoredGroup) {
          assignedAgent = agent;
          break;
        }
      }

      if (!assignedAgent) {
        return res.status(200).json({ message: "Grupo não monitorado" });
      }

      // Extrair número do remetente (remover @c.us se existir)
      const fromPhone = participantPhone?.replace("@c.us", "") || participantPhone || "";
      
      // Adicionar mensagem à fila para processamento
      const messageData = {
        agentId: assignedAgent.id,
        groupId: phone, // já vem no formato 120363403819000994-group
        groupName: chatName || "Grupo",
        fromPhone: fromPhone,
        fromName: senderName || "",
        message: messageContent,
        messageId: messageId,
        timestamp: Math.floor(momment / 1000) || Date.now() / 1000, // momment vem em millisegundos, converter para segundos
        isProcessed: false,
        webhookPayload: JSON.stringify(req.body)
      };

      
      const savedMessage = await storage.createMessage(messageData);

      // Responder sucesso ao webhook
      res.status(200).json({ 
        message: "Mensagem recebida e adicionada à fila",
        messageId: savedMessage.id,
        agentId: assignedAgent.id,
        agentName: assignedAgent.name
      });

    } catch (error) {
      console.error("[Webhook] Erro ao processar webhook:", error);
      res.status(500).json({ message: "Erro ao processar webhook" });
    }
  });

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { login, senha } = req.body;
      
      const validLogin = process.env.LOGIN;
      const validSenha = process.env.SENHA;

      if (login === validLogin && senha === validSenha) {
        req.session.isAuthenticated = true;
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ success: false, message: "Erro ao processar login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ success: false, message: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/check", (req, res) => {
    res.json({ isAuthenticated: !!req.session?.isAuthenticated });
  });

  const httpServer = createServer(app);
  return httpServer;
}
