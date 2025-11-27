import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const voters = pgTable("voters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  whatsapp: text("whatsapp").notNull().unique(),
  voto: text("voto").notNull(), // "confirmado" or "em_progresso"
  votoConfirmado: boolean("voto_confirmado").notNull().default(false), // Detecção inteligente de confirmação de voto
  material: text("material").notNull(), // "entregue", "enviado", or "sem_material"
  municipio: text("municipio").notNull(),
  bairro: text("bairro").default(""),
  indicacao: text("indicacao").notNull(),
  nameSource: text("name_source"), // "group-metadata", "contacts", "webhook-pushName", "manual", "placeholder"
  dataCadastro: timestamp("data_cadastro").defaultNow().notNull(),
});

export const campaignMaterials = pgTable("campaign_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tipoMaterial: text("tipo_material").notNull(),
  entrega: text("entrega").notNull(), // "online" or "presencial"
  destinatario: text("destinatario").notNull(), // "municipio", "vereador", "lideranca", "deputado", "prefeito", "eleitor"
  quantidade: integer("quantidade").notNull().default(0),
  status: text("status").notNull().default("em_preparacao"), // "em_preparacao", "distribuido"
});

export const configOptions = pgTable("config_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldType: text("field_type").notNull(), // "municipio", "bairro", "destinatario", "tipo_entrega"
  value: text("value").notNull(),
  parentMunicipio: text("parent_municipio"), // Para bairros, o município ao qual pertencem
});

export const leaderships = pgTable("leaderships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  whatsapp: text("whatsapp").default(""),
  investimento: text("investimento").default(""),
  materialEnviado: text("material_enviado").default(""), // JSON string with material and quantity
  municipio: text("municipio").default(""),
  bairro: text("bairro").default(""),
  anotacoes: text("anotacoes").default(""),
  dataCadastro: timestamp("data_cadastro").defaultNow().notNull(),
});

export const assessores = pgTable("assessores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  whatsapp: text("whatsapp").default(""),
  investimento: text("investimento").default(""),
  materialEnviado: text("material_enviado").default(""), // JSON string with material and quantity
  municipio: text("municipio").default(""),
  bairro: text("bairro").default(""),
  anotacoes: text("anotacoes").default(""),
  dataCadastro: timestamp("data_cadastro").defaultNow().notNull(),
});

