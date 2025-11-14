/**
 * Utilidade para dividir mensagens longas em chunks para envio via WhatsApp
 */

const MAX_CHUNK_SIZE = 4000; // WhatsApp tem limite de ~4096, usamos 4000 para segurança
const CHUNK_DELAY_MS = 2000; // Delay de 2 segundos entre chunks
const SENTENCE_CHUNK_SIZE = 150; // Tamanho mínimo para começar a considerar chunking (150 chars)
const IDEAL_CHUNK_SIZE = 200; // Tamanho ideal para chunks (200 chars para parecer natural)
const MAX_CHUNK_BEFORE_SPLIT = 250; // Tamanho máximo antes de forçar divisão (250 chars)

/**
 * Divide um texto longo em chunks menores, tentando quebrar em parágrafos ou frases
 */
export function splitMessageIntoChunks(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  // Se a mensagem é menor que o limite, retorna como está
  if (text.length <= MAX_CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= MAX_CHUNK_SIZE) {
      chunks.push(remainingText);
      break;
    }

    // Tentar quebrar no último parágrafo dentro do limite
    let splitIndex = remainingText.lastIndexOf('\n\n', MAX_CHUNK_SIZE);
    
    // Se não encontrou parágrafo, tenta quebrar na última quebra de linha
    if (splitIndex === -1 || splitIndex < MAX_CHUNK_SIZE * 0.5) {
      splitIndex = remainingText.lastIndexOf('\n', MAX_CHUNK_SIZE);
    }

    // Se não encontrou quebra de linha, tenta quebrar no último ponto final
    if (splitIndex === -1 || splitIndex < MAX_CHUNK_SIZE * 0.5) {
      splitIndex = remainingText.lastIndexOf('. ', MAX_CHUNK_SIZE);
      if (splitIndex !== -1) {
        // Inclui o ponto apenas se não exceder o limite
        if (splitIndex + 1 <= MAX_CHUNK_SIZE) {
          splitIndex += 1;
        }
      }
    }

    // Se ainda não encontrou, tenta quebrar no último espaço
    if (splitIndex === -1 || splitIndex < MAX_CHUNK_SIZE * 0.5) {
      splitIndex = remainingText.lastIndexOf(' ', MAX_CHUNK_SIZE);
    }

    // Se não encontrou nenhum ponto de quebra natural, força no limite
    if (splitIndex === -1 || splitIndex < MAX_CHUNK_SIZE * 0.5) {
      splitIndex = MAX_CHUNK_SIZE;
    }

    // Garante que o splitIndex nunca excede MAX_CHUNK_SIZE
    splitIndex = Math.min(splitIndex, MAX_CHUNK_SIZE);

    // Adiciona o chunk
    const chunk = remainingText.substring(0, splitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Atualiza o texto restante
    remainingText = remainingText.substring(splitIndex).trim();
  }

  return chunks;
}

/**
 * Divide uma mensagem em chunks menores baseados em sentenças naturais
 * Agrupa 2-3 sentenças por chunk para criar mensagens mais naturais
 * Garante que nenhum chunk exceda o limite máximo do WhatsApp
 */
