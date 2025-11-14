/**
 * Módulo para processar mídia (áudio e imagem) usando a API da OpenAI
 * - Transcrição de áudio usando Whisper
 * - Descrição de imagens usando GPT-4 Vision
 */

import FormData from 'form-data';
import axios from 'axios';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB - limite da OpenAI para Whisper
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB - limite razoável para imagens
const REQUEST_TIMEOUT = 60000; // 60 segundos

/**
 * Helper para fazer requisições com timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Valida se a URL é acessível e retorna o tamanho do arquivo
 */
async function validateMediaUrl(url: string, maxSize: number): Promise<{ valid: boolean; size?: number; error?: string }> {
  try {
    // Para URLs do Backblaze B2 ou S3 com assinatura, pular validação HEAD
    // Essas URLs geralmente têm parâmetros de autenticação e não permitem HEAD
    if (url.includes('backblazeb2.com') || url.includes('X-Amz-') || url.includes('amazonaws.com')) {
      return { valid: true };
    }
    
    // Para outras URLs, tentar HEAD primeiro
    try {
      const response = await fetchWithTimeout(url, { method: 'HEAD' }, 10000);
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          if (size > maxSize) {
            return { valid: false, error: `Arquivo muito grande: ${(size / 1024 / 1024).toFixed(2)}MB (máximo: ${(maxSize / 1024 / 1024).toFixed(2)}MB)` };
          }
          return { valid: true, size };
        }
        return { valid: true };
      }
    } catch (headError) {
      // Se HEAD falhar, tentar GET com Range header para pegar apenas 1 byte
    }
    
    // Fallback: tentar GET com Range header
    const rangeResponse = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-0'
      }
    }, 10000);
    
    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      return { valid: false, error: `URL retornou status ${rangeResponse.status}` };
    }
    
    // Tentar obter o tamanho do Content-Range header
    const contentRange = rangeResponse.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
      if (match && match[1]) {
        const size = parseInt(match[1], 10);
        if (size > maxSize) {
          return { valid: false, error: `Arquivo muito grande: ${(size / 1024 / 1024).toFixed(2)}MB (máximo: ${(maxSize / 1024 / 1024).toFixed(2)}MB)` };
        }
        return { valid: true, size };
      }
    }
    
    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { valid: false, error: `Erro ao validar URL: ${errorMessage}` };
  }
}

/**
 * Transcreve áudio para texto usando OpenAI Whisper API
 * 
 * @param audioUrl - URL do arquivo de áudio
 * @returns Texto transcrito ou mensagem de erro
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  
  const startTime = Date.now();
  
  // Validação inicial do parâmetro
  if (!audioUrl || typeof audioUrl !== 'string') {
    console.error('[OpenAI Media] ❌ URL de áudio inválida ou vazia:', audioUrl);
    return '[Erro: URL de áudio inválida ou vazia]';
  }
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[OpenAI Media] ❌ OPENAI_API_KEY não configurada');
      return '[Erro ao transcrever áudio: API key não configurada]';
    }
    
    // 1. Validar URL do áudio
    const validation = await validateMediaUrl(audioUrl, MAX_AUDIO_SIZE);
    
    if (!validation.valid) {
      console.error('[OpenAI Media] ❌ Validação falhou:', validation.error);
      return `[Erro: ${validation.error}]`;
    }
    
    if (validation.size) {
    }
    
    // 2. Fazer download do áudio
    const audioResponse = await fetchWithTimeout(audioUrl, {}, 30000);
    
    if (!audioResponse.ok) {
      console.error('[OpenAI Media] ❌ Erro ao fazer download:', audioResponse.status);
      return `[Erro ao fazer download do áudio: ${audioResponse.status}]`;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = Buffer.from(audioBuffer);
    
    
    // 3. Detectar extensão do arquivo
    const urlPath = new URL(audioUrl).pathname;
    const extension = urlPath.split('.').pop()?.toLowerCase() || 'ogg';
    const filename = `audio.${extension}`;
    
    
    // 4. Preparar FormData para envio
    const formData = new FormData();
    formData.append('file', audioBlob, {
      filename: filename,
      contentType: getAudioMimeType(extension)
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');
    
    // 5. Enviar para OpenAI Whisper API
    
    const response = await axios.post(
      `${OPENAI_API_BASE}/audio/transcriptions`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    const transcription = response.data;
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return transcription;
    
  } catch (error: any) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[OpenAI Media] ❌ Erro ao transcrever áudio (${elapsedTime}s):`, error);
    
    // Tratamento de erros do axios
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // A API OpenAI retornou um erro
        const status = error.response.status;
        const errorData = error.response.data;
        console.error('[OpenAI Media] ❌ Erro da API OpenAI:', status, errorData);
        
        if (status === 400) {
          return '[Erro: Formato de áudio não suportado ou arquivo corrompido]';
        } else if (status === 401) {
          return '[Erro: API key inválida ou sem permissão]';
        } else if (status === 413) {
          return '[Erro: Arquivo de áudio muito grande (máx: 25MB)]';
        } else if (status === 429) {
          return '[Erro: Limite de requisições excedido - tente novamente mais tarde]';
        }
        
        return `[Erro na transcrição: ${status}]`;
      } else if (error.code === 'ECONNABORTED') {
        return '[Erro: Timeout ao processar áudio - tente um arquivo menor]';
      } else if (!error.response) {
        return '[Erro: Não foi possível conectar ao serviço de transcrição]';
      }
    }
    
    if (error instanceof Error) {
      console.error('[OpenAI Media] Detalhes do erro:', error.message);
      return `[Erro ao processar áudio: ${error.message}]`;
    }
    
    return '[Erro ao processar áudio - por favor, tente novamente]';
  }
}

/**
 * Descreve uma imagem usando OpenAI GPT-4 Vision API
 * 
 * @param imageUrl - URL da imagem
 * @returns Descrição da imagem ou mensagem de erro
 */
