import { users, voters, campaignMaterials, configOptions, leaderships, assessores, instagramAgents, collectorAgents, replicadorAgentInstances, coletorAgentInstances, cloneAgentConfig, cloneAgentInstances, cloneAgentKnowledge, cloneAgentConversations, cloneAgentMessageQueue, wahaWebhookConfigs, militantAgents, militantMessageQueue, messagesQueue, voterMemory, militantGroupMemory, type User, type InsertUser, type Voter, type InsertVoter, type CampaignMaterial, type InsertCampaignMaterial, type ConfigOption, type InsertConfigOption, type Leadership, type InsertLeadership, type Assessor, type InsertAssessor, type InstagramAgent, type InsertInstagramAgent, type CollectorAgent, type InsertCollectorAgent, type ReplicadorAgentInstance, type InsertReplicadorAgentInstance, type ColetorAgentInstance, type InsertColetorAgentInstance, type CloneAgentConfig, type InsertCloneAgentConfig, type CloneAgentInstance, type InsertCloneAgentInstance, type CloneAgentKnowledge, type InsertCloneAgentKnowledge, type CloneAgentConversation, type InsertCloneAgentConversation, type CloneAgentMessageQueue, type InsertCloneAgentMessageQueue, type WahaWebhookConfig, type InsertWahaWebhookConfig, type MilitantAgent, type InsertMilitantAgent, type MilitantMessageQueue, type InsertMilitantMessageQueue, type MessagesQueue, type InsertMessagesQueue, type VoterMemory, type InsertVoterMemory, type MilitantGroupMemory, type InsertMilitantGroupMemory } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