export function splitMessageBySentences(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  // Log de debug para acompanhar o processamento
  console.log(`[Message Chunker] 📝 Mensagem original: ${text.length} caracteres`);

  // Se a mensagem é muito curta, retorna como está
  if (text.length <= SENTENCE_CHUNK_SIZE) {
    console.log(`[Message Chunker] ✅ Mensagem curta (${text.length} <= ${SENTENCE_CHUNK_SIZE}), não precisa dividir`);
    return [text];
  }

  const chunks: string[] = [];
  
  // Divide o texto em sentenças - captura pontuação com ou sem espaço
  // Regex melhorado para capturar: "texto." ou "texto. " ou "texto!" etc.
  const sentences = text.split(/([.!?]+(?:\s+|(?=[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ])|$))/).filter(s => s.length > 0);
  
  let currentChunk = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Se é apenas pontuação, anexa ao chunk atual
    if (/^[.!?]+\s*$/.test(sentence)) {
      currentChunk += sentence;
      continue;
    }
    
    // Verifica se adicionar esta sentença excederia um tamanho razoável
    const potentialChunk = currentChunk + sentence;
    
    // PROTEÇÃO: Se o chunk potencial excederia o limite máximo do WhatsApp
    if (potentialChunk.length > MAX_CHUNK_SIZE) {
      // Salva o chunk atual se houver
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      // Inicia novo chunk com a sentença atual
      currentChunk = sentence;
      continue;
    }
    
    // Se o chunk atual está vazio, adiciona a sentença
    if (currentChunk.length === 0) {
      // PROTEÇÃO: Se a sentença sozinha excede MAX_CHUNK_BEFORE_SPLIT, força divisão
      if (sentence.length > MAX_CHUNK_BEFORE_SPLIT) {
        console.log(`[Message Chunker] ⚠️ Sentença muito longa (${sentence.length} chars), dividindo em palavras`);
        // Para sentenças muito longas, divide em pedaços menores
        const words = sentence.split(' ');
        let tempChunk = '';
        
        for (const word of words) {
          if ((tempChunk + ' ' + word).length > MAX_CHUNK_BEFORE_SPLIT) {
            if (tempChunk.trim().length > 0) {
              chunks.push(tempChunk.trim());
              console.log(`[Message Chunker] 📄 Chunk criado (divisão de sentença): ${tempChunk.trim().length} chars`);
            }
            tempChunk = word;
          } else {
            tempChunk = tempChunk ? tempChunk + ' ' + word : word;
          }
        }
        
        // Adiciona o que sobrou como início do próximo chunk
        if (tempChunk.trim().length > 0) {
          currentChunk = tempChunk.trim();
        }
      } else {
        currentChunk = sentence;
      }
      continue;
    }
    
    // Divide quando:
    // 1. Chunk atual já excede MAX_CHUNK_BEFORE_SPLIT (força divisão mesmo sem sentença completa)
    // 2. Excede o tamanho ideal (IDEAL_CHUNK_SIZE) E já tem pelo menos 1 sentença completa
    // 3. Já tem 1-2 sentenças completas (para manter chunks menores)
    const sentenceCount = (currentChunk.match(/[.!?]/g) || []).length;
    
    // Força divisão se o chunk atual já está grande demais
    if (currentChunk.length > MAX_CHUNK_BEFORE_SPLIT) {
      console.log(`[Message Chunker] ⚠️ Chunk atual excede limite (${currentChunk.length} > ${MAX_CHUNK_BEFORE_SPLIT}), forçando divisão`);
      // Adiciona o chunk atual
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        console.log(`[Message Chunker] 📄 Chunk criado (limite excedido): ${currentChunk.trim().length} chars`);
      }
      
      // Se a próxima sentença também é muito longa, divide ela
      if (sentence.length > MAX_CHUNK_BEFORE_SPLIT) {
        const words = sentence.split(' ');
        let tempChunk = '';
        
        for (const word of words) {
          if ((tempChunk + ' ' + word).length > MAX_CHUNK_BEFORE_SPLIT) {
            if (tempChunk.trim().length > 0) {
              chunks.push(tempChunk.trim());
              console.log(`[Message Chunker] 📄 Chunk criado (divisão forçada): ${tempChunk.trim().length} chars`);
            }
            tempChunk = word;
          } else {
            tempChunk = tempChunk ? tempChunk + ' ' + word : word;
          }
        }
        currentChunk = tempChunk.trim();
      } else {
        currentChunk = sentence;
      }
    } else if (potentialChunk.length > IDEAL_CHUNK_SIZE) {
      // Se adicionar a próxima sentença excede o tamanho ideal, cria um chunk
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        console.log(`[Message Chunker] 📄 Chunk criado (tamanho ideal): ${currentChunk.trim().length} chars, ${sentenceCount} sentença(s)`);
      }
      currentChunk = sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Adiciona o último chunk se houver
  if (currentChunk.trim().length > 0) {
    const trimmed = currentChunk.trim();
    // PROTEÇÃO: Se o último chunk excede o limite, divide ele
    if (trimmed.length > MAX_CHUNK_SIZE) {
      const subChunks = splitMessageIntoChunks(trimmed);
      chunks.push(...subChunks);
    } else {
      chunks.push(trimmed);
    }
  }
  
  // PROTEÇÃO FINAL: Garantir que NENHUM chunk exceda o limite
  const validatedChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > MAX_CHUNK_SIZE) {
      // Se um chunk ainda exceder, divide usando a função de segurança
      const subChunks = splitMessageIntoChunks(chunk);
      validatedChunks.push(...subChunks);
    } else {
      validatedChunks.push(chunk);
    }
  }
  
  // Se não conseguiu dividir (ex: texto sem pontuação), usa fallback seguro
  if (validatedChunks.length === 0) {
    console.log(`[Message Chunker] ⚠️ Nenhum chunk criado, usando fallback`);
    return splitMessageIntoChunks(text);
  }
  
  // Log de debug do resultado final
  console.log(`[Message Chunker] ✅ Total de ${validatedChunks.length} chunk(s) criado(s):`);
  validatedChunks.forEach((chunk, index) => {
    console.log(`[Message Chunker] 📄 Chunk ${index + 1}: ${chunk.length} caracteres`);
  });
  
  return validatedChunks;
}

/**
 * Helper para aguardar um tempo em milissegundos
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retorna o delay padrão entre chunks em milissegundos
 */
export function getChunkDelay(): number {
  return CHUNK_DELAY_MS;
}
