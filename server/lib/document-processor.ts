/**
 * Módulo para processar documentos e extrair apenas o tema/assunto
 * Suporta PDF, DOCX, TXT e outros formatos
 * NÃO revela o conteúdo do documento, apenas identifica o tema
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import mammoth from 'mammoth';
import { fileTypeFromBuffer } from 'file-type';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Helper para fazer download de arquivo
 */
async function downloadFile(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: MAX_DOCUMENT_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('[DocumentProcessor] ❌ Erro ao baixar documento:', error);
    throw new Error('Não foi possível baixar o documento');
  }
}

/**
 * Extrai texto de um arquivo PDF
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('[DocumentProcessor] 🔄 Processando PDF...');
    
    // Converter buffer para string binária para buscar patterns
    const pdfContent = buffer.toString('binary');
    
    // Múltiplas estratégias de extração
    let extractedText = '';
    
    // Estratégia 1: Buscar texto entre parênteses (formato comum em PDFs)
    const textPattern1 = /\(((?:[^()\\]|\\.)*)\)/g;
    let matches = pdfContent.matchAll(textPattern1);
    for (const match of matches) {
      if (match[1]) {
        // Decodificar caracteres especiais
        let text = match[1]
          .replace(/\\(\d{3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\r/g, '\r')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        
        // Filtrar apenas texto legível
        if (/[a-zA-Z0-9\s]{3,}/.test(text)) {
          extractedText += text + ' ';
        }
      }
    }
    
    // Estratégia 2: Buscar texto com comando Tj
    const textPattern2 = /\((.*?)\)\s*Tj/g;
    matches = pdfContent.matchAll(textPattern2);
    for (const match of matches) {
      if (match[1] && !extractedText.includes(match[1])) {
        let text = match[1]
          .replace(/\\(\d{3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)));
        
        if (/[a-zA-Z0-9\s]{3,}/.test(text)) {
          extractedText += text + ' ';
        }
      }
    }
    
    // Estratégia 3: Buscar texto hexadecimal
    const hexPattern = /<([0-9a-fA-F]+)>\s*Tj/g;
    matches = pdfContent.matchAll(hexPattern);
    for (const match of matches) {
      if (match[1] && match[1].length % 2 === 0) {
        try {
          const text = Buffer.from(match[1], 'hex').toString('utf-8');
          if (/[a-zA-Z0-9\s]{3,}/.test(text)) {
            extractedText += text + ' ';
          }
        } catch (e) {
          // Ignorar erros de decodificação hex
        }
      }
    }
    
    // Limpar e normalizar o texto extraído
    extractedText = extractedText
      .replace(/[^\x20-\x7E\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u2070-\u218F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('[DocumentProcessor] 📊 Texto extraído:', extractedText.length, 'caracteres');
    
    // Se não conseguiu extrair texto suficiente, retornar indicação
    if (extractedText.length < 50) {
      console.log('[DocumentProcessor] ⚠️  Pouco texto extraído, PDF pode ter conteúdo protegido ou ser imagem');
      return '[documento não identificável - formato não suportado]';
    }
    
    // Limitar o tamanho do texto para não sobrecarregar
    if (extractedText.length > 5000) {
      extractedText = extractedText.substring(0, 5000) + '...';
    }
    
    console.log('[DocumentProcessor] ✅ Extração de PDF concluída');
    return extractedText;
    
  } catch (error: any) {
    console.error('[DocumentProcessor] ❌ Erro ao processar PDF:', error.message);
    return 'Documento PDF recebido mas não foi possível extrair o conteúdo';
  }
}

/**
 * Extrai texto de um arquivo DOCX
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('[DocumentProcessor] ❌ Erro ao processar DOCX:', error);
    throw new Error('Não foi possível processar o DOCX');
  }
}

/**
 * Extrai texto de um arquivo TXT
 */
function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString('utf-8');
}


/**
 * Identifica o tema/assunto do texto usando IA
 * Envia apenas uma pequena parte do texto para economizar tokens
 */
