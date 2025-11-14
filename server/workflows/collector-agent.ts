import { storage } from "../storage";
import { wahaGetContact, wahaGetGroup, wahaGetGroupParticipants, phoneToChatId, type WahaConfig } from "../lib/waha-client";

// Cache for contact lookups during a single workflow run
const contactCache = new Map<string, any>();

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

// Helper function to get name field from any object (handles different case formats)
function getNameField(obj: any, fieldName: string): string | undefined {
  // Try different case formats: camelCase, PascalCase, snake_case, lowercase
  const camelCase = fieldName;
  const pascalCase = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  const snakeCase = fieldName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  const lowerCase = fieldName.toLowerCase();
  
  return obj[camelCase] || obj[pascalCase] || obj[snakeCase] || obj[lowerCase] || undefined;
}

// Helper function to fetch contact data with caching
async function fetchContactData(
  phone: string, 
  wahaConfig: WahaConfig,
  log: (msg: string) => void
): Promise<string> {
  // Check cache first
  if (contactCache.has(phone)) {
    log(`📦 Cache hit para contato ${phone}`);
    return contactCache.get(phone);
  }

  try {
    // Convert phone to chatId format for WAHA
    const chatId = phoneToChatId(phone);
    
    const contactData = await wahaGetContact(wahaConfig, chatId);
    
    // Log complete response for debugging
    log(`📋 WAHA /contacts response for ${phone}: ${JSON.stringify(contactData)}`);
    
    // Priority from WAHA contact endpoint using normalized field access:
    // name: Contact name
    // pushName: Name in WhatsApp profile (MOST RELIABLE!)
    // notify: Name in notifications
    const nameField = getNameField(contactData, 'name');
    const pushNameField = getNameField(contactData, 'pushName');
    const notifyField = getNameField(contactData, 'notify');
    
    const nome = nameField || pushNameField || notifyField || '';
    
    // Log which field was used
    const source = nameField ? 'name' : 
                  pushNameField ? 'pushName' : 
                  notifyField ? 'notify' : 'none';
    
    // Cache the result
    contactCache.set(phone, nome);
    
    if (nome) {
      log(`✅ Nome encontrado via WAHA /contacts (campo '${source}'): ${nome}`);
    } else {
      log(`⚠️ Nenhum nome retornado pelo endpoint WAHA /contacts para ${phone}`);
      log(`🔍 Campos disponíveis no contactData: ${Object.keys(contactData).join(', ')}`);
    }
    return nome;
  } catch (error) {
    log(`⚠️ Falha ao buscar contato ${phone} via WAHA: ${error instanceof Error ? error.message : 'Unknown error'}`);
    contactCache.set(phone, ''); // Cache empty result to avoid retrying
    return '';
  }
}