export const instagramAgents = pgTable("instagram_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instagramUrl: text("instagram_url").notNull(),
  whatsappRecipient: text("whatsapp_recipient").notNull(),
  groupName: text("group_name").notNull().default(""),
  personName: text("person_name").notNull().default(""),
  personInstagram: text("person_instagram").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  lastPostId: text("last_post_id"),
  lastRunAt: timestamp("last_run_at"),
  executionLogs: text("execution_logs").default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectorAgents = pgTable("collector_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: text("group_id").notNull(),
  groupName: text("group_name").notNull(),
  indicacao: text("indicacao").notNull(),
  municipio: text("municipio").notNull(),
  bairro: text("bairro").default(""),
  isActive: boolean("is_active").notNull().default(false),
  lastMemberCount: integer("last_member_count").default(0),
  lastProcessedMemberIds: text("last_processed_member_ids").default("[]"),
  lastRunAt: timestamp("last_run_at"),
  executionLogs: text("execution_logs").default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Replicador Agent - Single WAHA Instance (limited to one)
export const replicadorAgentInstances = pgTable("replicador_agent_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceName: text("instance_name").notNull(),
  wahaUrl: varchar("waha_url").notNull(),
  wahaApiKey: varchar("waha_api_key").notNull(),
  wahaSession: varchar("waha_session").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Coletor Agent - Single WAHA Instance (limited to one)
export const coletorAgentInstances = pgTable("coletor_agent_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceName: text("instance_name").notNull(),
  wahaUrl: varchar("waha_url").notNull(),
  wahaApiKey: varchar("waha_api_key").notNull(),
  wahaSession: varchar("waha_session").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clone Agent - Global Configuration (Singleton)
export const cloneAgentConfig = pgTable("clone_agent_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  promptSystem: text("prompt_system").notNull(),
  messageCollectionTime: integer("message_collection_time").notNull().default(30), // Tempo em segundos para coletar mensagens
  sendDelaySeconds: integer("send_delay_seconds").notNull().default(5), // Delay base antes de enviar mensagens (1-60 segundos)
  ollamaModel: text("ollama_model").notNull().default("deepseek-v3.1:671b-cloud"), // Modelo Ollama Cloud para IA
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clone Agent - Multiple WAHA Instances
export const cloneAgentInstances = pgTable("clone_agent_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").notNull(), // References cloneAgentConfig
  instanceName: text("instance_name").notNull(), // Nome identificador da instância (ex: "WhatsApp Principal")
  wahaUrl: varchar("waha_url").notNull(), // URL base da WAHA API
  wahaApiKey: varchar("waha_api_key").notNull(), // API Key para autenticação
  wahaSession: varchar("waha_session").notNull(), // Nome da sessão WAHA
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clone Agent - Knowledge Base (linked to config, shared by all instances)
export const cloneAgentKnowledge = pgTable("clone_agent_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").notNull(), // References cloneAgentConfig
  content: text("content").notNull(),
  embedding: text("embedding"), // Store vector embedding as JSON text (workaround for Drizzle pgvector support)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clone Agent - Conversations (per instance + phone number)
export const cloneAgentConversations = pgTable("clone_agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(), // References cloneAgentInstances
  phoneNumber: text("phone_number").notNull(),
  messages: text("messages").notNull().default("[]"), // JSON array de {role: "user"|"assistant", content: string}
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clone Agent - Message Queue (per instance + phone number)
export const cloneAgentMessageQueue = pgTable("clone_agent_message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(), // References cloneAgentInstances
  phoneNumber: text("phone_number").notNull(),
  messages: text("messages").notNull().default("[]"), // JSON array de mensagens coletadas
  
  // Status: 'collecting' (coletando mensagens) -> 'ready' (pronto para processar) -> 'processing' (processando) -> 'sending' (enviando) -> 'completed' (concluído)
  status: text("status").notNull().default("collecting"), // collecting | ready | processing | sending | completed | failed
  
  generatedResponse: text("generated_response"), // Resposta gerada pelo agente pronta para envio
  messageHash: varchar("message_hash", { length: 64 }), // Hash único para prevenir duplicação de envio
  firstMessageAt: timestamp("first_message_at").defaultNow().notNull(),
  collectionEndTime: timestamp("collection_end_time").notNull(), // Fim da janela de coleta de mensagens (firstMessageAt + collectionTime)
  scheduledSendTime: timestamp("scheduled_send_time"), // Horário específico para envio da resposta
  typingDuration: integer("typing_duration"), // Duração em segundos para mostrar "digitando..." (2-8 segundos)
  sentAt: timestamp("sent_at"), // Quando a mensagem foi realmente enviada
  
  // Campos para locking otimista
  lockedAt: timestamp("locked_at"), // Quando foi travada para processamento
  lockedBy: text("locked_by"), // ID do worker que travou (hostname ou UUID)
  
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"), // Mensagem de erro da última falha
  retryCount: integer("retry_count").notNull().default(0), // Número de tentativas de reprocessamento
  lastAttemptAt: timestamp("last_attempt_at"), // Última tentativa de processamento
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wahaWebhookConfigs = pgTable("waha_webhook_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookUrl: text("webhook_url").notNull(), // URL where webhooks will be received
  sharedSecret: text("shared_secret").notNull(), // Secret for validating webhook authenticity
  enabledEvents: text("enabled_events").notNull().default('["message"]'), // JSON array of event types
  isActive: boolean("is_active").notNull().default(false),
  lastReceivedAt: timestamp("last_received_at"),
  totalMessagesProcessed: integer("total_messages_processed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const militantAgents = pgTable("militant_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  groups: text("groups").notNull().default("[]"), // JSON array com {id, name, active}
  lastRunAt: timestamp("last_run_at"),
  lastMessageTimestamp: text("last_message_timestamp").default("{}"), // JSON object com {groupId: timestamp}
  executionLogs: text("execution_logs").notNull().default("[]"), // JSON array de logs
  wahaUrl: varchar("waha_url").notNull(), // URL base da WAHA API
  wahaApiKey: varchar("waha_api_key").notNull(), // API Key para autenticação
  wahaSession: varchar("waha_session").notNull(), // Nome da sessão WAHA
  flowMinutes: integer("flow_minutes").notNull().default(10), // Tempo em minutos entre respostas no mesmo grupo
  messageCollectionTime: integer("message_collection_time").notNull().default(30), // Tempo em segundos para coletar mensagens antes de responder
  ollamaModel: text("ollama_model").notNull().default("deepseek-v3.1:671b-cloud"), // Modelo Ollama Cloud para IA
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Militant Agent - Message Queue (per agent + group)
export const militantMessageQueue = pgTable("militant_message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(), // References militantAgents
  groupId: text("group_id").notNull(), // ID do grupo WhatsApp
  groupName: text("group_name"), // Nome do grupo
  messages: text("messages").notNull().default("[]"), // JSON array de mensagens coletadas
  
  // Status: 'collecting' (coletando mensagens) -> 'ready' (pronto para processar) -> 'processing' (processando) -> 'completed' (concluído)
  status: text("status").notNull().default("collecting"), // collecting | ready | processing | completed | failed
  
  generatedResponse: text("generated_response"), // Resposta gerada pelo agente pronta para envio
  firstMessageAt: timestamp("first_message_at").defaultNow().notNull(),
  collectionEndTime: timestamp("collection_end_time").notNull(), // Fim da janela de coleta de mensagens (firstMessageAt + collectionTime)
  
  // Campos para locking otimista
  lockedAt: timestamp("locked_at"), // Quando foi travada para processamento
  lockedBy: text("locked_by"), // ID do worker que travou (hostname ou UUID)
  
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"), // Mensagem de erro da última falha
  retryCount: integer("retry_count").notNull().default(0), // Número de tentativas de reprocessamento
  lastAttemptAt: timestamp("last_attempt_at"), // Última tentativa de processamento
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Message Queue for webhook-based messages from WhatsApp (DEPRECATED - mantido para compatibilidade)
export const messagesQueue = pgTable("messages_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id"), // ID do agente militante que deve processar a mensagem
  groupId: text("group_id").notNull(), // ID do grupo WhatsApp
  groupName: text("group_name"), // Nome do grupo
  fromPhone: text("from_phone").notNull(), // Número de telefone do remetente
  fromName: text("from_name"), // Nome do remetente
  message: text("message").notNull(), // Conteúdo da mensagem
  messageId: text("message_id").notNull(), // ID único da mensagem no WhatsApp
  timestamp: integer("timestamp").notNull(), // Timestamp da mensagem
  isProcessed: boolean("is_processed").notNull().default(false), // Se já foi processada
  processedAt: timestamp("processed_at"), // Quando foi processada
  webhookPayload: text("webhook_payload"), // JSON com o payload completo do webhook (para debug)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clone Agent - Voter Memory (Memória persistente de contexto do eleitor)
export const voterMemory = pgTable("voter_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(), // Número de telefone do eleitor (único)
  fullName: text("full_name"), // Nome completo extraído das conversas
  profession: text("profession"), // Profissão mencionada
  problems: text("problems").notNull().default("[]"), // JSON array de problemas mencionados
  needs: text("needs").notNull().default("[]"), // JSON array de necessidades identificadas
  topics: text("topics").notNull().default("[]"), // JSON array de assuntos discutidos
  personalInfo: text("personal_info").notNull().default("{}"), // JSON com informações pessoais (família, endereço, etc)
  politicalPreferences: text("political_preferences"), // Preferências políticas identificadas
  importantDates: text("important_dates").notNull().default("[]"), // JSON array de datas importantes mencionadas
  contextSummary: text("context_summary"), // Resumo do contexto geral do eleitor
  lastInteraction: timestamp("last_interaction"), // Última vez que interagiu
  firstInteraction: timestamp("first_interaction"), // Primeira vez que interagiu
  totalInteractions: integer("total_interactions").notNull().default(0), // Contador de interações
  sentiment: text("sentiment"), // Sentimento geral (positivo, neutro, negativo)
  notes: text("notes"), // Notas adicionais do sistema
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Militant Agent - Group Memory (Memória persistente de contexto do grupo)
export const militantGroupMemory = pgTable("militant_group_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: text("group_id").notNull().unique(), // ID do grupo WhatsApp (único)
  groupName: text("group_name"), // Nome do grupo
  topics: text("topics").notNull().default("[]"), // JSON array de assuntos discutidos no grupo
  keyMembers: text("key_members").notNull().default("[]"), // JSON array de membros mais ativos {name, phone, interactionCount}
  politicalLeaning: text("political_leaning"), // Inclinação política do grupo (favorável, neutro, contrário)
  commonQuestions: text("common_questions").notNull().default("[]"), // JSON array de perguntas frequentes do grupo
  groupSentiment: text("group_sentiment"), // Sentimento geral do grupo (positivo, neutro, negativo)
  contextSummary: text("context_summary"), // Resumo do contexto geral do grupo
  lastInteraction: timestamp("last_interaction"), // Última vez que o agente interagiu
  firstInteraction: timestamp("first_interaction"), // Primeira vez que o agente interagiu
  totalInteractions: integer("total_interactions").notNull().default(0), // Contador de interações do agente
  notes: text("notes"), // Notas adicionais do sistema
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVoterSchema = createInsertSchema(voters).omit({
  id: true,
});

export const insertCampaignMaterialSchema = createInsertSchema(campaignMaterials).omit({
  id: true,
});

export const insertConfigOptionSchema = createInsertSchema(configOptions).omit({
  id: true,
});

export const insertLeadershipSchema = createInsertSchema(leaderships).omit({
  id: true,
});

export const insertAssessorSchema = createInsertSchema(assessores).omit({
  id: true,
});

export const insertInstagramAgentSchema = createInsertSchema(instagramAgents).omit({
  id: true,
});

export const insertCollectorAgentSchema = createInsertSchema(collectorAgents).omit({
  id: true,
});

export const insertReplicadorAgentInstanceSchema = createInsertSchema(replicadorAgentInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertColetorAgentInstanceSchema = createInsertSchema(coletorAgentInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCloneAgentConfigSchema = createInsertSchema(cloneAgentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCloneAgentInstanceSchema = createInsertSchema(cloneAgentInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCloneAgentKnowledgeSchema = createInsertSchema(cloneAgentKnowledge).omit({
  id: true,
  createdAt: true,
});

export const insertCloneAgentConversationSchema = createInsertSchema(cloneAgentConversations).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

export const insertCloneAgentMessageQueueSchema = createInsertSchema(cloneAgentMessageQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  firstMessageAt: true,
  sentAt: true,
  lockedAt: true,
  lastAttemptAt: true,
});

export const insertWahaWebhookConfigSchema = createInsertSchema(wahaWebhookConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastReceivedAt: true,
  totalMessagesProcessed: true,
});

export const insertMilitantAgentSchema = createInsertSchema(militantAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export const insertMilitantMessageQueueSchema = createInsertSchema(militantMessageQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  firstMessageAt: true,
  lockedAt: true,
  lastAttemptAt: true,
});

export const insertMessagesQueueSchema = createInsertSchema(messagesQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertVoterMemorySchema = createInsertSchema(voterMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilitantGroupMemorySchema = createInsertSchema(militantGroupMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// WAHA Instances - Instances created through the Instâncias page
export const wahaInstances = pgTable("waha_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionName: text("session_name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWahaInstanceSchema = createInsertSchema(wahaInstances).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof voters.$inferSelect;
export type InsertCampaignMaterial = z.infer<typeof insertCampaignMaterialSchema>;
export type CampaignMaterial = typeof campaignMaterials.$inferSelect;
export type InsertConfigOption = z.infer<typeof insertConfigOptionSchema>;
export type ConfigOption = typeof configOptions.$inferSelect;
export type InsertLeadership = z.infer<typeof insertLeadershipSchema>;
export type Leadership = typeof leaderships.$inferSelect;
export type InsertAssessor = z.infer<typeof insertAssessorSchema>;
export type Assessor = typeof assessores.$inferSelect;
export type InsertInstagramAgent = z.infer<typeof insertInstagramAgentSchema>;
export type InstagramAgent = typeof instagramAgents.$inferSelect;
export type InsertCollectorAgent = z.infer<typeof insertCollectorAgentSchema>;
export type CollectorAgent = typeof collectorAgents.$inferSelect;
export type InsertReplicadorAgentInstance = z.infer<typeof insertReplicadorAgentInstanceSchema>;
export type ReplicadorAgentInstance = typeof replicadorAgentInstances.$inferSelect;
export type InsertColetorAgentInstance = z.infer<typeof insertColetorAgentInstanceSchema>;
export type ColetorAgentInstance = typeof coletorAgentInstances.$inferSelect;
export type InsertCloneAgentConfig = z.infer<typeof insertCloneAgentConfigSchema>;
export type CloneAgentConfig = typeof cloneAgentConfig.$inferSelect;
export type InsertCloneAgentInstance = z.infer<typeof insertCloneAgentInstanceSchema>;
export type CloneAgentInstance = typeof cloneAgentInstances.$inferSelect;
export type InsertCloneAgentKnowledge = z.infer<typeof insertCloneAgentKnowledgeSchema>;
export type CloneAgentKnowledge = typeof cloneAgentKnowledge.$inferSelect;
export type InsertCloneAgentConversation = z.infer<typeof insertCloneAgentConversationSchema>;
export type CloneAgentConversation = typeof cloneAgentConversations.$inferSelect;
export type InsertCloneAgentMessageQueue = z.infer<typeof insertCloneAgentMessageQueueSchema>;
export type CloneAgentMessageQueue = typeof cloneAgentMessageQueue.$inferSelect;
export type InsertWahaWebhookConfig = z.infer<typeof insertWahaWebhookConfigSchema>;
export type WahaWebhookConfig = typeof wahaWebhookConfigs.$inferSelect;
export type InsertMilitantAgent = z.infer<typeof insertMilitantAgentSchema>;
export type MilitantAgent = typeof militantAgents.$inferSelect;
export type InsertMilitantMessageQueue = z.infer<typeof insertMilitantMessageQueueSchema>;
export type MilitantMessageQueue = typeof militantMessageQueue.$inferSelect;
export type InsertMessagesQueue = z.infer<typeof insertMessagesQueueSchema>;
export type MessagesQueue = typeof messagesQueue.$inferSelect;
export type InsertVoterMemory = z.infer<typeof insertVoterMemorySchema>;
export type VoterMemory = typeof voterMemory.$inferSelect;
export type InsertMilitantGroupMemory = z.infer<typeof insertMilitantGroupMemorySchema>;
export type MilitantGroupMemory = typeof militantGroupMemory.$inferSelect;
export type InsertWahaInstance = z.infer<typeof insertWahaInstanceSchema>;
export type WahaInstance = typeof wahaInstances.$inferSelect;
