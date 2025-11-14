import { wahaSendImage, wahaSendVideo, phoneToChatId, type WahaConfig } from '../lib/waha-client';
import { sleep } from '../lib/message-chunker';

interface ScrapeResult {
  postId: string;
  caption: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  timestamp: number;
}

interface WorkflowResult {
  success: boolean;
  postId?: string;
  postsProcessed?: number;
  error?: string;
}

async function scrapeInstagramPosts(instagramUrl: string): Promise<ScrapeResult[]> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addParentData: false,
        directUrls: [instagramUrl],
        enhanceUserSearchWithFacebookPage: false,
        isUserReelFeedURL: false,
        isUserTaggedFeedURL: false,
        resultsLimit: 20,
        resultsType: 'posts',
        searchLimit: 20,
        searchType: 'hashtag',
        skipPinnedPosts: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error('No Instagram post data returned from Apify');
  }

  const nonPinnedPosts = data.filter((post: any) => !post.isPinned);
  
  if (nonPinnedPosts.length === 0) {
    console.log('Aviso: Todos os posts retornados estão fixados. Usando todos os posts disponíveis.');
  }
  
  const postsToProcess = nonPinnedPosts.length > 0 ? nonPinnedPosts : data;
  
  const results: ScrapeResult[] = postsToProcess.map((post: any) => {
    const isVideo = post.type === 'Video' || post.isVideo || post.videoUrl;
    const mediaUrl = isVideo 
      ? (post.videoUrl || post.displayUrl || post.url || '')
      : (post.displayUrl || post.url || '');
    
    const timestamp = post.timestamp ? new Date(post.timestamp).getTime() : 
                     post.takenAt ? new Date(post.takenAt).getTime() :
                     Date.now();
    
    return {
      postId: post.id || post.shortCode || '',
      caption: post.caption || '',
      mediaUrl: mediaUrl,
      mediaType: isVideo ? 'video' : 'image',
      timestamp: timestamp,
    };
  });
  
  results.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`Encontrados ${results.length} posts, ordenados do mais antigo para o mais novo`);
  
  return results;
}