export async function runCollectorAgentWorkflow(agentId: string): Promise<void> {
  const log = (message: string) => {
    console.log(`[Collector Agent ${agentId}] ${message}`);
  };

  // Clear cache at the start of each workflow run
  contactCache.clear();

  try {
    const agent = await storage.getCollectorAgent(agentId);
    if (!agent || !agent.isActive) {
      log('Agent not found or not active, skipping');
      return;
    }

    log('🔄 Starting monitoring cycle');

    // Fetch the Coletor Agent instance from database
    const instance = await storage.getColetorAgentInstance();
    if (!instance) {
      await storage.appendCollectorExecutionLog(agentId, "❌ Nenhuma instância do Agente Coletor configurada");
      log('❌ Nenhuma instância do Agente Coletor configurada');
      return;
    }

    if (!instance.isActive) {
      await storage.appendCollectorExecutionLog(agentId, "⚠️ Instância do Agente Coletor está inativa");
      log('⚠️ Instância do Agente Coletor está inativa');
      return;
    }

    log(`✅ Usando instância: ${instance.instanceName}`);

    // Create WAHA config from instance credentials
    const wahaConfig: WahaConfig = {
      url: instance.wahaUrl,
      apiKey: instance.wahaApiKey,
      session: instance.wahaSession
    };

    // Fetch group data using WAHA API with force refresh to bypass cache
    // This ensures we get the latest participant list from WhatsApp
    let participants: any[] = [];
    try {
      log(`🔄 Fetching group data with force refresh to ensure latest member list...`);
      const groupData = await wahaGetGroup(wahaConfig, agent.groupId, { force: true });
      log(`✅ Retrieved group data from WAHA: ${groupData.Name || 'Unnamed Group'}`);
      log(`📊 ParticipantVersionID: ${groupData.ParticipantVersionID || 'N/A'}`);
      
      // Extract participants from the group data
      participants = groupData.Participants || [];
      log(`✅ Found ${participants.length} participants in group (after force refresh)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await storage.appendCollectorExecutionLog(agentId, `❌ Failed to fetch group data from WAHA: ${errorMsg}`);
      log(`❌ Failed to fetch group data from WAHA: ${errorMsg}`);
      return;
    }
    const currentMemberCount = participants.length;
    
    // Log all participants for debugging
    log(`📝 All participants returned by WAHA:`);
    participants.forEach((p, index) => {
      const phone = p.PhoneNumber ? p.PhoneNumber.replace(/@s\.whatsapp\.net$/, '') : 'No phone';
      log(`   ${index + 1}. Phone: ${phone}, JID: ${p.JID || 'N/A'}, Admin: ${p.IsAdmin ? 'Yes' : 'No'}`);
      // Log full participant object to debug name fields
      log(`   🔍 Full participant data: ${JSON.stringify(p)}`);
    });
    
    // Get current member IDs - WAHA returns different fields depending on the endpoint
    // For /participants endpoint: PhoneNumber, JID, LID
    // For legacy endpoints: id
    const currentMemberIds = participants.map((p: any) => {
      // Try PhoneNumber first (format: "5511999999999@s.whatsapp.net")
      if (p.PhoneNumber) {
        return p.PhoneNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
      }
      // Fallback to id field for legacy format
      const id = p.id || '';
      return id.replace(/@c\.us$/, '').replace(/@g\.us$/, '');
    }).filter(Boolean);
    
    // Debug logging
    log(`🔍 Current member IDs: ${JSON.stringify(currentMemberIds)}`);
    log(`🔍 Previous member IDs raw: ${agent.lastProcessedMemberIds}`);
    
    // Get previously processed member IDs
    const previousMemberIds = agent.lastProcessedMemberIds 
      ? JSON.parse(agent.lastProcessedMemberIds) 
      : [];
    
    log(`🔍 Previous member IDs parsed: ${JSON.stringify(previousMemberIds)}`);
    
    // Check if this is the first run (no previous members)
    const isFirstRun = previousMemberIds.length === 0;
    
    if (isFirstRun) {
      log(`🎯 Primeira execução detectada - todos os ${currentMemberIds.length} membros serão processados`);
    }
    
    // Find new members by comparing IDs (members that exist now but weren't in previous run)
    // On first run, all current members are considered "new"
    const newMemberIds = isFirstRun 
      ? currentMemberIds 
      : currentMemberIds.filter((id: string) => !previousMemberIds.includes(id));
    
    log(`🔍 New member IDs detected: ${JSON.stringify(newMemberIds)}`);

    if (newMemberIds.length === 0) {
      await storage.appendCollectorExecutionLog(agentId, `✅ Verificado: ${currentMemberCount} membros (nenhum novo)`);
      log(`📝 Updating with currentMemberIds: ${JSON.stringify(currentMemberIds)}`);
      await storage.updateCollectorLastRun(agentId, currentMemberCount, currentMemberIds, new Date());
      log(`✅ No new members found. Total: ${currentMemberCount}`);
      return;
    }

    log(`📊 Found ${newMemberIds.length} new members out of ${currentMemberCount} total`);

    // Process only new members
    let savedCount = 0;
    const newMembers = participants.filter((p: any) => {
      // Extract phone using the same logic as currentMemberIds
      let phone = '';
      if (p.PhoneNumber) {
        phone = p.PhoneNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
      } else {
        phone = (p.id || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '');
      }
      return newMemberIds.includes(phone);
    });

    // First, identify members that need contact lookup (in parallel)
    const membersNeedingLookup: Array<{participant: any, phone: string}> = [];
    
    for (const participant of newMembers) {
      // Extract phone using the same logic as currentMemberIds
      let phone = '';
      if (participant.PhoneNumber) {
        phone = participant.PhoneNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
      } else {
        phone = (participant.id || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '');
      }
      
      // WAHA participants have name fields - try different case formats
      // pushName/PushName: Name from WhatsApp profile (MOST RELIABLE!)
      // name/Name: Contact name  
      // notify/Notify: Notification name
      const pushName = getNameField(participant, 'pushName');
      const name = getNameField(participant, 'name');
      const notify = getNameField(participant, 'notify');
      const hasNameInMetadata = pushName || name || notify;
      
      // Log what fields we found for debugging
      log(`🔍 Participant ${phone}: pushName="${pushName || ''}", name="${name || ''}", notify="${notify || ''}", hasName=${!!hasNameInMetadata}`);
      
      if (!hasNameInMetadata && phone && phone.length >= 10) {
        membersNeedingLookup.push({ participant, phone });
      }
    }

    // Fetch missing contact data in parallel with concurrency limit
    if (membersNeedingLookup.length > 0) {
      log(`🔍 Buscando dados de ${membersNeedingLookup.length} contatos sem nome via WAHA...`);
      
      const CONCURRENCY_LIMIT = 5; // Process 5 contacts at a time
      for (let i = 0; i < membersNeedingLookup.length; i += CONCURRENCY_LIMIT) {
        const batch = membersNeedingLookup.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(
          batch.map(({ phone }) => 
            fetchContactData(phone, wahaConfig, log)
          )
        );
      }
    }

    // Now process all members with names resolved
    for (const participant of newMembers) {
      // Extract phone using the same logic as currentMemberIds
      let phone = '';
      if (participant.PhoneNumber) {
        phone = participant.PhoneNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
      } else {
        phone = (participant.id || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '');
      }
      
      // Try to get the name from WAHA participant fields using helper function
      // Priority: pushName (user's profile name) > name (contact name) > notify (notification name)
      const pushNameField = getNameField(participant, 'pushName');
      const nameField = getNameField(participant, 'name');
      const notifyField = getNameField(participant, 'notify');
      
      let nome = pushNameField ||  // User's WhatsApp profile name - MOST RELIABLE!
                 nameField ||      // Contact name
                 notifyField ||    // Notification name
                 '';
      
      // Determine the source of the name for logging and database
      let dbNameSource = pushNameField ? 'group-metadata-pushName' :
                         nameField ? 'group-metadata-name' :
                         notifyField ? 'group-metadata-notify' : '';
      
      // If no name in metadata, check cache from contact lookup
      if (!nome && phone) {
        nome = contactCache.get(phone) || '';
        if (nome) {
          dbNameSource = 'contacts-api';
          log(`✅ Nome via WAHA /contacts: ${nome} (${phone})`);
        }
      }
      
      // If still no name found, create a placeholder
      if (!nome) {
        nome = `Novo Membro ${phone.slice(-4)}`;
        dbNameSource = 'placeholder';
        log(`⚠️ ⚠️ ⚠️ Nenhum nome encontrado! Usando placeholder para ${phone}: ${nome}`);
      } else {
        log(`✅ Nome capturado (fonte: ${dbNameSource}): "${nome}" (${phone})`);
      }
      
      if (!phone || phone.length < 10) continue;

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
            nameSource: dbNameSource,
          });
          savedCount++;
          log(`✅ Eleitor registrado: ${nome} (fonte do nome: ${dbNameSource})`);
        } else {
          // Update voter name if the new one is better/more complete
          if (isNameBetter(existingVoter.nome, nome)) {
            await storage.updateVoter(existingVoter.id, { 
              nome,
              nameSource: dbNameSource
            });
            log(`✅ Nome do eleitor atualizado: "${existingVoter.nome}" → "${nome}" (fonte: ${dbNameSource}, ${phone})`);
          }
        }
      } catch (error) {
        log(`❌ Error saving voter ${nome}: ${error}`);
      }
    }

    await storage.appendCollectorExecutionLog(
      agentId, 
      `✅ ${savedCount} novos eleitores cadastrados de ${newMemberIds.length} novos membros`
    );
    await storage.updateCollectorLastRun(agentId, currentMemberCount, currentMemberIds, new Date());
    log(`✅ Successfully registered ${savedCount} new voters`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await storage.appendCollectorExecutionLog(agentId, `❌ Erro: ${errorMsg}`);
    log(`❌ Workflow error: ${errorMsg}`);
  }
}

export async function runAllActiveCollectorAgents(): Promise<void> {
  try {
    const agents = await storage.getCollectorAgents();
    const activeAgents = agents.filter(agent => agent.isActive);

    console.log(`[Collector Scheduler] Found ${activeAgents.length} active agents`);

    for (const agent of activeAgents) {
      await runCollectorAgentWorkflow(agent.id);
    }

    console.log('[Collector Scheduler] Completed monitoring cycle');
  } catch (error) {
    console.error('[Collector Scheduler] Error running agents:', error);
  }
}