export async function describeImage(imageUrl: string): Promise<string> {
  
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[OpenAI Media] ❌ OPENAI_API_KEY não configurada');
      return '[Erro ao descrever imagem: API key não configurada]';
    }
    
    // 1. Validar URL da imagem
    const validation = await validateMediaUrl(imageUrl, MAX_IMAGE_SIZE);
    
    if (!validation.valid) {
      console.error('[OpenAI Media] ❌ Validação falhou:', validation.error);
      return `[Erro: ${validation.error}]`;
    }
    
    if (validation.size) {
    }
    
    // 2. Enviar para GPT-4 Vision API
    
    const response = await fetchWithTimeout(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Descreva esta imagem de forma breve e objetiva em português. Seja específico sobre o que você vê, incluindo pessoas, objetos, texto visível, cores predominantes e contexto.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      },
      30000
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI Media] ❌ Erro da API OpenAI:', response.status, errorText);
      return `[Erro na descrição: ${response.status}]`;
    }
    
    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || '[Não foi possível gerar descrição]';
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return description;
    
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[OpenAI Media] ❌ Erro ao descrever imagem (${elapsedTime}s):`, error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return '[Erro: Timeout ao processar imagem - tente uma imagem menor]';
      }
      console.error('[OpenAI Media] Detalhes do erro:', error.message);
      return `[Erro ao processar imagem: ${error.message}]`;
    }
    
    return '[Erro ao processar imagem - por favor, tente novamente]';
  }
}

/**
 * Verifica o suporte para mídia usando OpenAI
 * 
 * @returns Informações sobre suporte de mídia
 */
export async function checkMediaSupport(): Promise<{
  audioSupport: boolean;
  imageSupport: boolean;
  modelsAvailable: string[];
}> {
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  return {
    audioSupport: !!apiKey,  // Whisper está disponível com OPENAI_API_KEY
    imageSupport: !!apiKey,  // GPT-4 Vision está disponível com OPENAI_API_KEY
    modelsAvailable: apiKey ? [
      'whisper-1 (transcrição de áudio)',
      'gpt-4o (visão avançada)',
      'gpt-4o-mini (visão econômica)'
    ] : []
  };
}

/**
 * Helper para determinar o MIME type do áudio baseado na extensão
 */
function getAudioMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'opus': 'audio/opus',
    'webm': 'audio/webm',
    'flac': 'audio/flac',
    'aac': 'audio/aac'
  };
  
  return mimeTypes[extension] || 'audio/ogg';
}