// Error class for duplicate WhatsApp validation
export class DuplicateWhatsAppError extends Error {
  constructor(whatsapp: string) {
    super(`Já existe um eleitor cadastrado com o número ${whatsapp}`);
    this.name = 'DuplicateWhatsAppError';
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(username: string, password: string): Promise<boolean>;

  // Voters
  getVoters(): Promise<Voter[]>;
  getVoter(id: string): Promise<Voter | undefined>;
  getVoterByWhatsapp(whatsapp: string): Promise<Voter | undefined>;
  createVoter(voter: InsertVoter): Promise<Voter>;
  updateVoter(id: string, voter: Partial<InsertVoter>): Promise<Voter | undefined>;
  deleteVoter(id: string): Promise<boolean>;
  deleteAllVoters(): Promise<{ votersDeleted: number; conversationsDeleted: number; memoryDeleted: number; queueDeleted: number }>;
  updateVoterConfirmedVote(phoneNumber: string): Promise<Voter | undefined>;

  // Campaign Materials
  getCampaignMaterials(): Promise<CampaignMaterial[]>;
  getCampaignMaterial(id: string): Promise<CampaignMaterial | undefined>;
  createCampaignMaterial(material: InsertCampaignMaterial): Promise<CampaignMaterial>;
  updateCampaignMaterial(id: string, material: Partial<InsertCampaignMaterial>): Promise<CampaignMaterial | undefined>;
  deleteCampaignMaterial(id: string): Promise<boolean>;

  // Configuration Options
  getConfigOptions(): Promise<ConfigOption[]>;
  getConfigOptionsByType(fieldType: string): Promise<ConfigOption[]>;
  getBairrosByMunicipio(municipio: string): Promise<ConfigOption[]>;
  getConfigOption(id: string): Promise<ConfigOption | undefined>;
  createConfigOption(option: InsertConfigOption): Promise<ConfigOption>;
  deleteConfigOption(id: string): Promise<boolean>;

  // Leaderships
  getLeaderships(): Promise<Leadership[]>;
  getLeadership(id: string): Promise<Leadership | undefined>;
  getLeadershipByWhatsapp(whatsapp: string): Promise<Leadership | undefined>;
  createLeadership(leadership: InsertLeadership): Promise<Leadership>;
  updateLeadership(id: string, leadership: Partial<InsertLeadership>): Promise<Leadership | undefined>;
  deleteLeadership(id: string): Promise<boolean>;

  // Assessores
  getAssessores(): Promise<Assessor[]>;
  getAssessor(id: string): Promise<Assessor | undefined>;
  getAssessorByWhatsapp(whatsapp: string): Promise<Assessor | undefined>;
  createAssessor(assessor: InsertAssessor): Promise<Assessor>;
  updateAssessor(id: string, assessor: Partial<InsertAssessor>): Promise<Assessor | undefined>;
  deleteAssessor(id: string): Promise<boolean>;

  // Instagram Agents
  getInstagramAgents(): Promise<InstagramAgent[]>;
  getInstagramAgent(id: string): Promise<InstagramAgent | undefined>;
  upsertInstagramAgent(data: InsertInstagramAgent): Promise<InstagramAgent>;
  updateInstagramAgent(id: string, data: Partial<InsertInstagramAgent>): Promise<InstagramAgent>;
  toggleInstagramAgent(id: string, isActive: boolean): Promise<InstagramAgent>;
  updateLastRun(id: string, lastPostId: string | null, lastRunAt: Date): Promise<InstagramAgent>;
  appendExecutionLog(id: string, logMessage: string): Promise<InstagramAgent>;
  appendExecutionLogs(id: string, logMessages: string[]): Promise<InstagramAgent>;
  deleteInstagramAgent(id: string): Promise<boolean>;

  // Collector Agents
  getCollectorAgents(): Promise<CollectorAgent[]>;
  getCollectorAgent(id: string): Promise<CollectorAgent | undefined>;
  upsertCollectorAgent(data: InsertCollectorAgent): Promise<CollectorAgent>;
  updateCollectorAgent(id: string, data: Partial<InsertCollectorAgent>): Promise<CollectorAgent>;
  toggleCollectorAgent(id: string, isActive: boolean): Promise<CollectorAgent>;
  updateCollectorLastRun(id: string, memberCount: number, memberIds: string[], lastRunAt: Date): Promise<CollectorAgent>;
  appendCollectorExecutionLog(id: string, logMessage: string): Promise<CollectorAgent>;
  deleteCollectorAgent(id: string): Promise<boolean>;

  // Replicador Agent Instances
  getReplicadorAgentInstance(): Promise<ReplicadorAgentInstance | null>;
  createReplicadorAgentInstance(data: InsertReplicadorAgentInstance): Promise<ReplicadorAgentInstance>;
  updateReplicadorAgentInstance(id: string, data: Partial<InsertReplicadorAgentInstance>): Promise<ReplicadorAgentInstance>;
  toggleReplicadorAgentInstance(id: string, isActive: boolean): Promise<ReplicadorAgentInstance>;
  deleteReplicadorAgentInstance(id: string): Promise<boolean>;

  // Coletor Agent Instances
  getColetorAgentInstance(): Promise<ColetorAgentInstance | null>;
  createColetorAgentInstance(data: InsertColetorAgentInstance): Promise<ColetorAgentInstance>;
  updateColetorAgentInstance(id: string, data: Partial<InsertColetorAgentInstance>): Promise<ColetorAgentInstance>;
  toggleColetorAgentInstance(id: string, isActive: boolean): Promise<ColetorAgentInstance>;
  deleteColetorAgentInstance(id: string): Promise<boolean>;

  // Clone Agent Config (Singleton)
  getCloneAgentConfig(): Promise<CloneAgentConfig | null>;
  createCloneAgentConfig(data: InsertCloneAgentConfig): Promise<CloneAgentConfig>;
  updateCloneAgentConfig(id: string, data: Partial<InsertCloneAgentConfig>): Promise<CloneAgentConfig>;

  // Clone Agent Instances
  getCloneAgentInstances(): Promise<CloneAgentInstance[]>;
  getCloneAgentInstance(id: string): Promise<CloneAgentInstance | undefined>;
  createCloneAgentInstance(data: InsertCloneAgentInstance): Promise<CloneAgentInstance>;
  updateCloneAgentInstance(id: string, data: Partial<InsertCloneAgentInstance>): Promise<CloneAgentInstance>;
  toggleCloneAgentInstance(id: string, isActive: boolean): Promise<CloneAgentInstance>;
  deleteCloneAgentInstance(id: string): Promise<boolean>;

  // Clone Agent Knowledge (uses configId)
  getCloneAgentKnowledge(configId: string): Promise<CloneAgentKnowledge[]>;
  createCloneAgentKnowledge(data: InsertCloneAgentKnowledge): Promise<CloneAgentKnowledge>;
  deleteCloneAgentKnowledge(id: string): Promise<boolean>;
  searchKnowledgeSemantic(configId: string, query: string, limit: number): Promise<Array<{ content: string; similarity: number }>>;
  
  // Clone Agent Message Queue (uses instanceId)
  getCloneAgentMessageQueue(instanceId: string, phoneNumber: string): Promise<CloneAgentMessageQueue | undefined>;
  createOrUpdateMessageQueue(data: InsertCloneAgentMessageQueue): Promise<CloneAgentMessageQueue>;
  getUnprocessedMessageQueues(): Promise<CloneAgentMessageQueue[]>;
  markMessageQueueProcessed(id: string): Promise<CloneAgentMessageQueue>;
  markQueueProcessing(id: string): Promise<boolean>; // NOVO: Marcar como processando
  clearQueueProcessing(id: string): Promise<void>; // NOVO: Limpar flag de processamento
  recordProcessingAttempt(id: string): Promise<void>; // Registrar tentativa
  markQueueFailed(id: string, errorMessage: string): Promise<void>; // Marcar como falha
  markQueueSucceeded(id: string, generatedResponse?: string): Promise<void>; // Marcar como sucesso (com resposta opcional)
  updateMessageQueueTime(id: string, collectionEndTime: Date): Promise<void>; // Atualizar fim da janela de coleta
  saveGeneratedResponse(id: string, generatedResponse: string): Promise<void>; // Salvar resposta gerada sem marcar como processada

  // Atomic Queue Operations (uses status field for better control)
  getOrCreateActiveQueue(instanceId: string, phoneNumber: string, collectionTimeSeconds: number): Promise<CloneAgentMessageQueue>;
  appendMessageToQueue(queueId: string, message: string): Promise<CloneAgentMessageQueue>;
  getQueuesReadyForProcessing(): Promise<CloneAgentMessageQueue[]>;
  claimQueueForProcessing(queueId: string, lockId: string): Promise<boolean>;
  completeQueueWithResponse(queueId: string, generatedResponse: string): Promise<CloneAgentMessageQueue>;
  failQueue(queueId: string, errorMessage: string): Promise<CloneAgentMessageQueue>;

  // Clone Agent Conversations (uses instanceId)
  getConversation(instanceId: string, phoneNumber: string): Promise<CloneAgentConversation | undefined>;
  saveConversation(instanceId: string, phoneNumber: string, messages: Array<{role: string, content: string}>): Promise<CloneAgentConversation>;
  clearConversation(instanceId: string, phoneNumber: string): Promise<boolean>;
  getCloneAgentConversations(instanceId?: string, search?: string, limit?: number): Promise<Array<CloneAgentConversation & { voterName?: string }>>;
  getCloneAgentConversationMessages(conversationId: string, limit?: number): Promise<Array<{role: string, content: string, timestamp?: string}>>;

  // Waha Webhook Config
  getWahaWebhookConfig(): Promise<WahaWebhookConfig | null>;
  createWahaWebhookConfig(config: InsertWahaWebhookConfig): Promise<WahaWebhookConfig>;
  updateWahaWebhookConfig(id: string, config: Partial<Omit<WahaWebhookConfig, 'id' | 'createdAt' | 'updatedAt'>>, incrementMessagesProcessed?: boolean): Promise<WahaWebhookConfig>;
  deleteWahaWebhookConfig(id: string): Promise<void>;

  // Militant Agents
  getMilitantAgents(): Promise<MilitantAgent[]>;
  getMilitantAgent(id: string): Promise<MilitantAgent | undefined>;
  createMilitantAgent(data: InsertMilitantAgent): Promise<MilitantAgent>;
  updateMilitantAgent(id: string, data: Partial<InsertMilitantAgent>): Promise<MilitantAgent>;
  deleteMilitantAgent(id: string): Promise<boolean>;
  toggleMilitantAgent(id: string, isActive: boolean): Promise<MilitantAgent>;
  appendMilitantAgentLog(id: string, logMessage: string): Promise<MilitantAgent>;
  updateMilitantAgentGroups(id: string, groups: Array<{id: string, name: string, active: boolean}>): Promise<MilitantAgent>;
  updateMilitantAgentLastRun(id: string, lastMessageTimestamp: Record<string, string>): Promise<MilitantAgent>;
  
  // Militant Message Queue
  getMilitantMessageQueue(agentId: string, groupId: string): Promise<MilitantMessageQueue | undefined>;
  createOrUpdateMilitantMessageQueue(data: InsertMilitantMessageQueue): Promise<MilitantMessageQueue>;
  getMilitantQueuesReadyForProcessing(): Promise<MilitantMessageQueue[]>;
  getAllMilitantMessageQueues(): Promise<MilitantMessageQueue[]>;
  updateMilitantMessageQueue(id: string, data: { generatedResponse?: string }): Promise<MilitantMessageQueue>;
  deleteMilitantMessageQueue(id: string): Promise<boolean>;
  claimMilitantQueueForProcessing(queueId: string, lockId: string): Promise<boolean>;
  markMilitantQueueSucceeded(queueId: string, generatedResponse: string): Promise<MilitantMessageQueue>;
  failMilitantQueue(queueId: string, errorMessage: string): Promise<MilitantMessageQueue>;
  
  // Messages Queue (DEPRECATED)
  getUnprocessedMessages(agentId?: string, limit?: number): Promise<MessagesQueue[]>;
  createMessage(message: InsertMessagesQueue): Promise<MessagesQueue>;
  markMessageAsProcessed(id: string): Promise<MessagesQueue | undefined>;
  deleteMessage(id: string): Promise<boolean>;
  deleteProcessedMessages(): Promise<number>;
  getMessageByMessageId(messageId: string): Promise<MessagesQueue | undefined>;
  
  // Voter Memory
  getVoterMemory(phoneNumber: string): Promise<VoterMemory | undefined>;
  createVoterMemory(data: InsertVoterMemory): Promise<VoterMemory>;
  updateVoterMemory(phoneNumber: string, data: Partial<InsertVoterMemory>): Promise<VoterMemory>;
  appendToVoterMemory(phoneNumber: string, field: 'problems' | 'needs' | 'topics' | 'importantDates', items: string[]): Promise<VoterMemory>;
  updateVoterContext(phoneNumber: string, contextSummary: string, sentiment?: string): Promise<VoterMemory>;
  incrementVoterInteraction(phoneNumber: string): Promise<VoterMemory>;

  // Militant Group Memory
  getMilitantGroupMemory(groupId: string): Promise<MilitantGroupMemory | undefined>;
  createMilitantGroupMemory(data: InsertMilitantGroupMemory): Promise<MilitantGroupMemory>;
  updateMilitantGroupMemory(groupId: string, data: Partial<InsertMilitantGroupMemory>): Promise<MilitantGroupMemory>;
  appendToMilitantGroupMemory(groupId: string, field: 'topics' | 'keyMembers' | 'commonQuestions', items: string[]): Promise<MilitantGroupMemory>;
  incrementMilitantGroupInteraction(groupId: string): Promise<MilitantGroupMemory>;

  // Scheduled Messages
  getCloneScheduledMessages(): Promise<any[]>;
  getMilitantScheduledMessages(): Promise<MessagesQueue[]>;
  updateCloneScheduledMessage(id: string, data: { messages?: string; generatedResponse?: string; collectionEndTime?: Date; scheduledSendTime?: Date; typingDuration?: number }): Promise<CloneAgentMessageQueue>;
  updateMilitantScheduledMessage(id: string, data: { message?: string }): Promise<MessagesQueue>;
  deleteCloneScheduledMessage(id: string): Promise<boolean>;
  deleteMilitantScheduledMessage(id: string): Promise<boolean>;
  getNextAvailableGlobalSlot(): Promise<Date>;
  getScheduledMessagesForSending(): Promise<CloneAgentMessageQueue[]>;
  markMessageAsSent(id: string): Promise<void>;
  clearMessageSentAt(id: string): Promise<void>;
  getOrphanedMessages(futureThreshold: Date): Promise<CloneAgentMessageQueue[]>;
  
  // Métodos para deduplicação com hash
  checkMessageHash(hash: string): Promise<boolean>;
  saveMessageHash(messageQueueId: string, hash: string): Promise<void>;
  removeMessageHash(messageQueueId: string): Promise<void>;
}

// DatabaseStorage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword
      })
      .returning();
    return user;
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    return await bcrypt.compare(password, user.password);
  }

  // Voters
  async getVoters(): Promise<Voter[]> {
    return await db.select().from(voters);
  }

  async getVoter(id: string): Promise<Voter | undefined> {
    const [voter] = await db.select().from(voters).where(eq(voters.id, id));
    return voter || undefined;
  }

  async getVoterByWhatsapp(whatsapp: string): Promise<Voter | undefined> {
    const [voter] = await db.select().from(voters).where(eq(voters.whatsapp, whatsapp));
    return voter || undefined;
  }

  async createVoter(insertVoter: InsertVoter): Promise<Voter> {
    // Check if voter with same WhatsApp already exists
    const existingVoter = await this.getVoterByWhatsapp(insertVoter.whatsapp);
    if (existingVoter) {
      throw new DuplicateWhatsAppError(insertVoter.whatsapp);
    }

    const [voter] = await db
      .insert(voters)
      .values(insertVoter)
      .returning();
    return voter;
  }

  async updateVoter(id: string, updates: Partial<InsertVoter>): Promise<Voter | undefined> {
    // Check for WhatsApp duplicate if WhatsApp is being updated
    if (updates.whatsapp) {
      const existingVoter = await this.getVoterByWhatsapp(updates.whatsapp);
      if (existingVoter && existingVoter.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }

    const [voter] = await db
      .update(voters)
      .set(updates)
      .where(eq(voters.id, id))
      .returning();
    return voter || undefined;
  }

  async deleteVoter(id: string): Promise<boolean> {
    const result = await db.delete(voters).where(eq(voters.id, id)).returning();
    return result.length > 0;
  }

  async deleteAllVoters(): Promise<{ votersDeleted: number; conversationsDeleted: number; memoryDeleted: number; queueDeleted: number }> {
    const allVoters = await this.getVoters();
    const phoneNumbers = allVoters.map(v => v.whatsapp);
    
    let conversationsDeleted = 0;
    let memoryDeleted = 0;
    let queueDeleted = 0;
    
    for (const phone of phoneNumbers) {
      const conversationResult = await db.delete(cloneAgentConversations)
        .where(eq(cloneAgentConversations.phoneNumber, phone))
        .returning();
      conversationsDeleted += conversationResult.length;
      
      const memoryResult = await db.delete(voterMemory)
        .where(eq(voterMemory.phoneNumber, phone))
        .returning();
      memoryDeleted += memoryResult.length;
      
      const queueResult = await db.delete(cloneAgentMessageQueue)
        .where(eq(cloneAgentMessageQueue.phoneNumber, phone))
        .returning();
      queueDeleted += queueResult.length;
    }
    
    const votersResult = await db.delete(voters).returning();
    const votersDeleted = votersResult.length;
    
    return {
      votersDeleted,
      conversationsDeleted,
      memoryDeleted,
      queueDeleted
    };
  }

  async updateVoterConfirmedVote(phoneNumber: string): Promise<Voter | undefined> {
    
    // Buscar eleitor pelo número de WhatsApp
    const existingVoter = await this.getVoterByWhatsapp(phoneNumber);
    
    if (!existingVoter) {
      return undefined;
    }
    
    // Atualizar votoConfirmado para true - usando sql tag para forçar atualização do boolean
    const [updatedVoter] = await db
      .update(voters)
      .set({ 
        votoConfirmado: sql<boolean>`${true}`,  // Forçar atualização do campo boolean
        voto: 'confirmado' // Também atualizar status para confirmado
      })
      .where(eq(voters.whatsapp, phoneNumber))
      .returning();
    
    if (updatedVoter) {
    }
    
    return updatedVoter || undefined;
  }

  // Campaign Materials
  async getCampaignMaterials(): Promise<CampaignMaterial[]> {
    return await db.select().from(campaignMaterials);
  }

  async getCampaignMaterial(id: string): Promise<CampaignMaterial | undefined> {
    const [material] = await db.select().from(campaignMaterials).where(eq(campaignMaterials.id, id));
    return material || undefined;
  }

  async createCampaignMaterial(insertMaterial: InsertCampaignMaterial): Promise<CampaignMaterial> {
    const [material] = await db
      .insert(campaignMaterials)
      .values(insertMaterial)
      .returning();
    return material;
  }

  async updateCampaignMaterial(id: string, updates: Partial<InsertCampaignMaterial>): Promise<CampaignMaterial | undefined> {
    const [material] = await db
      .update(campaignMaterials)
      .set(updates)
      .where(eq(campaignMaterials.id, id))
      .returning();
    return material || undefined;
  }

  async deleteCampaignMaterial(id: string): Promise<boolean> {
    const result = await db.delete(campaignMaterials).where(eq(campaignMaterials.id, id)).returning();
    return result.length > 0;
  }

  // Configuration Options
  async getConfigOptions(): Promise<ConfigOption[]> {
    return await db.select().from(configOptions);
  }

  async getConfigOptionsByType(fieldType: string): Promise<ConfigOption[]> {
    return await db.select().from(configOptions).where(eq(configOptions.fieldType, fieldType));
  }

  async getBairrosByMunicipio(municipio: string): Promise<ConfigOption[]> {
    return await db.select().from(configOptions)
      .where(and(
        eq(configOptions.fieldType, 'bairro'),
        eq(configOptions.parentMunicipio, municipio)
      ));
  }

  async getConfigOption(id: string): Promise<ConfigOption | undefined> {
    const [option] = await db.select().from(configOptions).where(eq(configOptions.id, id));
    return option || undefined;
  }

  async createConfigOption(insertOption: InsertConfigOption): Promise<ConfigOption> {
    const [option] = await db
      .insert(configOptions)
      .values(insertOption)
      .returning();
    return option;
  }

  async deleteConfigOption(id: string): Promise<boolean> {
    const result = await db.delete(configOptions).where(eq(configOptions.id, id)).returning();
    return result.length > 0;
  }

  // Leaderships
  async getLeaderships(): Promise<Leadership[]> {
    return await db.select().from(leaderships).orderBy(desc(leaderships.dataCadastro));
  }

  async getLeadership(id: string): Promise<Leadership | undefined> {
    const [leadership] = await db.select().from(leaderships).where(eq(leaderships.id, id));
    return leadership || undefined;
  }

  async getLeadershipByWhatsapp(whatsapp: string): Promise<Leadership | undefined> {
    const [leadership] = await db.select().from(leaderships).where(eq(leaderships.whatsapp, whatsapp));
    return leadership || undefined;
  }

  async createLeadership(insertLeadership: InsertLeadership): Promise<Leadership> {
    // Check for duplicate WhatsApp (only if non-empty)
    if (insertLeadership.whatsapp && insertLeadership.whatsapp.trim()) {
      const existingLeadership = await this.getLeadershipByWhatsapp(insertLeadership.whatsapp);
      if (existingLeadership) {
        throw new DuplicateWhatsAppError(insertLeadership.whatsapp);
      }
    }

    const [leadership] = await db
      .insert(leaderships)
      .values(insertLeadership)
      .returning();
    return leadership;
  }

  async updateLeadership(id: string, updates: Partial<InsertLeadership>): Promise<Leadership | undefined> {
    // Check for duplicate WhatsApp (only if non-empty)
    if (updates.whatsapp !== undefined && updates.whatsapp && updates.whatsapp.trim()) {
      const existingLeadership = await this.getLeadershipByWhatsapp(updates.whatsapp);
      if (existingLeadership && existingLeadership.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }

    const [leadership] = await db
      .update(leaderships)
      .set(updates)
      .where(eq(leaderships.id, id))
      .returning();
    return leadership || undefined;
  }

  async deleteLeadership(id: string): Promise<boolean> {
    const result = await db.delete(leaderships).where(eq(leaderships.id, id)).returning();
    return result.length > 0;
  }

  // Assessores
  async getAssessores(): Promise<Assessor[]> {
    return await db.select().from(assessores).orderBy(desc(assessores.dataCadastro));
  }

  async getAssessor(id: string): Promise<Assessor | undefined> {
    const [assessor] = await db.select().from(assessores).where(eq(assessores.id, id));
    return assessor || undefined;
  }

  async getAssessorByWhatsapp(whatsapp: string): Promise<Assessor | undefined> {
    const [assessor] = await db.select().from(assessores).where(eq(assessores.whatsapp, whatsapp));
    return assessor || undefined;
  }

  async createAssessor(insertAssessor: InsertAssessor): Promise<Assessor> {
    // Check for duplicate WhatsApp (only if non-empty)
    if (insertAssessor.whatsapp && insertAssessor.whatsapp.trim()) {
      const existingAssessor = await this.getAssessorByWhatsapp(insertAssessor.whatsapp);
      if (existingAssessor) {
        throw new DuplicateWhatsAppError(insertAssessor.whatsapp);
      }
    }

    const [assessor] = await db
      .insert(assessores)
      .values(insertAssessor)
      .returning();
    return assessor;
  }

  async updateAssessor(id: string, updates: Partial<InsertAssessor>): Promise<Assessor | undefined> {
    // Check for duplicate WhatsApp (only if non-empty)
    if (updates.whatsapp !== undefined && updates.whatsapp && updates.whatsapp.trim()) {
      const existingAssessor = await this.getAssessorByWhatsapp(updates.whatsapp);
      if (existingAssessor && existingAssessor.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }

    const [assessor] = await db
      .update(assessores)
      .set(updates)
      .where(eq(assessores.id, id))
      .returning();
    return assessor || undefined;
  }

  async deleteAssessor(id: string): Promise<boolean> {
    const result = await db.delete(assessores).where(eq(assessores.id, id)).returning();
    return result.length > 0;
  }

  // Instagram Agents
  async getInstagramAgents(): Promise<InstagramAgent[]> {
    return await db.select().from(instagramAgents);
  }

  async getInstagramAgent(id: string): Promise<InstagramAgent | undefined> {
    const [agent] = await db.select().from(instagramAgents).where(eq(instagramAgents.id, id));
    return agent || undefined;
  }

  async upsertInstagramAgent(data: InsertInstagramAgent): Promise<InstagramAgent> {
    const [existing] = await db
      .select()
      .from(instagramAgents)
      .where(eq(instagramAgents.instagramUrl, data.instagramUrl));

    if (existing) {
      const [updated] = await db
        .update(instagramAgents)
        .set(data)
        .where(eq(instagramAgents.id, existing.id))
        .returning();
      return updated;
    }

    const [agent] = await db
      .insert(instagramAgents)
      .values(data)
      .returning();
    return agent;
  }

  async updateInstagramAgent(id: string, data: Partial<InsertInstagramAgent>): Promise<InstagramAgent> {
    const [agent] = await db
      .update(instagramAgents)
      .set(data)
      .where(eq(instagramAgents.id, id))
      .returning();
    return agent;
  }

  async toggleInstagramAgent(id: string, isActive: boolean): Promise<InstagramAgent> {
    const [agent] = await db
      .update(instagramAgents)
      .set({ isActive })
      .where(eq(instagramAgents.id, id))
      .returning();
    return agent;
  }

  async updateLastRun(id: string, lastPostId: string | null, lastRunAt: Date): Promise<InstagramAgent> {
    const [agent] = await db
      .update(instagramAgents)
      .set({ lastPostId, lastRunAt })
      .where(eq(instagramAgents.id, id))
      .returning();
    return agent;
  }

  async appendExecutionLog(id: string, logMessage: string): Promise<InstagramAgent> {
    const agent = await this.getInstagramAgent(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const [updatedAgent] = await db
      .update(instagramAgents)
      .set({ executionLogs: JSON.stringify(recentLogs) })
      .where(eq(instagramAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async appendExecutionLogs(id: string, logMessages: string[]): Promise<InstagramAgent> {
    const agent = await this.getInstagramAgent(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    const timestamp = new Date().toISOString();
    logMessages.forEach(msg => {
      logs.push({ timestamp, message: msg });
    });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const [updatedAgent] = await db
      .update(instagramAgents)
      .set({ executionLogs: JSON.stringify(recentLogs) })
      .where(eq(instagramAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteInstagramAgent(id: string): Promise<boolean> {
    const result = await db
      .delete(instagramAgents)
      .where(eq(instagramAgents.id, id))
      .returning();
    return result.length > 0;
  }

  // Collector Agents
  async getCollectorAgents(): Promise<CollectorAgent[]> {
    return await db.select().from(collectorAgents);
  }

  async getCollectorAgent(id: string): Promise<CollectorAgent | undefined> {
    const [agent] = await db.select().from(collectorAgents).where(eq(collectorAgents.id, id));
    return agent || undefined;
  }

  async upsertCollectorAgent(data: InsertCollectorAgent): Promise<CollectorAgent> {
    const [existing] = await db
      .select()
      .from(collectorAgents)
      .where(eq(collectorAgents.groupId, data.groupId));

    if (existing) {
      const [updated] = await db
        .update(collectorAgents)
        .set(data)
        .where(eq(collectorAgents.id, existing.id))
        .returning();
      return updated;
    }

    const [agent] = await db
      .insert(collectorAgents)
      .values(data)
      .returning();
    return agent;
  }

  async updateCollectorAgent(id: string, data: Partial<InsertCollectorAgent>): Promise<CollectorAgent> {
    const [agent] = await db
      .update(collectorAgents)
      .set(data)
      .where(eq(collectorAgents.id, id))
      .returning();
    return agent;
  }

  async toggleCollectorAgent(id: string, isActive: boolean): Promise<CollectorAgent> {
    const [agent] = await db
      .update(collectorAgents)
      .set({ isActive })
      .where(eq(collectorAgents.id, id))
      .returning();
    return agent;
  }

  async updateCollectorLastRun(id: string, memberCount: number, memberIds: string[], lastRunAt: Date): Promise<CollectorAgent> {
    console.log(`[DatabaseStorage] Updating collector ${id} with memberIds:`, memberIds);
    const memberIdsJson = JSON.stringify(memberIds);
    console.log(`[DatabaseStorage] JSON stringified memberIds:`, memberIdsJson);
    
    const [agent] = await db
      .update(collectorAgents)
      .set({ 
        lastMemberCount: memberCount, 
        lastProcessedMemberIds: memberIdsJson,
        lastRunAt 
      })
      .where(eq(collectorAgents.id, id))
      .returning();
    
    console.log(`[DatabaseStorage] Updated agent lastProcessedMemberIds:`, agent.lastProcessedMemberIds);
    return agent;
  }

  async appendCollectorExecutionLog(id: string, logMessage: string): Promise<CollectorAgent> {
    const agent = await this.getCollectorAgent(id);
    if (!agent) {
      throw new Error(`Collector agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const [updatedAgent] = await db
      .update(collectorAgents)
      .set({ executionLogs: JSON.stringify(recentLogs) })
      .where(eq(collectorAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteCollectorAgent(id: string): Promise<boolean> {
    const result = await db
      .delete(collectorAgents)
      .where(eq(collectorAgents.id, id))
      .returning();
    return result.length > 0;
  }

  // Replicador Agent Instances (limited to one instance)
  async getReplicadorAgentInstance(): Promise<ReplicadorAgentInstance | null> {
    const instances = await db.select().from(replicadorAgentInstances);
    return instances[0] || null;
  }

  async createReplicadorAgentInstance(data: InsertReplicadorAgentInstance): Promise<ReplicadorAgentInstance> {
    const existing = await this.getReplicadorAgentInstance();
    if (existing) {
      throw new Error("Já existe uma instância do Agente Replicador. Delete a instância existente antes de criar uma nova.");
    }
    
    const [instance] = await db
      .insert(replicadorAgentInstances)
      .values(data)
      .returning();
    return instance;
  }

  async updateReplicadorAgentInstance(id: string, data: Partial<InsertReplicadorAgentInstance>): Promise<ReplicadorAgentInstance> {
    const [instance] = await db
      .update(replicadorAgentInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(replicadorAgentInstances.id, id))
      .returning();
    return instance;
  }

  async toggleReplicadorAgentInstance(id: string, isActive: boolean): Promise<ReplicadorAgentInstance> {
    const [instance] = await db
      .update(replicadorAgentInstances)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(replicadorAgentInstances.id, id))
      .returning();
    return instance;
  }

  async deleteReplicadorAgentInstance(id: string): Promise<boolean> {
    const result = await db
      .delete(replicadorAgentInstances)
      .where(eq(replicadorAgentInstances.id, id))
      .returning();
    return result.length > 0;
  }

  // Coletor Agent Instances (limited to one instance)
  async getColetorAgentInstance(): Promise<ColetorAgentInstance | null> {
    const instances = await db.select().from(coletorAgentInstances);
    return instances[0] || null;
  }

  async createColetorAgentInstance(data: InsertColetorAgentInstance): Promise<ColetorAgentInstance> {
    const existing = await this.getColetorAgentInstance();
    if (existing) {
      throw new Error("Já existe uma instância do Agente Coletor. Delete a instância existente antes de criar uma nova.");
    }
    
    const [instance] = await db
      .insert(coletorAgentInstances)
      .values(data)
      .returning();
    return instance;
  }

  async updateColetorAgentInstance(id: string, data: Partial<InsertColetorAgentInstance>): Promise<ColetorAgentInstance> {
    const [instance] = await db
      .update(coletorAgentInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coletorAgentInstances.id, id))
      .returning();
    return instance;
  }

  async toggleColetorAgentInstance(id: string, isActive: boolean): Promise<ColetorAgentInstance> {
    const [instance] = await db
      .update(coletorAgentInstances)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(coletorAgentInstances.id, id))
      .returning();
    return instance;
  }

  async deleteColetorAgentInstance(id: string): Promise<boolean> {
    const result = await db
      .delete(coletorAgentInstances)
      .where(eq(coletorAgentInstances.id, id))
      .returning();
    return result.length > 0;
  }

  // Clone Agent Config (Singleton)
  async getCloneAgentConfig(): Promise<CloneAgentConfig | null> {
    const configs = await db.select().from(cloneAgentConfig);
    return configs[0] || null;
  }

  async createCloneAgentConfig(data: InsertCloneAgentConfig): Promise<CloneAgentConfig> {
    await db.delete(cloneAgentConfig);
    
    const [config] = await db
      .insert(cloneAgentConfig)
      .values(data)
      .returning();
    return config;
  }

  async updateCloneAgentConfig(id: string, data: Partial<InsertCloneAgentConfig>): Promise<CloneAgentConfig> {
    const [config] = await db
      .update(cloneAgentConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cloneAgentConfig.id, id))
      .returning();
    return config;
  }

  // Clone Agent Instances
  async getCloneAgentInstances(): Promise<CloneAgentInstance[]> {
    return await db.select().from(cloneAgentInstances);
  }

  async getCloneAgentInstance(id: string): Promise<CloneAgentInstance | undefined> {
    const [instance] = await db.select().from(cloneAgentInstances).where(eq(cloneAgentInstances.id, id));
    return instance || undefined;
  }

  async createCloneAgentInstance(data: InsertCloneAgentInstance): Promise<CloneAgentInstance> {
    const [instance] = await db
      .insert(cloneAgentInstances)
      .values(data)
      .returning();
    return instance;
  }

  async updateCloneAgentInstance(id: string, data: Partial<InsertCloneAgentInstance>): Promise<CloneAgentInstance> {
    const [instance] = await db
      .update(cloneAgentInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cloneAgentInstances.id, id))
      .returning();
    return instance;
  }

  async toggleCloneAgentInstance(id: string, isActive: boolean): Promise<CloneAgentInstance> {
    const [instance] = await db
      .update(cloneAgentInstances)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(cloneAgentInstances.id, id))
      .returning();
    return instance;
  }

  async deleteCloneAgentInstance(id: string): Promise<boolean> {
    await db.delete(cloneAgentConversations).where(eq(cloneAgentConversations.instanceId, id));
    await db.delete(cloneAgentMessageQueue).where(eq(cloneAgentMessageQueue.instanceId, id));
    const result = await db
      .delete(cloneAgentInstances)
      .where(eq(cloneAgentInstances.id, id))
      .returning();
    return result.length > 0;
  }

  // Clone Agent Knowledge (uses configId)
  async getCloneAgentKnowledge(configId: string): Promise<CloneAgentKnowledge[]> {
    return await db.select().from(cloneAgentKnowledge).where(eq(cloneAgentKnowledge.configId, configId));
  }

  async createCloneAgentKnowledge(data: InsertCloneAgentKnowledge): Promise<CloneAgentKnowledge> {
    const [knowledge] = await db
      .insert(cloneAgentKnowledge)
      .values(data)
      .returning();
    return knowledge;
  }

  async deleteCloneAgentKnowledge(id: string): Promise<boolean> {
    const result = await db
      .delete(cloneAgentKnowledge)
      .where(eq(cloneAgentKnowledge.id, id))
      .returning();
    return result.length > 0;
  }

  async searchKnowledgeSemantic(configId: string, query: string, limit: number = 5): Promise<Array<{ content: string; similarity: number }>> {
    const { vectorEmbedding } = await import("./lib/vector-embedding-simple.js");
    return await vectorEmbedding.semanticSearch(configId, query, limit);
  }

  // Clone Agent Message Queue (uses instanceId)
  async getCloneAgentMessageQueue(instanceId: string, phoneNumber: string): Promise<CloneAgentMessageQueue | undefined> {
    const [queue] = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          eq(cloneAgentMessageQueue.instanceId, instanceId),
          eq(cloneAgentMessageQueue.phoneNumber, phoneNumber),
          sql`status IN ('collecting', 'ready', 'processing')`
        )
      );
    return queue || undefined;
  }

  async createOrUpdateMessageQueue(data: InsertCloneAgentMessageQueue): Promise<CloneAgentMessageQueue> {
    const existing = await this.getCloneAgentMessageQueue(data.instanceId!, data.phoneNumber);

    if (existing) {
      // NOVO COMPORTAMENTO: Verificar se a janela de coleta ainda está ativa
      const now = new Date();
      const collectionEnd = new Date(existing.collectionEndTime);
      
      // Se já passou da janela de coleta e foi processada/completada, permitir criar nova fila
      if ((existing.status === 'completed' || existing.status === 'failed') && now > collectionEnd) {
        // Criar nova fila (não retornar aqui, continuar para a criação abaixo)
      } else {
        // Janela ainda ativa ou não processada - apenas adicionar mensagens sem alterar o tempo
        
        // Tratar mensagens existentes com proteção contra formato incorreto
        let existingMessages: any[] = [];
        try {
          const parsed = JSON.parse(existing.messages);
          // Se for array, usar direto. Se for string, converter para array
          existingMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          // Se falhar o parse, tratar como string e envolver em array
          existingMessages = [existing.messages];
        }
        
        // Tratar novas mensagens
        let newMessages: any[] = [];
        try {
          const parsed = JSON.parse(data.messages || "[]");
          newMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          // Se falhar o parse, tratar como string e envolver em array
          newMessages = data.messages ? [data.messages] : [];
        }
        
        const allMessages = [...existingMessages, ...newMessages];
        
        // IMPORTANTE: NÃO atualizar collectionEndTime - manter o tempo fixo da primeira mensagem
        const [updated] = await db
          .update(cloneAgentMessageQueue)
          .set({
            messages: JSON.stringify(allMessages),
            // collectionEndTime NÃO é atualizado - mantém o valor original da primeira mensagem
          })
          .where(eq(cloneAgentMessageQueue.id, existing.id))
          .returning();
        
        
        return updated;
      }
    }
    
    // Criar nova fila (quando não existe ou quando a anterior já foi processada)
    const [created] = await db
      .insert(cloneAgentMessageQueue)
      .values(data)
      .returning();
    
    
    return created;
  }

  async getUnprocessedMessageQueues(): Promise<CloneAgentMessageQueue[]> {
    const MAX_RETRIES = 3;
    const now = new Date();
    const results = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          sql`status IN ('collecting', 'ready')`,
          // O controle de duplicação é feito em memória no worker
          sql`collection_end_time <= ${now}`,
          // Incluir apenas filas que ainda não excederam o limite de retries
          sql`retry_count < ${MAX_RETRIES}`
        )
      );
    return results;
  }

  // Controle de duplicação é feito em memória no worker
  async markQueueProcessing(id: string): Promise<boolean> {
    return true;
  }

  async clearQueueProcessing(id: string): Promise<void> {
    // Não faz nada - controle de duplicação é feito em memória no worker
  }

  async recordProcessingAttempt(id: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({
        retryCount: sql`retry_count + 1`,
        lastAttemptAt: new Date(),
        // NÃO marcar como processada aqui!
        // Isso permite que novas mensagens sejam adicionadas à fila existente
        // O controle de duplicação é feito em memória no worker
      })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async markQueueFailed(id: string, errorMessage: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({
        status: 'failed',
        lastAttemptAt: new Date(),
        errorMessage: errorMessage.substring(0, 1000), // Limitar tamanho do erro
      })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async markQueueSucceeded(id: string, generatedResponse?: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({
        status: 'completed',
        processedAt: new Date(),
        generatedResponse: generatedResponse || null,
      })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async updateMessageQueueTime(id: string, collectionEndTime: Date): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({
        collectionEndTime,
        status: 'collecting', // Reset status so it can be picked up again
      })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async saveGeneratedResponse(id: string, generatedResponse: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({
        generatedResponse,
      })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async markMessageQueueProcessed(id: string): Promise<CloneAgentMessageQueue> {
    const [updated] = await db
      .update(cloneAgentMessageQueue)
      .set({
        status: 'completed',
        processedAt: new Date(),
      })
      .where(eq(cloneAgentMessageQueue.id, id))
      .returning();
    return updated;
  }

  // Atomic Queue Operations (uses status field for better control)
  async getOrCreateActiveQueue(instanceId: string, phoneNumber: string, collectionTimeSeconds: number): Promise<CloneAgentMessageQueue> {
    const activeQueue = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          eq(cloneAgentMessageQueue.instanceId, instanceId),
          eq(cloneAgentMessageQueue.phoneNumber, phoneNumber),
          sql`status IN ('collecting', 'ready')`
        )
      )
      .limit(1);
    
    if (activeQueue.length > 0) {
      return activeQueue[0];
    }
    
    const now = new Date();
    const collectionEndTime = new Date(now.getTime() + collectionTimeSeconds * 1000);
    
    const [newQueue] = await db
      .insert(cloneAgentMessageQueue)
      .values({
        instanceId,
        phoneNumber,
        messages: "[]",
        status: "collecting",
        collectionEndTime,
        firstMessageAt: now,
        retryCount: 0,
      })
      .returning();
    
    return newQueue;
  }

  async appendMessageToQueue(queueId: string, message: string): Promise<CloneAgentMessageQueue> {
    const [queue] = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(eq(cloneAgentMessageQueue.id, queueId))
      .limit(1);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    let messages: any[] = [];
    try {
      const parsed = JSON.parse(queue.messages);
      messages = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      messages = [];
    }
    
    messages.push(message);
    
    const [updated] = await db
      .update(cloneAgentMessageQueue)
      .set({
        messages: JSON.stringify(messages),
        status: "collecting",
      })
      .where(eq(cloneAgentMessageQueue.id, queueId))
      .returning();
    
    return updated;
  }

  async getQueuesReadyForProcessing(): Promise<CloneAgentMessageQueue[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const queues = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          sql`status IN ('collecting', 'ready')`,
          sql`collection_end_time <= ${now}`,
          sql`(locked_at IS NULL OR locked_at < ${fiveMinutesAgo})`
        )
      );
    
    return queues;
  }

  async claimQueueForProcessing(queueId: string, lockId: string): Promise<boolean> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const result = await db
      .update(cloneAgentMessageQueue)
      .set({
        status: "processing",
        lockedAt: now,
        lockedBy: lockId,
      })
      .where(
        and(
          eq(cloneAgentMessageQueue.id, queueId),
          sql`status IN ('collecting', 'ready')`,
          sql`(locked_at IS NULL OR locked_at < ${fiveMinutesAgo})`
        )
      )
      .returning();
    
    return result.length > 0;
  }

  async completeQueueWithResponse(queueId: string, generatedResponse: string): Promise<CloneAgentMessageQueue> {
    const [updated] = await db
      .update(cloneAgentMessageQueue)
      .set({
        status: "completed",
        generatedResponse,
        processedAt: new Date(),
      })
      .where(eq(cloneAgentMessageQueue.id, queueId))
      .returning();
    
    return updated;
  }

  async failQueue(queueId: string, errorMessage: string): Promise<CloneAgentMessageQueue> {
    const [queue] = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(eq(cloneAgentMessageQueue.id, queueId))
      .limit(1);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const newRetryCount = (queue.retryCount || 0) + 1;
    const newStatus = newRetryCount >= 3 ? "failed" : "ready";
    
    const [updated] = await db
      .update(cloneAgentMessageQueue)
      .set({
        status: newStatus,
        errorMessage: errorMessage.substring(0, 1000),
        retryCount: newRetryCount,
        lastAttemptAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(cloneAgentMessageQueue.id, queueId))
      .returning();
    
    return updated;
  }

  // Clone Agent Conversations
  private limitConversationHistory(messages: Array<{role: string, content: string}>): Array<{role: string, content: string}> {
    const MAX_MESSAGES = 50; // Aumentado de 20 para 50 mensagens
    const KEEP_FIRST = 10;   // Mantém as 10 primeiras mensagens
    const KEEP_LAST = 40;     // Mantém as 40 últimas mensagens

    if (messages.length <= MAX_MESSAGES) {
      return messages;
    }

    const firstMessages = messages.slice(0, KEEP_FIRST);
    const lastMessages = messages.slice(-KEEP_LAST);
    
    // Adiciona marcador de transição
    const transitionMarker = {
      role: "system",
      content: `[... ${messages.length - MAX_MESSAGES} mensagens intermediárias omitidas para contexto ...]`
    };
    
    return [...firstMessages, transitionMarker, ...lastMessages];
  }

  async getConversation(instanceId: string, phoneNumber: string): Promise<CloneAgentConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(cloneAgentConversations)
      .where(
        and(
          eq(cloneAgentConversations.instanceId, instanceId),
          eq(cloneAgentConversations.phoneNumber, phoneNumber)
        )
      );
    return conversation || undefined;
  }

  async saveConversation(instanceId: string, phoneNumber: string, messages: Array<{role: string, content: string}>): Promise<CloneAgentConversation> {
    const limitedMessages = this.limitConversationHistory(messages);
    const messagesJson = JSON.stringify(limitedMessages);
    const existing = await this.getConversation(instanceId, phoneNumber);

    if (existing) {
      const [updated] = await db
        .update(cloneAgentConversations)
        .set({
          messages: messagesJson,
          lastMessageAt: new Date(),
        })
        .where(eq(cloneAgentConversations.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(cloneAgentConversations)
        .values({
          instanceId,
          phoneNumber,
          messages: messagesJson,
        })
        .returning();
      return created;
    }
  }

  async clearConversation(instanceId: string, phoneNumber: string): Promise<boolean> {
    const result = await db
      .delete(cloneAgentConversations)
      .where(
        and(
          eq(cloneAgentConversations.instanceId, instanceId),
          eq(cloneAgentConversations.phoneNumber, phoneNumber)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getCloneAgentConversations(instanceId?: string, search?: string, limit: number = 30): Promise<Array<CloneAgentConversation & { voterName?: string }>> {
    const { ilike, or } = await import('drizzle-orm');
    
    let query = db
      .select({
        id: cloneAgentConversations.id,
        instanceId: cloneAgentConversations.instanceId,
        phoneNumber: cloneAgentConversations.phoneNumber,
        messages: cloneAgentConversations.messages,
        lastMessageAt: cloneAgentConversations.lastMessageAt,
        createdAt: cloneAgentConversations.createdAt,
        voterName: voters.nome,
      })
      .from(cloneAgentConversations)
      .leftJoin(voters, eq(cloneAgentConversations.phoneNumber, voters.whatsapp))
      .$dynamic();

    const conditions = [];
    
    if (instanceId) {
      conditions.push(eq(cloneAgentConversations.instanceId, instanceId));
    }
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(voters.nome, searchTerm),
          ilike(cloneAgentConversations.phoneNumber, searchTerm)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const results = await query
      .orderBy(desc(cloneAgentConversations.lastMessageAt))
      .limit(limit);
    
    return results.map(row => ({
      id: row.id,
      instanceId: row.instanceId,
      phoneNumber: row.phoneNumber,
      messages: typeof row.messages === 'string' ? row.messages : JSON.stringify(row.messages || []),
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      voterName: row.voterName || undefined,
    }));
  }

  async getCloneAgentConversationMessages(conversationId: string, limit: number = 50): Promise<Array<{role: string, content: string, timestamp?: string}>> {
    const [conversation] = await db
      .select()
      .from(cloneAgentConversations)
      .where(eq(cloneAgentConversations.id, conversationId));
    
    if (!conversation) {
      return [];
    }
    
    const messages = JSON.parse(conversation.messages || '[]');
    
    // Return last N messages
    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }
    
    return messages;
  }

  // Waha Webhook Config
  async getWahaWebhookConfig(): Promise<WahaWebhookConfig | null> {
    const configs = await db.select().from(wahaWebhookConfigs);
    return configs[0] || null;
  }

  async createWahaWebhookConfig(config: InsertWahaWebhookConfig): Promise<WahaWebhookConfig> {
    await db.delete(wahaWebhookConfigs);
    
    const [webhookConfig] = await db
      .insert(wahaWebhookConfigs)
      .values(config)
      .returning();
    return webhookConfig;
  }

  async updateWahaWebhookConfig(id: string, config: Partial<Omit<WahaWebhookConfig, 'id' | 'createdAt' | 'updatedAt'>>, incrementMessagesProcessed?: boolean): Promise<WahaWebhookConfig> {
    const updateData: any = { ...config, updatedAt: new Date() };
    
    // If incrementMessagesProcessed is true, use atomic SQL increment
    if (incrementMessagesProcessed) {
      updateData.totalMessagesProcessed = sql`${wahaWebhookConfigs.totalMessagesProcessed} + 1`;
    }
    
    const [webhookConfig] = await db
      .update(wahaWebhookConfigs)
      .set(updateData)
      .where(eq(wahaWebhookConfigs.id, id))
      .returning();
    return webhookConfig;
  }

  async deleteWahaWebhookConfig(id: string): Promise<void> {
    await db
      .delete(wahaWebhookConfigs)
      .where(eq(wahaWebhookConfigs.id, id));
  }

  // Militant Agents
  async getMilitantAgents(): Promise<MilitantAgent[]> {
    return await db.select().from(militantAgents);
  }

  async getMilitantAgent(id: string): Promise<MilitantAgent | undefined> {
    const [agent] = await db.select().from(militantAgents).where(eq(militantAgents.id, id));
    return agent || undefined;
  }

  async createMilitantAgent(data: InsertMilitantAgent): Promise<MilitantAgent> {
    const [agent] = await db
      .insert(militantAgents)
      .values(data)
      .returning();
    return agent;
  }

  async updateMilitantAgent(id: string, data: Partial<InsertMilitantAgent>): Promise<MilitantAgent> {
    const [agent] = await db
      .update(militantAgents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(militantAgents.id, id))
      .returning();
    return agent;
  }

  async deleteMilitantAgent(id: string): Promise<boolean> {
    const result = await db
      .delete(militantAgents)
      .where(eq(militantAgents.id, id))
      .returning();
    return result.length > 0;
  }

  async toggleMilitantAgent(id: string, isActive: boolean): Promise<MilitantAgent> {
    const [agent] = await db
      .update(militantAgents)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(militantAgents.id, id))
      .returning();
    return agent;
  }

  async appendMilitantAgentLog(id: string, logMessage: string): Promise<MilitantAgent> {
    const agent = await this.getMilitantAgent(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 100 logs
    const recentLogs = logs.slice(-100);
    const [updatedAgent] = await db
      .update(militantAgents)
      .set({ executionLogs: JSON.stringify(recentLogs), updatedAt: new Date() })
      .where(eq(militantAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async updateMilitantAgentGroups(id: string, groups: Array<{id: string, name: string, active: boolean}>): Promise<MilitantAgent> {
    const [agent] = await db
      .update(militantAgents)
      .set({ groups: JSON.stringify(groups), updatedAt: new Date() })
      .where(eq(militantAgents.id, id))
      .returning();
    return agent;
  }

  async updateMilitantAgentLastRun(id: string, lastMessageTimestamp: Record<string, string>): Promise<MilitantAgent> {
    const [agent] = await db
      .update(militantAgents)
      .set({ 
        lastRunAt: new Date(), 
        lastMessageTimestamp: JSON.stringify(lastMessageTimestamp),
        updatedAt: new Date() 
      })
      .where(eq(militantAgents.id, id))
      .returning();
    return agent;
  }

  // Militant Message Queue
  async getMilitantMessageQueue(agentId: string, groupId: string): Promise<MilitantMessageQueue | undefined> {
    const [queue] = await db
      .select()
      .from(militantMessageQueue)
      .where(
        and(
          eq(militantMessageQueue.agentId, agentId),
          eq(militantMessageQueue.groupId, groupId),
          sql`status IN ('collecting', 'ready', 'processing')`
        )
      );
    return queue || undefined;
  }

  async createOrUpdateMilitantMessageQueue(data: InsertMilitantMessageQueue): Promise<MilitantMessageQueue> {
    const existing = await this.getMilitantMessageQueue(data.agentId!, data.groupId!);

    if (existing) {
      const now = new Date();
      const collectionEnd = new Date(existing.collectionEndTime);
      
      if ((existing.status === 'completed' || existing.status === 'failed') && now > collectionEnd) {
      } else {
        
        let existingMessages: any[] = [];
        try {
          const parsed = JSON.parse(existing.messages);
          existingMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          existingMessages = [existing.messages];
        }
        
        let newMessages: any[] = [];
        try {
          const parsed = JSON.parse(data.messages || "[]");
          newMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          newMessages = data.messages ? [data.messages] : [];
        }
        
        const allMessages = [...existingMessages, ...newMessages];
        
        const [updated] = await db
          .update(militantMessageQueue)
          .set({
            messages: JSON.stringify(allMessages),
          })
          .where(eq(militantMessageQueue.id, existing.id))
          .returning();
        
        return updated;
      }
    }
    
    const [created] = await db
      .insert(militantMessageQueue)
      .values(data)
      .returning();
    
    return created;
  }

  async getMilitantQueuesReadyForProcessing(): Promise<MilitantMessageQueue[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const queues = await db
      .select()
      .from(militantMessageQueue)
      .where(
        and(
          sql`status IN ('collecting', 'ready')`,
          sql`collection_end_time <= ${now}`,
          sql`(locked_at IS NULL OR locked_at < ${fiveMinutesAgo})`
        )
      );
    
    return queues;
  }

  async getAllMilitantMessageQueues(): Promise<MilitantMessageQueue[]> {
    const queues = await db
      .select()
      .from(militantMessageQueue)
      .where(
        sql`status IN ('collecting', 'ready', 'processing')`
      )
      .orderBy(sql`created_at DESC`);
    
    return queues;
  }

  async updateMilitantMessageQueue(id: string, data: { generatedResponse?: string }): Promise<MilitantMessageQueue> {
    const [updated] = await db
      .update(militantMessageQueue)
      .set(data)
      .where(eq(militantMessageQueue.id, id))
      .returning();
    
    if (!updated) {
      throw new Error('Militant message queue not found');
    }
    
    return updated;
  }

  async deleteMilitantMessageQueue(id: string): Promise<boolean> {
    const result = await db
      .delete(militantMessageQueue)
      .where(eq(militantMessageQueue.id, id));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async claimMilitantQueueForProcessing(queueId: string, lockId: string): Promise<boolean> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const result = await db
      .update(militantMessageQueue)
      .set({
        status: "processing",
        lockedAt: now,
        lockedBy: lockId,
      })
      .where(
        and(
          eq(militantMessageQueue.id, queueId),
          sql`status IN ('collecting', 'ready')`,
          sql`(locked_at IS NULL OR locked_at < ${fiveMinutesAgo})`
        )
      )
      .returning();
    
    return result.length > 0;
  }

  async markMilitantQueueSucceeded(queueId: string, generatedResponse: string): Promise<MilitantMessageQueue> {
    const [updated] = await db
      .update(militantMessageQueue)
      .set({
        status: "completed",
        generatedResponse,
        processedAt: new Date(),
      })
      .where(eq(militantMessageQueue.id, queueId))
      .returning();
    
    return updated;
  }

  async failMilitantQueue(queueId: string, errorMessage: string): Promise<MilitantMessageQueue> {
    const [queue] = await db
      .select()
      .from(militantMessageQueue)
      .where(eq(militantMessageQueue.id, queueId))
      .limit(1);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const newRetryCount = (queue.retryCount || 0) + 1;
    const newStatus = newRetryCount >= 3 ? "failed" : "ready";
    
    const [updated] = await db
      .update(militantMessageQueue)
      .set({
        status: newStatus,
        errorMessage: errorMessage.substring(0, 1000),
        retryCount: newRetryCount,
        lastAttemptAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(militantMessageQueue.id, queueId))
      .returning();
    
    return updated;
  }

  // Messages Queue
  async getUnprocessedMessages(agentId?: string, limit: number = 100): Promise<MessagesQueue[]> {
    let query = db.select().from(messagesQueue)
      .where(eq(messagesQueue.isProcessed, false))
      .orderBy(messagesQueue.timestamp)
      .limit(limit);
    
    if (agentId) {
      query = db.select().from(messagesQueue)
        .where(and(
          eq(messagesQueue.isProcessed, false),
          eq(messagesQueue.agentId, agentId)
        ))
        .orderBy(messagesQueue.timestamp)
        .limit(limit);
    }
    
    return await query;
  }

  async createMessage(message: InsertMessagesQueue): Promise<MessagesQueue> {
    const [created] = await db
      .insert(messagesQueue)
      .values(message)
      .returning();
    return created;
  }

  async markMessageAsProcessed(id: string): Promise<MessagesQueue | undefined> {
    const [updated] = await db
      .update(messagesQueue)
      .set({ 
        isProcessed: true,
        processedAt: new Date()
      })
      .where(eq(messagesQueue.id, id))
      .returning();
    return updated;
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(messagesQueue)
      .where(eq(messagesQueue.id, id));
    return true;
  }

  async deleteProcessedMessages(): Promise<number> {
    const result = await db
      .delete(messagesQueue)
      .where(eq(messagesQueue.isProcessed, true));
    return 0; // Drizzle doesn't return count directly
  }

  async getMessageByMessageId(messageId: string): Promise<MessagesQueue | undefined> {
    const [message] = await db.select().from(messagesQueue)
      .where(eq(messagesQueue.messageId, messageId));
    return message || undefined;
  }

  // Voter Memory
  async getVoterMemory(phoneNumber: string): Promise<VoterMemory | undefined> {
    const [memory] = await db.select().from(voterMemory)
      .where(eq(voterMemory.phoneNumber, phoneNumber));
    return memory || undefined;
  }

  async createVoterMemory(data: InsertVoterMemory): Promise<VoterMemory> {
    const [memory] = await db.insert(voterMemory)
      .values({
        ...data,
        firstInteraction: data.firstInteraction || new Date(),
        lastInteraction: data.lastInteraction || new Date(),
        totalInteractions: data.totalInteractions || 1,
      })
      .returning();
    return memory;
  }

  async updateVoterMemory(phoneNumber: string, data: Partial<InsertVoterMemory>): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      // Se não existe, cria um novo
      return this.createVoterMemory({ ...data, phoneNumber } as InsertVoterMemory);
    }

    const [updated] = await db.update(voterMemory)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(voterMemory.phoneNumber, phoneNumber))
      .returning();
    return updated;
  }

  async appendToVoterMemory(
    phoneNumber: string, 
    field: 'problems' | 'needs' | 'topics' | 'importantDates', 
    items: string[]
  ): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      // Se não existe, cria um novo com os items
      const data: InsertVoterMemory = {
        phoneNumber,
        [field]: JSON.stringify(items),
      };
      return this.createVoterMemory(data);
    }

    // Parse existing field and append new items
    const currentItems = JSON.parse(existing[field] || '[]');
    const updatedItems = Array.from(new Set([...currentItems, ...items])); // Remove duplicatas
    
    const [updated] = await db.update(voterMemory)
      .set({
        [field]: JSON.stringify(updatedItems),
        updatedAt: new Date(),
      })
      .where(eq(voterMemory.phoneNumber, phoneNumber))
      .returning();
    return updated;
  }

  async updateVoterContext(phoneNumber: string, contextSummary: string, sentiment?: string): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      // Se não existe, cria um novo
      return this.createVoterMemory({
        phoneNumber,
        contextSummary,
        sentiment,
      });
    }

    const [updated] = await db.update(voterMemory)
      .set({
        contextSummary,
        sentiment: sentiment || existing.sentiment,
        updatedAt: new Date(),
      })
      .where(eq(voterMemory.phoneNumber, phoneNumber))
      .returning();
    return updated;
  }

  async incrementVoterInteraction(phoneNumber: string): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      // Se não existe, cria um novo
      return this.createVoterMemory({
        phoneNumber,
        totalInteractions: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date(),
      });
    }

    const [updated] = await db.update(voterMemory)
      .set({
        totalInteractions: existing.totalInteractions + 1,
        lastInteraction: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(voterMemory.phoneNumber, phoneNumber))
      .returning();
    return updated;
  }

  // Militant Group Memory
  async getMilitantGroupMemory(groupId: string): Promise<MilitantGroupMemory | undefined> {
    const [memory] = await db.select().from(militantGroupMemory)
      .where(eq(militantGroupMemory.groupId, groupId));
    return memory || undefined;
  }

  async createMilitantGroupMemory(data: InsertMilitantGroupMemory): Promise<MilitantGroupMemory> {
    const [memory] = await db.insert(militantGroupMemory)
      .values({
        ...data,
        firstInteraction: data.firstInteraction || new Date(),
        lastInteraction: data.lastInteraction || new Date(),
        totalInteractions: data.totalInteractions || 1,
      })
      .returning();
    return memory;
  }

  async updateMilitantGroupMemory(groupId: string, data: Partial<InsertMilitantGroupMemory>): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      return this.createMilitantGroupMemory({ ...data, groupId } as InsertMilitantGroupMemory);
    }

    const [updated] = await db.update(militantGroupMemory)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(militantGroupMemory.groupId, groupId))
      .returning();
    return updated;
  }

  async appendToMilitantGroupMemory(
    groupId: string, 
    field: 'topics' | 'keyMembers' | 'commonQuestions', 
    items: string[]
  ): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      const data: InsertMilitantGroupMemory = {
        groupId,
        [field]: JSON.stringify(items),
      };
      return this.createMilitantGroupMemory(data);
    }

    const existingItems = JSON.parse(existing[field]);
    const updatedItems = [...new Set([...existingItems, ...items])];
    
    const [updated] = await db.update(militantGroupMemory)
      .set({
        [field]: JSON.stringify(updatedItems),
        updatedAt: new Date(),
      })
      .where(eq(militantGroupMemory.groupId, groupId))
      .returning();
    return updated;
  }

  async incrementMilitantGroupInteraction(groupId: string): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      return this.createMilitantGroupMemory({
        groupId,
        totalInteractions: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date(),
      });
    }

    const [updated] = await db.update(militantGroupMemory)
      .set({
        totalInteractions: existing.totalInteractions + 1,
        lastInteraction: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(militantGroupMemory.groupId, groupId))
      .returning();
    return updated;
  }

  // Scheduled Messages
  async getCloneScheduledMessages(): Promise<any[]> {
    const result = await db
      .select({
        id: cloneAgentMessageQueue.id,
        instanceId: cloneAgentMessageQueue.instanceId,
        phoneNumber: cloneAgentMessageQueue.phoneNumber,
        messages: cloneAgentMessageQueue.messages,
        status: cloneAgentMessageQueue.status,
        generatedResponse: cloneAgentMessageQueue.generatedResponse,
        messageHash: cloneAgentMessageQueue.messageHash,
        firstMessageAt: cloneAgentMessageQueue.firstMessageAt,
        collectionEndTime: cloneAgentMessageQueue.collectionEndTime,
        scheduledSendTime: cloneAgentMessageQueue.scheduledSendTime,
        typingDuration: cloneAgentMessageQueue.typingDuration,
        sentAt: cloneAgentMessageQueue.sentAt,
        lockedAt: cloneAgentMessageQueue.lockedAt,
        lockedBy: cloneAgentMessageQueue.lockedBy,
        processedAt: cloneAgentMessageQueue.processedAt,
        errorMessage: cloneAgentMessageQueue.errorMessage,
        retryCount: cloneAgentMessageQueue.retryCount,
        lastAttemptAt: cloneAgentMessageQueue.lastAttemptAt,
        createdAt: cloneAgentMessageQueue.createdAt,
        voterName: voters.nome,
      })
      .from(cloneAgentMessageQueue)
      .leftJoin(voters, eq(cloneAgentMessageQueue.phoneNumber, voters.whatsapp))
      .where(
        and(
          sql`status IN ('completed', 'sending')`,
          sql`sent_at IS NULL`
        )
      )
      .orderBy(cloneAgentMessageQueue.scheduledSendTime);
    return result;
  }

  async getMilitantScheduledMessages(): Promise<MessagesQueue[]> {
    return await db
      .select()
      .from(messagesQueue)
      .where(eq(messagesQueue.isProcessed, false))
      .orderBy(messagesQueue.timestamp);
  }

  async updateCloneScheduledMessage(id: string, data: { messages?: string; generatedResponse?: string; collectionEndTime?: Date; scheduledSendTime?: Date; typingDuration?: number }): Promise<CloneAgentMessageQueue> {
    const [updated] = await db
      .update(cloneAgentMessageQueue)
      .set(data)
      .where(eq(cloneAgentMessageQueue.id, id))
      .returning();
    return updated;
  }

  async updateMilitantScheduledMessage(id: string, data: { message?: string }): Promise<MessagesQueue> {
    const [updated] = await db
      .update(messagesQueue)
      .set(data)
      .where(eq(messagesQueue.id, id))
      .returning();
    return updated;
  }

  async deleteCloneScheduledMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(cloneAgentMessageQueue)
      .where(eq(cloneAgentMessageQueue.id, id));
    return true;
  }

  async deleteMilitantScheduledMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(messagesQueue)
      .where(eq(messagesQueue.id, id));
    return true;
  }

  async getNextAvailableGlobalSlot(): Promise<Date> {
    const { nowInSaoPaulo, toSaoPauloTime } = await import("./lib/timezone.js");
    const now = nowInSaoPaulo();
    
    const scheduledTimes = await db
      .select({ scheduledSendTime: cloneAgentMessageQueue.scheduledSendTime })
      .from(cloneAgentMessageQueue)
      .where(sql`scheduled_send_time IS NOT NULL AND sent_at IS NULL`);
    
    const occupiedMinutes = new Set(
      scheduledTimes
        .map(row => row.scheduledSendTime)
        .filter((time): time is Date => time !== null)
        .map(time => {
          const dt = toSaoPauloTime(time);
          return dt.toFormat('yyyy-MM-dd HH:mm');
        })
    );
    
    let candidateTime = now.set({ hour: 9, minute: 1, second: 0, millisecond: 0 });
    
    if (candidateTime < now) {
      // Se 09:01 de hoje já passou, agendar para 09:01 de amanhã
      candidateTime = candidateTime.plus({ days: 1 });
    }
    
    while (occupiedMinutes.has(candidateTime.toFormat('yyyy-MM-dd HH:mm'))) {
      candidateTime = candidateTime.plus({ minutes: 1 });
    }
    
    return candidateTime.toJSDate();
  }

  async getScheduledMessagesForSending(): Promise<CloneAgentMessageQueue[]> {
    const now = new Date();
    const results = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          sql`scheduled_send_time IS NOT NULL`,
          sql`scheduled_send_time <= ${now}`,
          sql`sent_at IS NULL`,
          sql`status IN ('completed', 'sending')`
        )
      )
      .orderBy(cloneAgentMessageQueue.scheduledSendTime);
    return results as CloneAgentMessageQueue[];
  }

  async markMessageAsSent(id: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({ sentAt: new Date() })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async clearMessageSentAt(id: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({ sentAt: null })
      .where(eq(cloneAgentMessageQueue.id, id));
  }

  async getOrphanedMessages(futureThreshold: Date): Promise<CloneAgentMessageQueue[]> {
    const results = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(
        and(
          sql`scheduled_send_time IS NOT NULL`,
          sql`scheduled_send_time > ${futureThreshold}`,
          sql`sent_at IS NULL`,
          sql`status IN ('completed', 'sending')`
        )
      );
    return results as CloneAgentMessageQueue[];
  }

  // Métodos para deduplicação com hash
  async checkMessageHash(hash: string): Promise<boolean> {
    const result = await db
      .select()
      .from(cloneAgentMessageQueue)
      .where(eq(cloneAgentMessageQueue.messageHash, hash))
      .limit(1);
    return result.length > 0;
  }

  async saveMessageHash(messageQueueId: string, hash: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({ messageHash: hash })
      .where(eq(cloneAgentMessageQueue.id, messageQueueId));
  }

  async removeMessageHash(messageQueueId: string): Promise<void> {
    await db
      .update(cloneAgentMessageQueue)
      .set({ messageHash: null })
      .where(eq(cloneAgentMessageQueue.id, messageQueueId));
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private voters: Map<string, Voter>;
  private campaignMaterials: Map<string, CampaignMaterial>;
  private configOptions: Map<string, ConfigOption>;
  private leaderships: Map<string, Leadership>;
  private assessores: Map<string, Assessor>;
  private instagramAgents: Map<string, InstagramAgent>;
  private collectorAgents: Map<string, CollectorAgent>;
  private replicadorAgentInstance: ReplicadorAgentInstance | null;
  private coletorAgentInstance: ColetorAgentInstance | null;
  private cloneAgentConfig: CloneAgentConfig | null;
  private cloneAgentInstances: Map<string, CloneAgentInstance>;
  private cloneAgentKnowledge: Map<string, CloneAgentKnowledge>;
  private cloneAgentConversations: Map<string, CloneAgentConversation>;
  private cloneAgentMessageQueue: Map<string, CloneAgentMessageQueue>;
  private wahaWebhookConfigs: Map<string, WahaWebhookConfig>;
  private militantAgents: Map<string, MilitantAgent>;
  private militantMessageQueue: Map<string, MilitantMessageQueue>;
  private messagesQueue: Map<string, MessagesQueue>;
  private voterMemories: Map<string, VoterMemory>;
  private militantGroupMemories: Map<string, MilitantGroupMemory>;

  constructor() {
    this.users = new Map();
    this.voters = new Map();
    this.campaignMaterials = new Map();
    this.configOptions = new Map();
    this.leaderships = new Map();
    this.assessores = new Map();
    this.instagramAgents = new Map();
    this.messagesQueue = new Map();
    this.collectorAgents = new Map();
    this.replicadorAgentInstance = null;
    this.coletorAgentInstance = null;
    this.cloneAgentConfig = null;
    this.cloneAgentInstances = new Map();
    this.cloneAgentKnowledge = new Map();
    this.cloneAgentConversations = new Map();
    this.cloneAgentMessageQueue = new Map();
    this.wahaWebhookConfigs = new Map();
    this.militantAgents = new Map();
    this.militantMessageQueue = new Map();
    this.voterMemories = new Map();
    this.militantGroupMemories = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    // Hash the password for consistency with DatabaseStorage
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    const user: User = { ...insertUser, id, password: hashedPassword };
    this.users.set(id, user);
    return user;
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    return await bcrypt.compare(password, user.password);
  }

  // Voters
  async getVoters(): Promise<Voter[]> {
    return Array.from(this.voters.values());
  }

  async getVoter(id: string): Promise<Voter | undefined> {
    return this.voters.get(id);
  }

  async getVoterByWhatsapp(whatsapp: string): Promise<Voter | undefined> {
    return Array.from(this.voters.values()).find(
      (voter) => voter.whatsapp === whatsapp
    );
  }

  async createVoter(insertVoter: InsertVoter): Promise<Voter> {
    // Check if voter with same WhatsApp already exists
    const existingVoter = await this.getVoterByWhatsapp(insertVoter.whatsapp);
    if (existingVoter) {
      throw new DuplicateWhatsAppError(insertVoter.whatsapp);
    }

    const id = randomUUID();
    const voter: Voter = { 
      id,
      nome: insertVoter.nome,
      whatsapp: insertVoter.whatsapp,
      voto: insertVoter.voto,
      votoConfirmado: insertVoter.votoConfirmado ?? false,
      material: insertVoter.material,
      municipio: insertVoter.municipio,
      bairro: insertVoter.bairro || "",
      indicacao: insertVoter.indicacao,
      nameSource: insertVoter.nameSource || null,
      dataCadastro: new Date()
    };
    this.voters.set(id, voter);
    return voter;
  }

  async updateVoter(id: string, updates: Partial<InsertVoter>): Promise<Voter | undefined> {
    const voter = this.voters.get(id);
    if (!voter) return undefined;

    // Check for WhatsApp duplicate if WhatsApp is being updated
    if (updates.whatsapp) {
      const existingVoter = await this.getVoterByWhatsapp(updates.whatsapp);
      if (existingVoter && existingVoter.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }
    
    const updatedVoter = { ...voter, ...updates };
    this.voters.set(id, updatedVoter);
    return updatedVoter;
  }

  async deleteVoter(id: string): Promise<boolean> {
    return this.voters.delete(id);
  }

  async deleteAllVoters(): Promise<{ votersDeleted: number; conversationsDeleted: number; memoryDeleted: number; queueDeleted: number }> {
    const allVoters = Array.from(this.voters.values());
    const phoneNumbers = allVoters.map(v => v.whatsapp);
    
    let conversationsDeleted = 0;
    let memoryDeleted = 0;
    let queueDeleted = 0;
    
    for (const phone of phoneNumbers) {
      const conversationsToDelete = Array.from(this.cloneAgentConversations.values())
        .filter(c => c.phoneNumber === phone);
      conversationsToDelete.forEach(c => this.cloneAgentConversations.delete(c.id));
      conversationsDeleted += conversationsToDelete.length;
      
      const memoryToDelete = Array.from(this.voterMemories.values())
        .filter(m => m.phoneNumber === phone);
      memoryToDelete.forEach(m => this.voterMemories.delete(m.id));
      memoryDeleted += memoryToDelete.length;
      
      const queueToDelete = Array.from(this.cloneAgentMessageQueue.values())
        .filter(q => q.phoneNumber === phone);
      queueToDelete.forEach(q => this.cloneAgentMessageQueue.delete(q.id));
      queueDeleted += queueToDelete.length;
    }
    
    const votersDeleted = this.voters.size;
    this.voters.clear();
    
    return {
      votersDeleted,
      conversationsDeleted,
      memoryDeleted,
      queueDeleted
    };
  }

  async updateVoterConfirmedVote(phoneNumber: string): Promise<Voter | undefined> {
    const existingVoter = await this.getVoterByWhatsapp(phoneNumber);
    
    if (!existingVoter) {
      return undefined;
    }
    
    const updatedVoter = {
      ...existingVoter,
      votoConfirmado: true,
      voto: 'confirmado' as const
    };
    
    this.voters.set(existingVoter.id, updatedVoter);
    return updatedVoter;
  }

  // Campaign Materials
  async getCampaignMaterials(): Promise<CampaignMaterial[]> {
    return Array.from(this.campaignMaterials.values());
  }

  async getCampaignMaterial(id: string): Promise<CampaignMaterial | undefined> {
    return this.campaignMaterials.get(id);
  }

  async createCampaignMaterial(insertMaterial: InsertCampaignMaterial): Promise<CampaignMaterial> {
    const id = randomUUID();
    const material: CampaignMaterial = { 
      id,
      tipoMaterial: insertMaterial.tipoMaterial,
      entrega: insertMaterial.entrega,
      destinatario: insertMaterial.destinatario,
      quantidade: insertMaterial.quantidade || 0,
      status: insertMaterial.status || "em_preparacao"
    };
    this.campaignMaterials.set(id, material);
    return material;
  }

  async updateCampaignMaterial(id: string, updates: Partial<InsertCampaignMaterial>): Promise<CampaignMaterial | undefined> {
    const material = this.campaignMaterials.get(id);
    if (!material) return undefined;
    
    const updatedMaterial = { ...material, ...updates };
    this.campaignMaterials.set(id, updatedMaterial);
    return updatedMaterial;
  }

  async deleteCampaignMaterial(id: string): Promise<boolean> {
    return this.campaignMaterials.delete(id);
  }

  // Configuration Options
  async getConfigOptions(): Promise<ConfigOption[]> {
    return Array.from(this.configOptions.values());
  }

  async getConfigOptionsByType(fieldType: string): Promise<ConfigOption[]> {
    return Array.from(this.configOptions.values()).filter(
      (option) => option.fieldType === fieldType
    );
  }

  async getBairrosByMunicipio(municipio: string): Promise<ConfigOption[]> {
    return Array.from(this.configOptions.values()).filter(
      (option) => option.fieldType === 'bairro' && option.parentMunicipio === municipio
    );
  }

  async getConfigOption(id: string): Promise<ConfigOption | undefined> {
    return this.configOptions.get(id);
  }

  async createConfigOption(insertOption: InsertConfigOption): Promise<ConfigOption> {
    const id = randomUUID();
    const option: ConfigOption = { 
      id, 
      fieldType: insertOption.fieldType, 
      value: insertOption.value,
      parentMunicipio: insertOption.parentMunicipio || null
    };
    this.configOptions.set(id, option);
    return option;
  }

  async deleteConfigOption(id: string): Promise<boolean> {
    return this.configOptions.delete(id);
  }

  // Leaderships
  async getLeaderships(): Promise<Leadership[]> {
    return Array.from(this.leaderships.values());
  }

  async getLeadership(id: string): Promise<Leadership | undefined> {
    return this.leaderships.get(id);
  }

  async getLeadershipByWhatsapp(whatsapp: string): Promise<Leadership | undefined> {
    return Array.from(this.leaderships.values()).find(
      (leadership) => leadership.whatsapp === whatsapp
    );
  }

  async createLeadership(insertLeadership: InsertLeadership): Promise<Leadership> {
    // Check for duplicate WhatsApp
    const existingLeadership = await this.getLeadershipByWhatsapp(insertLeadership.whatsapp ?? "");
    if (existingLeadership) {
      throw new DuplicateWhatsAppError(insertLeadership.whatsapp ?? "");
    }

    const id = randomUUID();
    const leadership: Leadership = { 
      id,
      nome: insertLeadership.nome,
      whatsapp: insertLeadership.whatsapp ?? "",
      investimento: insertLeadership.investimento ?? "",
      materialEnviado: insertLeadership.materialEnviado ?? "",
      municipio: insertLeadership.municipio ?? "",
      bairro: insertLeadership.bairro ?? "",
      anotacoes: insertLeadership.anotacoes ?? "",
      dataCadastro: new Date()
    };
    this.leaderships.set(id, leadership);
    return leadership;
  }

  async updateLeadership(id: string, updates: Partial<InsertLeadership>): Promise<Leadership | undefined> {
    const leadership = this.leaderships.get(id);
    if (!leadership) return undefined;
    
    // Check for WhatsApp duplicate if WhatsApp is being updated
    if (updates.whatsapp) {
      const existingLeadership = await this.getLeadershipByWhatsapp(updates.whatsapp);
      if (existingLeadership && existingLeadership.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }
    
    const updatedLeadership = { ...leadership, ...updates };
    this.leaderships.set(id, updatedLeadership);
    return updatedLeadership;
  }

  async deleteLeadership(id: string): Promise<boolean> {
    return this.leaderships.delete(id);
  }

  // Assessores
  async getAssessores(): Promise<Assessor[]> {
    return Array.from(this.assessores.values());
  }

  async getAssessor(id: string): Promise<Assessor | undefined> {
    return this.assessores.get(id);
  }

  async getAssessorByWhatsapp(whatsapp: string): Promise<Assessor | undefined> {
    return Array.from(this.assessores.values()).find(
      (assessor) => assessor.whatsapp === whatsapp
    );
  }

  async createAssessor(insertAssessor: InsertAssessor): Promise<Assessor> {
    // Check for duplicate WhatsApp
    const existingAssessor = await this.getAssessorByWhatsapp(insertAssessor.whatsapp ?? "");
    if (existingAssessor) {
      throw new DuplicateWhatsAppError(insertAssessor.whatsapp ?? "");
    }

    const id = randomUUID();
    const assessor: Assessor = { 
      id,
      nome: insertAssessor.nome,
      whatsapp: insertAssessor.whatsapp ?? "",
      investimento: insertAssessor.investimento ?? "",
      materialEnviado: insertAssessor.materialEnviado ?? "",
      municipio: insertAssessor.municipio ?? "",
      bairro: insertAssessor.bairro ?? "",
      anotacoes: insertAssessor.anotacoes ?? "",
      dataCadastro: new Date()
    };
    this.assessores.set(id, assessor);
    return assessor;
  }

  async updateAssessor(id: string, updates: Partial<InsertAssessor>): Promise<Assessor | undefined> {
    const assessor = this.assessores.get(id);
    if (!assessor) return undefined;
    
    // Check for WhatsApp duplicate if WhatsApp is being updated
    if (updates.whatsapp) {
      const existingAssessor = await this.getAssessorByWhatsapp(updates.whatsapp);
      if (existingAssessor && existingAssessor.id !== id) {
        throw new DuplicateWhatsAppError(updates.whatsapp);
      }
    }
    
    const updatedAssessor = { ...assessor, ...updates };
    this.assessores.set(id, updatedAssessor);
    return updatedAssessor;
  }

  async deleteAssessor(id: string): Promise<boolean> {
    return this.assessores.delete(id);
  }

  // Instagram Agents
  async getInstagramAgents(): Promise<InstagramAgent[]> {
    return Array.from(this.instagramAgents.values());
  }

  async getInstagramAgent(id: string): Promise<InstagramAgent | undefined> {
    return this.instagramAgents.get(id);
  }

  async upsertInstagramAgent(data: InsertInstagramAgent): Promise<InstagramAgent> {
    const existing = Array.from(this.instagramAgents.values()).find(
      (agent) => agent.instagramUrl === data.instagramUrl
    );

    if (existing) {
      const updated: InstagramAgent = { ...existing, ...data };
      this.instagramAgents.set(existing.id, updated);
      return updated;
    }

    const id = randomUUID();
    const agent: InstagramAgent = {
      id,
      instagramUrl: data.instagramUrl,
      whatsappRecipient: data.whatsappRecipient,
      groupName: data.groupName ?? "",
      personName: data.personName ?? "",
      personInstagram: data.personInstagram ?? "",
      isActive: data.isActive ?? false,
      lastPostId: data.lastPostId ?? null,
      lastRunAt: data.lastRunAt ?? null,
      executionLogs: data.executionLogs ?? "[]",
      createdAt: new Date()
    };
    this.instagramAgents.set(id, agent);
    return agent;
  }

  async updateInstagramAgent(id: string, data: Partial<InsertInstagramAgent>): Promise<InstagramAgent> {
    const agent = this.instagramAgents.get(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const updated = { ...agent, ...data };
    this.instagramAgents.set(id, updated);
    return updated;
  }

  async toggleInstagramAgent(id: string, isActive: boolean): Promise<InstagramAgent> {
    const agent = this.instagramAgents.get(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const updated = { ...agent, isActive };
    this.instagramAgents.set(id, updated);
    return updated;
  }

  async updateLastRun(id: string, lastPostId: string | null, lastRunAt: Date): Promise<InstagramAgent> {
    const agent = this.instagramAgents.get(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const updated = { ...agent, lastPostId, lastRunAt };
    this.instagramAgents.set(id, updated);
    return updated;
  }

  async appendExecutionLog(id: string, logMessage: string): Promise<InstagramAgent> {
    const agent = this.instagramAgents.get(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const updated = { ...agent, executionLogs: JSON.stringify(recentLogs) };
    this.instagramAgents.set(id, updated);
    return updated;
  }

  async appendExecutionLogs(id: string, logMessages: string[]): Promise<InstagramAgent> {
    const agent = this.instagramAgents.get(id);
    if (!agent) {
      throw new Error(`Instagram agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    const timestamp = new Date().toISOString();
    logMessages.forEach(msg => {
      logs.push({ timestamp, message: msg });
    });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const updated = { ...agent, executionLogs: JSON.stringify(recentLogs) };
    this.instagramAgents.set(id, updated);
    return updated;
  }

  async deleteInstagramAgent(id: string): Promise<boolean> {
    return this.instagramAgents.delete(id);
  }

  // Collector Agents
  async getCollectorAgents(): Promise<CollectorAgent[]> {
    return Array.from(this.collectorAgents.values());
  }

  async getCollectorAgent(id: string): Promise<CollectorAgent | undefined> {
    return this.collectorAgents.get(id);
  }

  async upsertCollectorAgent(data: InsertCollectorAgent): Promise<CollectorAgent> {
    const existing = Array.from(this.collectorAgents.values()).find(
      (agent) => agent.groupId === data.groupId,
    );

    if (existing) {
      const updated = { ...existing, ...data };
      this.collectorAgents.set(existing.id, updated);
      return updated;
    }

    const id = randomUUID();
    const agent: CollectorAgent = {
      id,
      ...data,
      bairro: data.bairro || "",
      isActive: data.isActive ?? false,
      lastMemberCount: data.lastMemberCount ?? 0,
      lastProcessedMemberIds: data.lastProcessedMemberIds || "[]",
      lastRunAt: data.lastRunAt || null,
      executionLogs: data.executionLogs || "[]",
      createdAt: new Date(),
    };
    this.collectorAgents.set(id, agent);
    return agent;
  }

  async updateCollectorAgent(id: string, data: Partial<InsertCollectorAgent>): Promise<CollectorAgent> {
    const agent = this.collectorAgents.get(id);
    if (!agent) {
      throw new Error(`Collector agent with id ${id} not found`);
    }
    const updated = { ...agent, ...data };
    this.collectorAgents.set(id, updated);
    return updated;
  }

  async toggleCollectorAgent(id: string, isActive: boolean): Promise<CollectorAgent> {
    const agent = this.collectorAgents.get(id);
    if (!agent) {
      throw new Error(`Collector agent with id ${id} not found`);
    }
    const updated = { ...agent, isActive };
    this.collectorAgents.set(id, updated);
    return updated;
  }

  async updateCollectorLastRun(id: string, memberCount: number, memberIds: string[], lastRunAt: Date): Promise<CollectorAgent> {
    const agent = this.collectorAgents.get(id);
    if (!agent) {
      throw new Error(`Collector agent with id ${id} not found`);
    }
    const updated = { 
      ...agent, 
      lastMemberCount: memberCount, 
      lastProcessedMemberIds: JSON.stringify(memberIds),
      lastRunAt 
    };
    this.collectorAgents.set(id, updated);
    return updated;
  }

  async appendCollectorExecutionLog(id: string, logMessage: string): Promise<CollectorAgent> {
    const agent = this.collectorAgents.get(id);
    if (!agent) {
      throw new Error(`Collector agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 50 logs
    const recentLogs = logs.slice(-50);
    const updated = { ...agent, executionLogs: JSON.stringify(recentLogs) };
    this.collectorAgents.set(id, updated);
    return updated;
  }

  async deleteCollectorAgent(id: string): Promise<boolean> {
    return this.collectorAgents.delete(id);
  }

  // Replicador Agent Instances (limited to one instance)
  async getReplicadorAgentInstance(): Promise<ReplicadorAgentInstance | null> {
    return this.replicadorAgentInstance;
  }

  async createReplicadorAgentInstance(data: InsertReplicadorAgentInstance): Promise<ReplicadorAgentInstance> {
    if (this.replicadorAgentInstance) {
      throw new Error("Já existe uma instância do Agente Replicador. Delete a instância existente antes de criar uma nova.");
    }
    const id = randomUUID();
    const instance: ReplicadorAgentInstance = {
      id,
      ...data,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.replicadorAgentInstance = instance;
    return instance;
  }

  async updateReplicadorAgentInstance(id: string, data: Partial<InsertReplicadorAgentInstance>): Promise<ReplicadorAgentInstance> {
    if (!this.replicadorAgentInstance || this.replicadorAgentInstance.id !== id) {
      throw new Error(`Replicador agent instance with id ${id} not found`);
    }
    const updated = { ...this.replicadorAgentInstance, ...data, updatedAt: new Date() };
    this.replicadorAgentInstance = updated;
    return updated;
  }

  async toggleReplicadorAgentInstance(id: string, isActive: boolean): Promise<ReplicadorAgentInstance> {
    if (!this.replicadorAgentInstance || this.replicadorAgentInstance.id !== id) {
      throw new Error(`Replicador agent instance with id ${id} not found`);
    }
    const updated = { ...this.replicadorAgentInstance, isActive, updatedAt: new Date() };
    this.replicadorAgentInstance = updated;
    return updated;
  }

  async deleteReplicadorAgentInstance(id: string): Promise<boolean> {
    if (this.replicadorAgentInstance && this.replicadorAgentInstance.id === id) {
      this.replicadorAgentInstance = null;
      return true;
    }
    return false;
  }

  async updateReplicadorAgentLastRun(id: string, lastRunAt: Date): Promise<ReplicadorAgentInstance> {
    if (!this.replicadorAgentInstance || this.replicadorAgentInstance.id !== id) {
      throw new Error(`Replicador agent instance with id ${id} not found`);
    }
    const updated = { ...this.replicadorAgentInstance, lastRunAt, updatedAt: new Date() };
    this.replicadorAgentInstance = updated;
    return updated;
  }

  // Coletor Agent Instances (limited to one instance)
  async getColetorAgentInstance(): Promise<ColetorAgentInstance | null> {
    return this.coletorAgentInstance;
  }

  async createColetorAgentInstance(data: InsertColetorAgentInstance): Promise<ColetorAgentInstance> {
    if (this.coletorAgentInstance) {
      throw new Error("Já existe uma instância do Agente Coletor. Delete a instância existente antes de criar uma nova.");
    }
    const id = randomUUID();
    const instance: ColetorAgentInstance = {
      id,
      ...data,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.coletorAgentInstance = instance;
    return instance;
  }

  async updateColetorAgentInstance(id: string, data: Partial<InsertColetorAgentInstance>): Promise<ColetorAgentInstance> {
    if (!this.coletorAgentInstance || this.coletorAgentInstance.id !== id) {
      throw new Error(`Coletor agent instance with id ${id} not found`);
    }
    const updated = { ...this.coletorAgentInstance, ...data, updatedAt: new Date() };
    this.coletorAgentInstance = updated;
    return updated;
  }

  async toggleColetorAgentInstance(id: string, isActive: boolean): Promise<ColetorAgentInstance> {
    if (!this.coletorAgentInstance || this.coletorAgentInstance.id !== id) {
      throw new Error(`Coletor agent instance with id ${id} not found`);
    }
    const updated = { ...this.coletorAgentInstance, isActive, updatedAt: new Date() };
    this.coletorAgentInstance = updated;
    return updated;
  }

  async deleteColetorAgentInstance(id: string): Promise<boolean> {
    if (this.coletorAgentInstance && this.coletorAgentInstance.id === id) {
      this.coletorAgentInstance = null;
      return true;
    }
    return false;
  }

  async updateColetorAgentLastRun(id: string, lastRunAt: Date): Promise<ColetorAgentInstance> {
    if (!this.coletorAgentInstance || this.coletorAgentInstance.id !== id) {
      throw new Error(`Coletor agent instance with id ${id} not found`);
    }
    const updated = { ...this.coletorAgentInstance, lastRunAt, updatedAt: new Date() };
    this.coletorAgentInstance = updated;
    return updated;
  }

  // Clone Agent Config (Singleton)
  async getCloneAgentConfig(): Promise<CloneAgentConfig | null> {
    return this.cloneAgentConfig;
  }

  async createCloneAgentConfig(data: InsertCloneAgentConfig): Promise<CloneAgentConfig> {
    const id = randomUUID();
    const config: CloneAgentConfig = {
      id,
      ...data,
      messageCollectionTime: data.messageCollectionTime ?? 30,
      sendDelaySeconds: data.sendDelaySeconds ?? 5,
      ollamaModel: data.ollamaModel ?? "deepseek-v3.1:671b-cloud",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cloneAgentConfig = config;
    return config;
  }

  async updateCloneAgentConfig(id: string, data: Partial<InsertCloneAgentConfig>): Promise<CloneAgentConfig> {
    if (!this.cloneAgentConfig || this.cloneAgentConfig.id !== id) {
      throw new Error(`Clone agent config with id ${id} not found`);
    }
    const updated: CloneAgentConfig = {
      ...this.cloneAgentConfig,
      ...data,
      updatedAt: new Date(),
    };
    this.cloneAgentConfig = updated;
    return updated;
  }

  // Clone Agent Instances
  async getCloneAgentInstances(): Promise<CloneAgentInstance[]> {
    return Array.from(this.cloneAgentInstances.values());
  }

  async getCloneAgentInstance(id: string): Promise<CloneAgentInstance | undefined> {
    return this.cloneAgentInstances.get(id);
  }

  async createCloneAgentInstance(data: InsertCloneAgentInstance): Promise<CloneAgentInstance> {
    const id = randomUUID();
    const instance: CloneAgentInstance = {
      id,
      ...data,
      isActive: data.isActive ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cloneAgentInstances.set(id, instance);
    return instance;
  }

  async updateCloneAgentInstance(id: string, data: Partial<InsertCloneAgentInstance>): Promise<CloneAgentInstance> {
    const instance = this.cloneAgentInstances.get(id);
    if (!instance) {
      throw new Error(`Clone agent instance with id ${id} not found`);
    }
    const updated: CloneAgentInstance = {
      ...instance,
      ...data,
      updatedAt: new Date(),
    };
    this.cloneAgentInstances.set(id, updated);
    return updated;
  }

  async toggleCloneAgentInstance(id: string, isActive: boolean): Promise<CloneAgentInstance> {
    const instance = this.cloneAgentInstances.get(id);
    if (!instance) {
      throw new Error(`Clone agent instance with id ${id} not found`);
    }
    const updated: CloneAgentInstance = {
      ...instance,
      isActive,
      updatedAt: new Date(),
    };
    this.cloneAgentInstances.set(id, updated);
    return updated;
  }

  async deleteCloneAgentInstance(id: string): Promise<boolean> {
    Array.from(this.cloneAgentConversations.values())
      .filter(c => c.instanceId === id)
      .forEach(c => this.cloneAgentConversations.delete(`${c.instanceId}:${c.phoneNumber}`));
    
    Array.from(this.cloneAgentMessageQueue.values())
      .filter(q => q.instanceId === id)
      .forEach(q => this.cloneAgentMessageQueue.delete(q.id));
    
    return this.cloneAgentInstances.delete(id);
  }

  // Clone Agent Knowledge (uses configId)
  async getCloneAgentKnowledge(configId: string): Promise<CloneAgentKnowledge[]> {
    return Array.from(this.cloneAgentKnowledge.values())
      .filter(k => k.configId === configId);
  }

  async createCloneAgentKnowledge(data: InsertCloneAgentKnowledge): Promise<CloneAgentKnowledge> {
    const id = randomUUID();
    const knowledge: CloneAgentKnowledge = {
      id,
      ...data,
      embedding: data.embedding ?? null,
      createdAt: new Date(),
    };
    this.cloneAgentKnowledge.set(id, knowledge);
    return knowledge;
  }

  async deleteCloneAgentKnowledge(id: string): Promise<boolean> {
    return this.cloneAgentKnowledge.delete(id);
  }

  async searchKnowledgeSemantic(configId: string, query: string, limit: number): Promise<Array<{ content: string; similarity: number }>> {
    const knowledge = await this.getCloneAgentKnowledge(configId);
    return knowledge.slice(0, limit).map(k => ({
      content: k.content,
      similarity: 0
    }));
  }

  // Clone Agent Message Queue (uses instanceId)
  async getCloneAgentMessageQueue(instanceId: string, phoneNumber: string): Promise<CloneAgentMessageQueue | undefined> {
    return Array.from(this.cloneAgentMessageQueue.values())
      .find(q => q.instanceId === instanceId && q.phoneNumber === phoneNumber && (q.status === 'collecting' || q.status === 'ready' || q.status === 'processing'));
  }

  async createOrUpdateMessageQueue(data: InsertCloneAgentMessageQueue): Promise<CloneAgentMessageQueue> {
    const existing = await this.getCloneAgentMessageQueue(data.instanceId!, data.phoneNumber);
    
    if (existing) {
      const now = new Date();
      const collectionEnd = new Date(existing.collectionEndTime);
      
      if ((existing.status === 'completed' || existing.status === 'failed') && now > collectionEnd) {
      } else {
        
        let existingMessages: any[] = [];
        try {
          const parsed = JSON.parse(existing.messages);
          existingMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          existingMessages = [existing.messages];
        }
        
        let newMessages: any[] = [];
        try {
          const parsed = JSON.parse(data.messages || "[]");
          newMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          newMessages = data.messages ? [data.messages] : [];
        }
        
        const allMessages = [...existingMessages, ...newMessages];
        
        const updated: CloneAgentMessageQueue = {
          ...existing,
          messages: JSON.stringify(allMessages),
        };
        this.cloneAgentMessageQueue.set(existing.id, updated);
        
        
        return updated;
      }
    }
    
    const id = randomUUID();
    const queue: CloneAgentMessageQueue = {
      id,
      instanceId: data.instanceId!,
      phoneNumber: data.phoneNumber,
      messages: data.messages || "[]",
      status: data.status || 'collecting',
      generatedResponse: null,
      messageHash: null, // Campo para deduplicação
      firstMessageAt: new Date(),
      collectionEndTime: data.collectionEndTime!,
      scheduledSendTime: data.scheduledSendTime ?? null,
      typingDuration: data.typingDuration ?? null,
      sentAt: null,
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      errorMessage: data.errorMessage ?? null,
      retryCount: data.retryCount ?? 0,
      lastAttemptAt: null,
      createdAt: new Date(),
    };
    this.cloneAgentMessageQueue.set(id, queue);
    return queue;
  }

  async getUnprocessedMessageQueues(): Promise<CloneAgentMessageQueue[]> {
    const now = new Date();
    const MAX_RETRIES = 3;
    return Array.from(this.cloneAgentMessageQueue.values())
      .filter(q => (q.status === 'collecting' || q.status === 'ready') && q.collectionEndTime <= now && (q.retryCount || 0) < MAX_RETRIES);
  }

  async markQueueProcessing(id: string): Promise<boolean> {
    // Controle de duplicação é feito em memória no worker
    return true;
  }

  async clearQueueProcessing(id: string): Promise<void> {
    // Controle de duplicação é feito em memória no worker
  }

  async recordProcessingAttempt(id: string): Promise<void> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (queue) {
      const updated: CloneAgentMessageQueue = {
        ...queue,
        retryCount: (queue.retryCount || 0) + 1,
        lastAttemptAt: new Date(),
        status: 'completed', // Marcar como completada imediatamente
        processedAt: new Date(),
      };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async markQueueFailed(id: string, errorMessage: string): Promise<void> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (queue) {
      const updated: CloneAgentMessageQueue = {
        ...queue,
        status: 'failed',
        lastAttemptAt: new Date(),
        errorMessage: errorMessage.substring(0, 1000),
      };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async markQueueSucceeded(id: string, generatedResponse?: string): Promise<void> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (queue) {
      const updated: CloneAgentMessageQueue = {
        ...queue,
        status: 'completed',
        processedAt: new Date(),
        generatedResponse: generatedResponse || null,
      };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async updateMessageQueueTime(id: string, collectionEndTime: Date): Promise<void> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (queue) {
      const updated: CloneAgentMessageQueue = {
        ...queue,
        collectionEndTime,
        status: 'collecting',
      };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async saveGeneratedResponse(id: string, generatedResponse: string): Promise<void> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (queue) {
      const updated: CloneAgentMessageQueue = {
        ...queue,
        generatedResponse,
      };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async markMessageQueueProcessed(id: string): Promise<CloneAgentMessageQueue> {
    const queue = this.cloneAgentMessageQueue.get(id);
    if (!queue) {
      throw new Error(`Message queue with id ${id} not found`);
    }
    const updated: CloneAgentMessageQueue = {
      ...queue,
      status: 'completed',
      processedAt: new Date(),
    };
    this.cloneAgentMessageQueue.set(id, updated);
    return updated;
  }

  // Atomic Queue Operations (uses status field for better control)
  async getOrCreateActiveQueue(instanceId: string, phoneNumber: string, collectionTimeSeconds: number): Promise<CloneAgentMessageQueue> {
    
    const activeQueue = Array.from(this.cloneAgentMessageQueue.values())
      .find(q => 
        q.instanceId === instanceId && 
        q.phoneNumber === phoneNumber && 
        (q.status === 'collecting' || q.status === 'ready')
      );
    
    if (activeQueue) {
      return activeQueue;
    }
    
    
    const now = new Date();
    const collectionEndTime = new Date(now.getTime() + collectionTimeSeconds * 1000);
    const id = randomUUID();
    
    const newQueue: CloneAgentMessageQueue = {
      id,
      instanceId,
      phoneNumber,
      messages: "[]",
      status: "collecting",
      generatedResponse: null,
      messageHash: null,
      firstMessageAt: now,
      collectionEndTime,
      scheduledSendTime: null,
      typingDuration: null,
      sentAt: null,
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      errorMessage: null,
      retryCount: 0,
      lastAttemptAt: null,
      createdAt: now,
    };
    
    this.cloneAgentMessageQueue.set(id, newQueue);
    
    
    return newQueue;
  }

  async appendMessageToQueue(queueId: string, message: string): Promise<CloneAgentMessageQueue> {
    
    const queue = this.cloneAgentMessageQueue.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    let messages: any[] = [];
    try {
      const parsed = JSON.parse(queue.messages);
      messages = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      messages = [];
    }
    
    messages.push(message);
    
    const updated: CloneAgentMessageQueue = {
      ...queue,
      messages: JSON.stringify(messages),
      status: "collecting",
    };
    
    this.cloneAgentMessageQueue.set(queueId, updated);
    
    
    return updated;
  }

  async getQueuesReadyForProcessing(): Promise<CloneAgentMessageQueue[]> {
    const now = new Date();
    
    const queues = Array.from(this.cloneAgentMessageQueue.values())
      .filter(q => 
        (q.status === 'collecting' || q.status === 'ready') &&
        q.collectionEndTime <= now
      );
    
    // Só logar quando houver filas para processar
    if (queues.length > 0) {
    }
    
    return queues;
  }

  async claimQueueForProcessing(queueId: string, lockId: string): Promise<boolean> {
    
    const queue = this.cloneAgentMessageQueue.get(queueId);
    
    if (!queue) {
      return false;
    }
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (queue.lockedAt && queue.lockedAt >= fiveMinutesAgo) {
      return false;
    }
    
    const updated: CloneAgentMessageQueue = {
      ...queue,
      status: "processing",
      lockedAt: now,
      lockedBy: lockId,
    };
    
    this.cloneAgentMessageQueue.set(queueId, updated);
    
    
    return true;
  }

  async completeQueueWithResponse(queueId: string, generatedResponse: string): Promise<CloneAgentMessageQueue> {
    
    const queue = this.cloneAgentMessageQueue.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const updated: CloneAgentMessageQueue = {
      ...queue,
      status: "completed",
      generatedResponse,
      processedAt: new Date(),
    };
    
    this.cloneAgentMessageQueue.set(queueId, updated);
    
    
    return updated;
  }

  async failQueue(queueId: string, errorMessage: string): Promise<CloneAgentMessageQueue> {
    
    const queue = this.cloneAgentMessageQueue.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const newRetryCount = (queue.retryCount || 0) + 1;
    const newStatus = newRetryCount >= 3 ? "failed" : "ready";
    
    const updated: CloneAgentMessageQueue = {
      ...queue,
      status: newStatus,
      errorMessage: errorMessage.substring(0, 1000),
      retryCount: newRetryCount,
      lastAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    };
    
    this.cloneAgentMessageQueue.set(queueId, updated);
    
    if (newStatus === "failed") {
    } else {
    }
    
    return updated;
  }

  // Clone Agent Conversations (uses instanceId)
  private limitConversationHistory(messages: Array<{role: string, content: string}>): Array<{role: string, content: string}> {
    const MAX_MESSAGES = 50; // Aumentado de 20 para 50 mensagens
    const KEEP_FIRST = 10;   // Mantém as 10 primeiras mensagens
    const KEEP_LAST = 40;     // Mantém as 40 últimas mensagens

    if (messages.length <= MAX_MESSAGES) {
      return messages;
    }

    const firstMessages = messages.slice(0, KEEP_FIRST);
    const lastMessages = messages.slice(-KEEP_LAST);
    
    // Adiciona marcador de transição
    const transitionMarker = {
      role: "system",
      content: `[... ${messages.length - MAX_MESSAGES} mensagens intermediárias omitidas para contexto ...]`
    };
    
    return [...firstMessages, transitionMarker, ...lastMessages];
  }

  async getConversation(instanceId: string, phoneNumber: string): Promise<CloneAgentConversation | undefined> {
    const key = `${instanceId}:${phoneNumber}`;
    return this.cloneAgentConversations.get(key);
  }

  async saveConversation(instanceId: string, phoneNumber: string, messages: Array<{role: string, content: string}>): Promise<CloneAgentConversation> {
    const key = `${instanceId}:${phoneNumber}`;
    const existing = this.cloneAgentConversations.get(key);
    const limitedMessages = this.limitConversationHistory(messages);
    const messagesJson = JSON.stringify(limitedMessages);
    
    if (existing) {
      const updated: CloneAgentConversation = {
        ...existing,
        messages: messagesJson,
        lastMessageAt: new Date(),
      };
      this.cloneAgentConversations.set(key, updated);
      return updated;
    } else {
      const conversation: CloneAgentConversation = {
        id: randomUUID(),
        instanceId,
        phoneNumber,
        messages: messagesJson,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };
      this.cloneAgentConversations.set(key, conversation);
      return conversation;
    }
  }

  async clearConversation(instanceId: string, phoneNumber: string): Promise<boolean> {
    const key = `${instanceId}:${phoneNumber}`;
    return this.cloneAgentConversations.delete(key);
  }

  async getCloneAgentConversations(instanceId?: string, search?: string, limit: number = 30): Promise<Array<CloneAgentConversation & { voterName?: string }>> {
    let conversations = Array.from(this.cloneAgentConversations.values());
    
    // Filter by instanceId if provided
    if (instanceId) {
      conversations = conversations.filter(c => c.instanceId === instanceId);
    }
    
    // Search by name or phone if provided
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      conversations = conversations.filter(c => {
        const voter = Array.from(this.voters.values()).find(v => v.whatsapp === c.phoneNumber);
        const voterName = voter?.nome?.toLowerCase() || '';
        const phoneMatch = c.phoneNumber.toLowerCase().includes(searchLower);
        const nameMatch = voterName.includes(searchLower);
        return phoneMatch || nameMatch;
      });
    }
    
    // Sort by lastMessageAt DESC
    conversations.sort((a, b) => {
      const timeA = a.lastMessageAt?.getTime() || 0;
      const timeB = b.lastMessageAt?.getTime() || 0;
      return timeB - timeA;
    });
    
    // Limit results
    conversations = conversations.slice(0, limit);
    
    // Add voter names and normalize messages to JSON string
    return conversations.map(c => {
      const voter = Array.from(this.voters.values()).find(v => v.whatsapp === c.phoneNumber);
      return {
        ...c,
        messages: typeof c.messages === 'string' ? c.messages : JSON.stringify(c.messages || []),
        voterName: voter?.nome || undefined,
      };
    });
  }

  async getCloneAgentConversationMessages(conversationId: string, limit: number = 50): Promise<Array<{role: string, content: string, timestamp?: string}>> {
    const conversation = Array.from(this.cloneAgentConversations.values()).find(c => c.id === conversationId);
    
    if (!conversation) {
      return [];
    }
    
    const messages = JSON.parse(conversation.messages || '[]');
    
    // Return last N messages
    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }
    
    return messages;
  }

  // Waha Webhook Config
  async getWahaWebhookConfig(): Promise<WahaWebhookConfig | null> {
    const configs = Array.from(this.wahaWebhookConfigs.values());
    return configs[0] || null;
  }

  async createWahaWebhookConfig(config: InsertWahaWebhookConfig): Promise<WahaWebhookConfig> {
    this.wahaWebhookConfigs.clear();
    
    const id = randomUUID();
    const webhookConfig: WahaWebhookConfig = {
      id,
      ...config,
      enabledEvents: config.enabledEvents || '["message"]',
      isActive: config.isActive ?? false,
      lastReceivedAt: null,
      totalMessagesProcessed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.wahaWebhookConfigs.set(id, webhookConfig);
    return webhookConfig;
  }

  async updateWahaWebhookConfig(id: string, config: Partial<Omit<WahaWebhookConfig, 'id' | 'createdAt' | 'updatedAt'>>, incrementMessagesProcessed?: boolean): Promise<WahaWebhookConfig> {
    const webhookConfig = this.wahaWebhookConfigs.get(id);
    if (!webhookConfig) {
      throw new Error(`Waha webhook config with id ${id} not found`);
    }
    
    const updated = { ...webhookConfig, ...config, updatedAt: new Date() };
    
    // If incrementMessagesProcessed is true, increment atomically
    if (incrementMessagesProcessed) {
      updated.totalMessagesProcessed = (webhookConfig.totalMessagesProcessed || 0) + 1;
    }
    
    this.wahaWebhookConfigs.set(id, updated);
    return updated;
  }

  async deleteWahaWebhookConfig(id: string): Promise<void> {
    this.wahaWebhookConfigs.delete(id);
  }

  // Militant Agents
  async getMilitantAgents(): Promise<MilitantAgent[]> {
    return Array.from(this.militantAgents.values());
  }

  async getMilitantAgent(id: string): Promise<MilitantAgent | undefined> {
    return this.militantAgents.get(id);
  }

  async createMilitantAgent(data: InsertMilitantAgent): Promise<MilitantAgent> {
    const id = randomUUID();
    const agent: MilitantAgent = {
      id,
      ...data,
      isActive: data.isActive ?? false,
      groups: data.groups || "[]",
      lastMessageTimestamp: data.lastMessageTimestamp || "{}",
      executionLogs: data.executionLogs || "[]",
      messageCollectionTime: data.messageCollectionTime ?? 30,
      flowMinutes: data.flowMinutes ?? 10,
      ollamaModel: data.ollamaModel || "deepseek-v3.1:671b-cloud",
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.militantAgents.set(id, agent);
    return agent;
  }

  async updateMilitantAgent(id: string, data: Partial<InsertMilitantAgent>): Promise<MilitantAgent> {
    const agent = this.militantAgents.get(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const updated = { ...agent, ...data, updatedAt: new Date() };
    this.militantAgents.set(id, updated);
    return updated;
  }

  async deleteMilitantAgent(id: string): Promise<boolean> {
    return this.militantAgents.delete(id);
  }

  async toggleMilitantAgent(id: string, isActive: boolean): Promise<MilitantAgent> {
    const agent = this.militantAgents.get(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const updated = { ...agent, isActive, updatedAt: new Date() };
    this.militantAgents.set(id, updated);
    return updated;
  }

  async appendMilitantAgentLog(id: string, logMessage: string): Promise<MilitantAgent> {
    const agent = this.militantAgents.get(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const logs = JSON.parse(agent.executionLogs || "[]");
    logs.push({ timestamp: new Date().toISOString(), message: logMessage });
    // Keep only last 100 logs
    const recentLogs = logs.slice(-100);
    const updated = { ...agent, executionLogs: JSON.stringify(recentLogs), updatedAt: new Date() };
    this.militantAgents.set(id, updated);
    return updated;
  }

  async updateMilitantAgentGroups(id: string, groups: Array<{id: string, name: string, active: boolean}>): Promise<MilitantAgent> {
    const agent = this.militantAgents.get(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const updated = { ...agent, groups: JSON.stringify(groups), updatedAt: new Date() };
    this.militantAgents.set(id, updated);
    return updated;
  }

  async updateMilitantAgentLastRun(id: string, lastMessageTimestamp: Record<string, string>): Promise<MilitantAgent> {
    const agent = this.militantAgents.get(id);
    if (!agent) {
      throw new Error(`Militant agent with id ${id} not found`);
    }
    const updated = { 
      ...agent, 
      lastRunAt: new Date(), 
      lastMessageTimestamp: JSON.stringify(lastMessageTimestamp),
      updatedAt: new Date() 
    };
    this.militantAgents.set(id, updated);
    return updated;
  }

  // Militant Message Queue
  async getMilitantMessageQueue(agentId: string, groupId: string): Promise<MilitantMessageQueue | undefined> {
    return Array.from(this.militantMessageQueue.values())
      .find(q => q.agentId === agentId && q.groupId === groupId && (q.status === 'collecting' || q.status === 'ready' || q.status === 'processing'));
  }

  async createOrUpdateMilitantMessageQueue(data: InsertMilitantMessageQueue): Promise<MilitantMessageQueue> {
    const existing = await this.getMilitantMessageQueue(data.agentId!, data.groupId!);
    
    if (existing) {
      const now = new Date();
      const collectionEnd = new Date(existing.collectionEndTime);
      
      if ((existing.status === 'completed' || existing.status === 'failed') && now > collectionEnd) {
      } else {
        
        let existingMessages: any[] = [];
        try {
          const parsed = JSON.parse(existing.messages);
          existingMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          existingMessages = [existing.messages];
        }
        
        let newMessages: any[] = [];
        try {
          const parsed = JSON.parse(data.messages || "[]");
          newMessages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          newMessages = data.messages ? [data.messages] : [];
        }
        
        const allMessages = [...existingMessages, ...newMessages];
        
        const updated: MilitantMessageQueue = {
          ...existing,
          messages: JSON.stringify(allMessages),
        };
        
        this.militantMessageQueue.set(existing.id, updated);
        
        return updated;
      }
    }
    
    const id = randomUUID();
    const created: MilitantMessageQueue = {
      id,
      ...data,
      agentId: data.agentId!,
      groupId: data.groupId!,
      messages: data.messages || "[]",
      status: data.status || "collecting",
      collectionEndTime: data.collectionEndTime!,
      firstMessageAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      errorMessage: null,
      retryCount: data.retryCount || 0,
      lastAttemptAt: null,
      generatedResponse: null,
      createdAt: new Date(),
      groupName: data.groupName || null,
    };
    
    this.militantMessageQueue.set(id, created);
    
    return created;
  }

  async getMilitantQueuesReadyForProcessing(): Promise<MilitantMessageQueue[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const queues = Array.from(this.militantMessageQueue.values())
      .filter(q => 
        (q.status === 'collecting' || q.status === 'ready') &&
        q.collectionEndTime <= now &&
        (!q.lockedAt || q.lockedAt < fiveMinutesAgo)
      );
    
    return queues;
  }

  async getAllMilitantMessageQueues(): Promise<MilitantMessageQueue[]> {
    const queues = Array.from(this.militantMessageQueue.values())
      .filter(q => 
        q.status === 'collecting' || q.status === 'ready' || q.status === 'processing'
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return queues;
  }

  async updateMilitantMessageQueue(id: string, data: { generatedResponse?: string }): Promise<MilitantMessageQueue> {
    const existing = this.militantMessageQueue.get(id);
    
    if (!existing) {
      throw new Error('Militant message queue not found');
    }
    
    const updated: MilitantMessageQueue = {
      ...existing,
      ...data,
    };
    
    this.militantMessageQueue.set(id, updated);
    
    return updated;
  }

  async deleteMilitantMessageQueue(id: string): Promise<boolean> {
    const exists = this.militantMessageQueue.has(id);
    
    if (!exists) {
      return false;
    }
    
    this.militantMessageQueue.delete(id);
    
    return true;
  }

  async claimMilitantQueueForProcessing(queueId: string, lockId: string): Promise<boolean> {
    const queue = this.militantMessageQueue.get(queueId);
    
    if (!queue) {
      return false;
    }
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (queue.lockedAt && queue.lockedAt >= fiveMinutesAgo) {
      return false;
    }
    
    if (queue.status !== 'collecting' && queue.status !== 'ready') {
      return false;
    }
    
    const updated: MilitantMessageQueue = {
      ...queue,
      status: "processing",
      lockedAt: now,
      lockedBy: lockId,
    };
    
    this.militantMessageQueue.set(queueId, updated);
    
    return true;
  }

  async markMilitantQueueSucceeded(queueId: string, generatedResponse: string): Promise<MilitantMessageQueue> {
    const queue = this.militantMessageQueue.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const updated: MilitantMessageQueue = {
      ...queue,
      status: "completed",
      generatedResponse,
      processedAt: new Date(),
    };
    
    this.militantMessageQueue.set(queueId, updated);
    
    return updated;
  }

  async failMilitantQueue(queueId: string, errorMessage: string): Promise<MilitantMessageQueue> {
    const queue = this.militantMessageQueue.get(queueId);
    
    if (!queue) {
      throw new Error(`Fila ${queueId} não encontrada`);
    }
    
    const newRetryCount = (queue.retryCount || 0) + 1;
    const newStatus = newRetryCount >= 3 ? "failed" : "ready";
    
    const updated: MilitantMessageQueue = {
      ...queue,
      status: newStatus,
      errorMessage: errorMessage.substring(0, 1000),
      retryCount: newRetryCount,
      lastAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    };
    
    this.militantMessageQueue.set(queueId, updated);
    
    return updated;
  }

  // Messages Queue
  async getUnprocessedMessages(agentId?: string, limit?: number): Promise<MessagesQueue[]> {
    let messages = Array.from(this.messagesQueue.values())
      .filter(m => !m.isProcessed);
    
    if (agentId) {
      messages = messages.filter(m => m.agentId === agentId);
    }
    
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    if (limit) {
      messages = messages.slice(0, limit);
    }
    
    return messages;
  }

  async createMessage(message: InsertMessagesQueue): Promise<MessagesQueue> {
    const id = randomUUID();
    const created: MessagesQueue = {
      id,
      ...message,
      agentId: message.agentId || null,
      groupName: message.groupName || null,
      fromName: message.fromName || null,
      webhookPayload: message.webhookPayload || null,
      isProcessed: false,
      processedAt: null,
      createdAt: new Date(),
    };
    this.messagesQueue.set(id, created);
    return created;
  }

  async markMessageAsProcessed(id: string): Promise<MessagesQueue | undefined> {
    const message = this.messagesQueue.get(id);
    if (!message) return undefined;
    
    const updated: MessagesQueue = {
      ...message,
      isProcessed: true,
      processedAt: new Date(),
    };
    this.messagesQueue.set(id, updated);
    return updated;
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messagesQueue.delete(id);
  }

  async deleteProcessedMessages(): Promise<number> {
    const processed = Array.from(this.messagesQueue.values())
      .filter(m => m.isProcessed);
    
    let count = 0;
    for (const message of processed) {
      if (this.messagesQueue.delete(message.id)) {
        count++;
      }
    }
    return count;
  }

  async getMessageByMessageId(messageId: string): Promise<MessagesQueue | undefined> {
    return Array.from(this.messagesQueue.values())
      .find(m => m.messageId === messageId);
  }

  // Voter Memory
  async getVoterMemory(phoneNumber: string): Promise<VoterMemory | undefined> {
    return Array.from(this.voterMemories.values())
      .find(m => m.phoneNumber === phoneNumber);
  }

  async createVoterMemory(data: InsertVoterMemory): Promise<VoterMemory> {
    const id = randomUUID();
    const memory: VoterMemory = {
      id,
      phoneNumber: data.phoneNumber,
      fullName: data.fullName || null,
      profession: data.profession || null,
      problems: data.problems || '[]',
      needs: data.needs || '[]',
      topics: data.topics || '[]',
      personalInfo: data.personalInfo || '{}',
      politicalPreferences: data.politicalPreferences || null,
      importantDates: data.importantDates || '[]',
      contextSummary: data.contextSummary || null,
      lastInteraction: data.lastInteraction || new Date(),
      firstInteraction: data.firstInteraction || new Date(),
      totalInteractions: data.totalInteractions || 1,
      sentiment: data.sentiment || null,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.voterMemories.set(data.phoneNumber, memory);
    return memory;
  }

  async updateVoterMemory(phoneNumber: string, data: Partial<InsertVoterMemory>): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      return this.createVoterMemory({ ...data, phoneNumber } as InsertVoterMemory);
    }

    const updated: VoterMemory = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.voterMemories.set(phoneNumber, updated);
    return updated;
  }

  async appendToVoterMemory(
    phoneNumber: string, 
    field: 'problems' | 'needs' | 'topics' | 'importantDates', 
    items: string[]
  ): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      const data: InsertVoterMemory = {
        phoneNumber,
        [field]: JSON.stringify(items),
      };
      return this.createVoterMemory(data);
    }

    const currentItems = JSON.parse(existing[field] || '[]');
    const updatedItems = Array.from(new Set([...currentItems, ...items]));
    
    const updated: VoterMemory = {
      ...existing,
      [field]: JSON.stringify(updatedItems),
      updatedAt: new Date(),
    };
    this.voterMemories.set(phoneNumber, updated);
    return updated;
  }

  async updateVoterContext(phoneNumber: string, contextSummary: string, sentiment?: string): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      return this.createVoterMemory({
        phoneNumber,
        contextSummary,
        sentiment,
      });
    }

    const updated: VoterMemory = {
      ...existing,
      contextSummary,
      sentiment: sentiment || existing.sentiment,
      updatedAt: new Date(),
    };
    this.voterMemories.set(phoneNumber, updated);
    return updated;
  }

  async incrementVoterInteraction(phoneNumber: string): Promise<VoterMemory> {
    const existing = await this.getVoterMemory(phoneNumber);
    
    if (!existing) {
      return this.createVoterMemory({
        phoneNumber,
        totalInteractions: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date(),
      });
    }

    const updated: VoterMemory = {
      ...existing,
      totalInteractions: existing.totalInteractions + 1,
      lastInteraction: new Date(),
      updatedAt: new Date(),
    };
    this.voterMemories.set(phoneNumber, updated);
    return updated;
  }

  // Militant Group Memory
  async getMilitantGroupMemory(groupId: string): Promise<MilitantGroupMemory | undefined> {
    return Array.from(this.militantGroupMemories.values())
      .find(m => m.groupId === groupId);
  }

  async createMilitantGroupMemory(data: InsertMilitantGroupMemory): Promise<MilitantGroupMemory> {
    const id = randomUUID();
    const memory: MilitantGroupMemory = {
      id,
      groupId: data.groupId,
      groupName: data.groupName || null,
      topics: data.topics || '[]',
      keyMembers: data.keyMembers || '[]',
      politicalLeaning: data.politicalLeaning || null,
      commonQuestions: data.commonQuestions || '[]',
      groupSentiment: data.groupSentiment || null,
      contextSummary: data.contextSummary || null,
      lastInteraction: data.lastInteraction || new Date(),
      firstInteraction: data.firstInteraction || new Date(),
      totalInteractions: data.totalInteractions || 1,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.militantGroupMemories.set(data.groupId, memory);
    return memory;
  }

  async updateMilitantGroupMemory(groupId: string, data: Partial<InsertMilitantGroupMemory>): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      return this.createMilitantGroupMemory({ ...data, groupId } as InsertMilitantGroupMemory);
    }

    const updated: MilitantGroupMemory = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.militantGroupMemories.set(groupId, updated);
    return updated;
  }

  async appendToMilitantGroupMemory(
    groupId: string, 
    field: 'topics' | 'keyMembers' | 'commonQuestions', 
    items: string[]
  ): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      const data: InsertMilitantGroupMemory = {
        groupId,
        [field]: JSON.stringify(items),
      };
      return this.createMilitantGroupMemory(data);
    }

    const existingItems = JSON.parse(existing[field]);
    const updatedItems = [...new Set([...existingItems, ...items])];
    
    const updated: MilitantGroupMemory = {
      ...existing,
      [field]: JSON.stringify(updatedItems),
      updatedAt: new Date(),
    };
    this.militantGroupMemories.set(groupId, updated);
    return updated;
  }

  async incrementMilitantGroupInteraction(groupId: string): Promise<MilitantGroupMemory> {
    const existing = await this.getMilitantGroupMemory(groupId);
    
    if (!existing) {
      return this.createMilitantGroupMemory({
        groupId,
        totalInteractions: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date(),
      });
    }

    const updated: MilitantGroupMemory = {
      ...existing,
      totalInteractions: existing.totalInteractions + 1,
      lastInteraction: new Date(),
      updatedAt: new Date(),
    };
    this.militantGroupMemories.set(groupId, updated);
    return updated;
  }

  // Scheduled Messages
  async getCloneScheduledMessages(): Promise<any[]> {
    return Array.from(this.cloneAgentMessageQueue.values())
      .filter(msg => (msg.status === 'completed' || msg.status === 'sending') && !msg.sentAt)
      .map(msg => ({ ...msg, voterName: null }))
      .sort((a, b) => (a.scheduledSendTime?.getTime() || 0) - (b.scheduledSendTime?.getTime() || 0));
  }

  async getMilitantScheduledMessages(): Promise<MessagesQueue[]> {
    return Array.from(this.messagesQueue.values())
      .filter(msg => !msg.isProcessed)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async updateCloneScheduledMessage(id: string, data: { messages?: string; generatedResponse?: string; collectionEndTime?: Date; scheduledSendTime?: Date; typingDuration?: number }): Promise<CloneAgentMessageQueue> {
    const existing = this.cloneAgentMessageQueue.get(id);
    if (!existing) {
      throw new Error('Message not found');
    }
    const updated = { ...existing, ...data };
    this.cloneAgentMessageQueue.set(id, updated);
    return updated;
  }

  async updateMilitantScheduledMessage(id: string, data: { message?: string }): Promise<MessagesQueue> {
    const existing = this.messagesQueue.get(id);
    if (!existing) {
      throw new Error('Message not found');
    }
    const updated = { ...existing, ...data };
    this.messagesQueue.set(id, updated);
    return updated;
  }

  async deleteCloneScheduledMessage(id: string): Promise<boolean> {
    return this.cloneAgentMessageQueue.delete(id);
  }

  async deleteMilitantScheduledMessage(id: string): Promise<boolean> {
    return this.messagesQueue.delete(id);
  }

  async getNextAvailableGlobalSlot(): Promise<Date> {
    const { nowInSaoPaulo } = await import("./lib/timezone.js");
    const now = nowInSaoPaulo();
    
    const scheduledTimes = Array.from(this.cloneAgentMessageQueue.values())
      .filter(msg => msg.scheduledSendTime && !msg.sentAt)
      .map(msg => msg.scheduledSendTime as Date);
    
    const { toSaoPauloTime } = await import("./lib/timezone.js");
    const occupiedMinutes = new Set(
      scheduledTimes.map(time => {
        const dt = toSaoPauloTime(time);
        return dt.toFormat('yyyy-MM-dd HH:mm');
      })
    );
    
    let candidateTime = now.set({ hour: 9, minute: 1, second: 0, millisecond: 0 });
    
    if (candidateTime < now) {
      candidateTime = now.plus({ minutes: 1 }).set({ second: 0, millisecond: 0 });
    }
    
    while (occupiedMinutes.has(candidateTime.toFormat('yyyy-MM-dd HH:mm'))) {
      candidateTime = candidateTime.plus({ minutes: 1 });
    }
    
    return candidateTime.toJSDate();
  }

  async getScheduledMessagesForSending(): Promise<CloneAgentMessageQueue[]> {
    const now = new Date();
    return Array.from(this.cloneAgentMessageQueue.values())
      .filter(msg => 
        msg.scheduledSendTime && 
        msg.scheduledSendTime <= now && 
        !msg.sentAt &&
        (msg.status === 'completed' || msg.status === 'sending')
      )
      .sort((a, b) => (a.scheduledSendTime?.getTime() || 0) - (b.scheduledSendTime?.getTime() || 0));
  }

  async markMessageAsSent(id: string): Promise<void> {
    const message = this.cloneAgentMessageQueue.get(id);
    if (message) {
      const updated = { ...message, sentAt: new Date() };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async clearMessageSentAt(id: string): Promise<void> {
    const message = this.cloneAgentMessageQueue.get(id);
    if (message) {
      const updated = { ...message, sentAt: null };
      this.cloneAgentMessageQueue.set(id, updated);
    }
  }

  async getOrphanedMessages(futureThreshold: Date): Promise<CloneAgentMessageQueue[]> {
    return Array.from(this.cloneAgentMessageQueue.values())
      .filter(msg => 
        msg.scheduledSendTime &&
        msg.scheduledSendTime > futureThreshold &&
        !msg.sentAt &&
        (msg.status === 'completed' || msg.status === 'sending')
      );
  }

  // Métodos para deduplicação com hash (MemStorage)
  async checkMessageHash(hash: string): Promise<boolean> {
    return Array.from(this.cloneAgentMessageQueue.values())
      .some(msg => msg.messageHash === hash);
  }

  async saveMessageHash(messageQueueId: string, hash: string): Promise<void> {
    const message = this.cloneAgentMessageQueue.get(messageQueueId);
    if (message) {
      const updated = { ...message, messageHash: hash };
      this.cloneAgentMessageQueue.set(messageQueueId, updated);
    }
  }

  async removeMessageHash(messageQueueId: string): Promise<void> {
    const message = this.cloneAgentMessageQueue.get(messageQueueId);
    if (message) {
      const updated = { ...message, messageHash: null };
      this.cloneAgentMessageQueue.set(messageQueueId, updated);
    }
  }
}

// Use DatabaseStorage for persistent data
export const storage = new DatabaseStorage();