async function identifyDocumentTheme(text: string): Promise<string> {
  try {
    // Pegar apenas os primeiros 1500 caracteres do documento
    let textSample = text.substring(0, 1500);
    
    // Se o texto extraído tem muitos caracteres estranhos, tentar limpar
    const cleanedSample = textSample
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove caracteres de controle
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
    
    // Se depois de limpar sobrou muito pouco texto útil, usar mais caracteres
    if (cleanedSample.length < 200 && text.length > 1500) {
      textSample = text.substring(0, 3000);
    }
    
    // Se o texto for muito pequeno, retornar indicação genérica
    if (textSample.length < 50) {
      return '[documento não identificável - conteúdo insuficiente]';
    }
    
    console.log('[DocumentProcessor] 🤖 Analisando tema com IA...');
    console.log('[DocumentProcessor] 📊 Amostra de texto (primeiros 200 chars):', textSample.substring(0, 200));
    
    // Verificar se temos a API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[DocumentProcessor] ❌ OPENAI_API_KEY não configurada');
      return '[Erro ao processar documento: API key não configurada]';
    }
    
    try {
      // Fazer chamada para OpenAI
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente especializado em identificar o tema/assunto principal de documentos.
Analise o trecho do documento e identifique o assunto principal de forma útil mas genérica.
NÃO revele detalhes específicos, nomes próprios, valores ou informações confidenciais.
Responda em português com uma descrição curta (máximo 10 palavras).

Foque em identificar:
1. O tipo de documento (relatório, contrato, manual, proposta, etc.)
2. O assunto principal (imobiliário, sistema, vendas, educação, saúde, etc.)
3. A finalidade (técnico, comercial, jurídico, administrativo, etc.)

Exemplos de boas respostas:
- "relatório técnico de sistema imobiliário"
- "manual de uso de chat inteligente"
- "contrato de prestação de serviços"
- "documento médico de consulta"
- "proposta comercial de vendas"
- "relatório financeiro empresarial"
- "documento educacional acadêmico"
- "comunicado administrativo interno"
- "especificação técnica de software"

Evite respostas genéricas como:
- "documento PDF"
- "arquivo de texto"
- "documento gerado por software"`
            },
            {
              role: 'user',
              content: `Identifique o tema deste documento (responda em português):

${textSample}`
            }
          ],
          temperature: 0.3,
          max_tokens: 50
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      const theme = response.data.choices[0]?.message?.content?.trim() || '[tema não identificado]';
      console.log('[DocumentProcessor] ✅ Tema identificado pela IA:', theme);
      
      // Garantir que o tema está limpo e genérico
      const cleanTheme = theme
        .toLowerCase()
        .replace(/[^\w\s\u00C0-\u00FF\u0100-\u017F]/g, '') // Remove caracteres especiais mas mantém acentos
        .substring(0, 100); // Limita o tamanho
      
      return cleanTheme || '[documento recebido]';
      
    } catch (aiError: any) {
      console.error('[DocumentProcessor] ❌ Erro na chamada da IA:', aiError.message);
      
      // Retornar erro quando a API falha
      return '[Erro ao processar documento: falha na API de análise]';
    }
    
  } catch (error: any) {
    console.error('[DocumentProcessor] ❌ Erro ao identificar tema:', error);
    return '[documento recebido - tema não identificado]';
  }
}

/**
 * Processa um documento e retorna APENAS o tema/assunto
 * 
 * @param documentUrl - URL do documento
 * @param filename - Nome do arquivo (opcional)
 * @param mimeType - Tipo MIME do documento (opcional)
 * @returns Descrição do tema sem revelar conteúdo
 */
export async function processDocument(
  documentUrl: string,
  filename?: string,
  mimeType?: string
): Promise<string> {
  console.log('[DocumentProcessor] 📄 Iniciando processamento de documento');
  console.log('[DocumentProcessor] 📎 URL:', documentUrl);
  console.log('[DocumentProcessor] 📝 Arquivo:', filename || 'desconhecido');
  console.log('[DocumentProcessor] 🏷️  Tipo:', mimeType || 'não especificado');
  
  try {
    // 1. Fazer download do documento
    console.log('[DocumentProcessor] ⬇️  Baixando documento...');
    const buffer = await downloadFile(documentUrl);
    console.log('[DocumentProcessor] ✅ Download concluído:', (buffer.length / 1024).toFixed(2), 'KB');
    
    // 2. Detectar tipo de arquivo se não fornecido
    if (!mimeType) {
      const fileType = await fileTypeFromBuffer(buffer);
      mimeType = fileType?.mime;
      console.log('[DocumentProcessor] 🔍 Tipo detectado:', mimeType);
    }
    
    // 3. Extrair texto baseado no tipo de arquivo
    let text = '';
    const extension = filename?.split('.').pop()?.toLowerCase() || '';
    
    console.log('[DocumentProcessor] 📖 Extraindo texto do documento...');
    
    if (mimeType?.includes('pdf') || extension === 'pdf') {
      text = await extractTextFromPDF(buffer);
    } else if (mimeType?.includes('wordprocessingml') || extension === 'docx') {
      text = await extractTextFromDOCX(buffer);
    } else if (mimeType?.includes('text/plain') || extension === 'txt') {
      text = extractTextFromTXT(buffer);
    } else {
      // Para outros formatos, retornar erro pois só usamos OpenAI
      console.log('[DocumentProcessor] ⚠️  Formato de documento não suportado para transcrição via OpenAI');
      return '[Erro: Formato de documento não suportado. Apenas PDF, DOCX e TXT são aceitos]';
    }
    
    if (!text || text.trim().length < 10) {
      console.log('[DocumentProcessor] ⚠️  Documento vazio ou sem texto extraível');
      return '[documento sem conteúdo de texto]';
    }
    
    console.log('[DocumentProcessor] ✅ Texto extraído:', text.length, 'caracteres');
    
    // 4. Identificar tema SEM revelar conteúdo
    console.log('[DocumentProcessor] 🔍 Identificando tema do documento...');
    const theme = await identifyDocumentTheme(text);
    
    // 5. Formatar resposta final
    // Se o tema indica que não foi possível identificar, retornar mensagem especial
    if (theme.includes('[documento não identificável') || 
        theme.includes('documento ilegível') ||
        theme.includes('não foi possível')) {
      console.log('[DocumentProcessor] ⚠️  Documento não identificável');
      return '[DOCUMENTO_NAO_PROCESSAVEL]';
    }
    
    const response = `[Documento analisado]: ${theme}`;
    
    console.log('[DocumentProcessor] ✅ Processamento concluído');
    return response;
    
  } catch (error: any) {
    console.error('[DocumentProcessor] ❌ Erro no processamento:', error);
    
    // Retornar mensagem genérica sem revelar detalhes do erro
    if (error.message?.includes('baixar')) {
      return '[documento inacessível]';
    } else if (error.message?.includes('processar')) {
      return '[formato de documento não suportado]';
    } else {
      return '[documento recebido - processamento indisponível]';
    }
  }
}