async function transformCaption(caption: string, personName: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um agente dedicado exclusivamente a transformar a legenda de um post do Instagram em um texto curto de até 500 caracteres para envio em grupos do WhatsApp. Trabalhe apenas com a legenda recebida. Ignore imagens e vídeos. Use somente texto simples, sem formatação markdown. Não use hashtags, menções, emojis, listas ou qualquer artifício visual. Não inclua URLs. Retorne apenas o texto final em um único parágrafo, sempre em terceira pessoa. Ao se referir à pessoa do post, use o nome "${personName}" em vez de expressões genéricas como "A pessoa" ou "Ele/Ela".`,
        },
        {
          role: 'user',
          content: caption,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    throw new Error('No response from OpenAI API');
  }

  const transformedText = data.choices[0].message.content.trim();
  
  return transformedText.substring(0, 500);
}

async function sendImageToWhatsApp(whatsappRecipient: string, text: string, imageUrl: string, wahaUrl: string, wahaApiKey: string, wahaSession: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const wahaConfig: WahaConfig = {
    url: wahaUrl,
    apiKey: wahaApiKey,
    session: wahaSession
  };
  
  // whatsappRecipient pode ser um número de telefone ou um ID de grupo
  // Se já contém @, use como está. Caso contrário, converta para chatId
  const chatId = whatsappRecipient.includes('@') ? whatsappRecipient : phoneToChatId(whatsappRecipient);
  console.log(`[sendImageToWhatsApp] Enviando para chatId: ${chatId}`);
  console.log(`[sendImageToWhatsApp] URL da imagem: ${imageUrl}`);
  console.log(`[sendImageToWhatsApp] Texto completo (${text.length} caracteres)`);
  
  try {
    // Envia a imagem COM o texto como caption (texto completo junto)
    const imageResponse = await wahaSendImage(wahaConfig, {
      chatId,
      caption: text, // Envia o texto completo como caption da imagem
      file: {
        url: imageUrl,
        mimetype: "image/jpeg",
        filename: "instagram-image.jpg"
      }
    });
    
    console.log(`[sendImageToWhatsApp] Imagem e texto enviados juntos com sucesso`);
    return { success: true, response: imageResponse };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[sendImageToWhatsApp] Erro ao enviar:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function sendVideoToWhatsApp(whatsappRecipient: string, text: string, videoUrl: string, wahaUrl: string, wahaApiKey: string, wahaSession: string): Promise<{ success: boolean; response?: any; error?: string }> {
  const wahaConfig: WahaConfig = {
    url: wahaUrl,
    apiKey: wahaApiKey,
    session: wahaSession
  };
  
  // whatsappRecipient pode ser um número de telefone ou um ID de grupo
  // Se já contém @, use como está. Caso contrário, converta para chatId
  const chatId = whatsappRecipient.includes('@') ? whatsappRecipient : phoneToChatId(whatsappRecipient);
  console.log(`[sendVideoToWhatsApp] Enviando para chatId: ${chatId}`);
  console.log(`[sendVideoToWhatsApp] URL do vídeo: ${videoUrl}`);
  console.log(`[sendVideoToWhatsApp] Texto completo (${text.length} caracteres)`);
  
  try {
    // Envia o vídeo COM o texto como caption (texto completo junto)
    const videoResponse = await wahaSendVideo(wahaConfig, {
      chatId,
      caption: text, // Envia o texto completo como caption do vídeo
      file: {
        url: videoUrl,
        mimetype: "video/mp4",
        filename: "instagram-video.mp4"
      }
    });
    
    console.log(`[sendVideoToWhatsApp] Vídeo e texto enviados juntos com sucesso`);
    return { success: true, response: videoResponse };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[sendVideoToWhatsApp] Erro ao enviar:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function runInstagramAgentWorkflow(
  agentId: string,
  instagramUrl: string,
  whatsappRecipient: string,
  personName: string,
  personInstagram: string,
  lastPostId?: string | null,
  lastRunAt?: Date | null,
  storage?: any
): Promise<WorkflowResult> {
  const logs: string[] = [];
  
  const log = (message: string) => {
    console.log(`[Instagram Agent ${agentId}] ${message}`);
    logs.push(message);
  };

  const saveLogs = async () => {
    if (storage && logs.length > 0) {
      try {
        await storage.appendExecutionLogs(agentId, logs);
      } catch (err) {
        console.error('Failed to save logs:', err);
      }
    }
  };

  try {
    log('🔄 Iniciando execução do workflow');
    
    if (!storage) {
      throw new Error('Storage não disponível');
    }
    
    const instance = await storage.getReplicadorAgentInstance();
    if (!instance) {
      log('❌ Nenhuma instância do Agente Replicador configurada');
      throw new Error('Nenhuma instância do Agente Replicador configurada. Configure uma instância na aba Agente Replicador.');
    }
    
    if (!instance.isActive) {
      log('⚠️ Instância do Agente Replicador está inativa');
      throw new Error('A instância do Agente Replicador está inativa. Ative a instância para executar o workflow.');
    }
    
    log(`✅ Usando instância: ${instance.instanceName}`);
    log(`📸 Buscando posts de ${instagramUrl} (ignorando posts fixados)...`);
    
    const allPosts = await scrapeInstagramPosts(instagramUrl);
    log(`✅ Encontrados ${allPosts.length} posts no total`);
    
    let postsToProcess: ScrapeResult[] = [];
    
    if (lastPostId) {
      const lastPostIndex = allPosts.findIndex(p => p.postId === lastPostId);
      
      if (lastPostIndex === -1) {
        log(`⚠️ Post anterior (${lastPostId}) não encontrado no batch.`);
        
        if (lastRunAt) {
          const lastRunTimestamp = new Date(lastRunAt).getTime();
          postsToProcess = allPosts.filter(p => p.timestamp > lastRunTimestamp);
          log(`📋 Usando lastRunAt como fallback: ${postsToProcess.length} posts após ${lastRunAt.toISOString()}`);
        } else {
          log(`⚠️ Sem lastRunAt disponível. Processando apenas o post mais recente para segurança.`);
          postsToProcess = allPosts.slice(-1);
        }
      } else if (lastPostIndex === allPosts.length - 1) {
        log(`✅ Último post processado (${lastPostId}) ainda é o mais recente. Nada a fazer.`);
        await saveLogs();
        return {
          success: true,
          postId: lastPostId,
          postsProcessed: 0,
        };
      } else {
        postsToProcess = allPosts.slice(lastPostIndex + 1);
        log(`📋 ${postsToProcess.length} novos posts encontrados após ${lastPostId}`);
      }
    } else {
      if (lastRunAt) {
        const lastRunTimestamp = new Date(lastRunAt).getTime();
        postsToProcess = allPosts.filter(p => p.timestamp > lastRunTimestamp);
        log(`📋 Primeira execução com lastRunAt: ${postsToProcess.length} posts após ${lastRunAt.toISOString()}`);
      } else {
        log(`📋 Primeira execução: processando apenas o post mais recente`);
        postsToProcess = allPosts.slice(-1);
      }
    }
    
    if (postsToProcess.length === 0) {
      log('✅ Nenhum post novo para processar');
      await saveLogs();
      return {
        success: true,
        postId: lastPostId || undefined,
        postsProcessed: 0,
      };
    }
    
    let lastProcessedPostId = lastPostId;
    let processedCount = 0;
    
    for (const post of postsToProcess) {
      log(`\n📌 Processando post ${processedCount + 1}/${postsToProcess.length}: ${post.postId}`);
      
      log('🤖 Transformando legenda com IA...');
      const transformedCaption = await transformCaption(post.caption, personName);
      log(`✅ Legenda transformada: "${transformedCaption.substring(0, 50)}..."`);
      
      log(`📱 Enviando para WhatsApp (${whatsappRecipient})...`);
      const finalMessage = `${transformedCaption}\n\n${personInstagram}`;
      
      let sendResult;
      if (post.mediaType === 'video') {
        log('🎥 Detectado conteúdo em vídeo, enviando como vídeo...');
        sendResult = await sendVideoToWhatsApp(whatsappRecipient, finalMessage, post.mediaUrl, instance.wahaUrl, instance.wahaApiKey, instance.wahaSession);
      } else {
        log('📸 Detectado conteúdo em imagem, enviando como imagem...');
        sendResult = await sendImageToWhatsApp(whatsappRecipient, finalMessage, post.mediaUrl, instance.wahaUrl, instance.wahaApiKey, instance.wahaSession);
      }
      
      if (!sendResult.success) {
        log(`❌ Falha ao enviar post ${post.postId}: ${sendResult.error}`);
        log(`⚠️ Parando processamento. ${processedCount} posts foram enviados com sucesso.`);
        await saveLogs();
        
        return {
          success: false,
          postId: lastProcessedPostId || undefined,
          postsProcessed: processedCount,
          error: `Falha ao enviar post ${post.postId}: ${sendResult.error}`,
        };
      }
      
      log('✅ Enviado para WhatsApp com sucesso!');
      
      await storage.updateLastRun(agentId, post.postId, new Date());
      lastProcessedPostId = post.postId;
      processedCount++;
      
      log(`✅ Marcado como processado: ${post.postId}`);
      
      if (processedCount < postsToProcess.length) {
        log('⏱️ Aguardando 3 segundos antes do próximo post...');
        await sleep(3000);
      }
    }
    
    log(`\n🎉 Workflow concluído! ${processedCount} posts enviados com sucesso.`);
    await saveLogs();
    
    return {
      success: true,
      postId: lastProcessedPostId || undefined,
      postsProcessed: processedCount,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    log(`❌ Erro: ${errorMsg}`);
    await saveLogs();
    console.error(`[Instagram Agent ${agentId}] Workflow error:`, error);
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}
