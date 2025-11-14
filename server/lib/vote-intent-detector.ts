/**
 * Serviço de detecção de intenção de voto
 * Analisa mensagens em português para identificar declarações de apoio ou rejeição
 */

// Padrões de apoio explícito (alta confiança)
const APOIO_EXPLICITO = [
  /\b(vou|voto|votarei|vou votar)\s+(em|no|na|pro|pra|para o?)\s*(você|senhor|deputado|fábio|fabio)/i,
  /\b(apoio|apoiar|apoiando)\s+(o|ao?|você|senhor|deputado|fábio|fabio)/i,
  /\b(pode contar|conte)\s+(comigo|com meu voto|com meu apoio)/i,
  /\btô?\s+(contigo|com você|junto|fechado)/i,
  /\b(estou|estamos|tô|to)\s+com\s+(voc[êe]|você|vc)/i,  // Added "estou com você" pattern - removed trailing word boundary
  /\b(meu|nosso)\s+(voto|apoio)\s+(é|e|está?|tá)\s+(seu|garantido|certo)/i,
  /\bvoto\s+(confirmado|certo|garantido)/i,
  /\bapoio\s+(total|completo|garantido|confirmado)\b/i,  // Added "apoio total" pattern
  /\b(fechado|firmeza|tamo junto|estamos juntos)/i,
  /\bvou\s+(de|com)\s+(você|fábio|fabio)/i,
];

// Padrões de apoio implícito (média confiança)
const APOIO_IMPLICITO = [
  /\b(parabéns|sucesso|boa sorte|força)\s+(deputado|na eleição|na campanha)?/i,
  /\b(confio|acredito)\s+(em|no?)\s+(você|seu trabalho|senhor)/i,
  /\b(merece|tem)\s+(meu|nosso)\s+(respeito|admiração)/i,
  /\bgostei\s+(do|da)\s+(proposta|projeto|trabalho)/i,
];

// Padrões de rejeição (para não confundir com apoio)
const REJEICAO = [
  /\bnão\s+(vou|voto|votarei|apoio|quero)\s*(votar|apoiar)?\s*(em|no|na|pro|pra)?\s*(voc[êe]|vc|tu|senhor|deputado|f[áa]bio)?/i,
  /\bnunca\s+(vou|votaria|apoiaria|votarei)/i,
  /\bjá\s+tenho\s+(candidato|meu voto|meu deputado|outra pessoa)/i,
  /\bvoto\s+(em outro|noutro|em outra pessoa|em outro candidato)/i,
  /\bnão\s+(concordo|gosto|aprovo|quero|posso|vou)/i,
  /\b(desculp[ae]|foi mal|sinto muito|infelizmente)\s*,?\s*(mas|porém)?\s*(não|n)/i,
  /\bnão\s+d[áa]/i,
  /\bvou\s+(pensar|ver|analisar|decidir)/i,
  /\bainda\s+(não|n)\s+(sei|decidi|escolhi)/i,
  /\b(talvez|quem sabe|vamos ver)/i,
];

// Palavras-chave relacionadas ao candidato
const CANDIDATO_KEYWORDS = ['fábio', 'fabio', 'deputado', 'você', 'senhor'];

export interface VoteIntentResult {
  hasIntent: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  isSupport: boolean; // true para apoio, false para rejeição
  reason: string;
}

/**
 * Analisa uma mensagem para detectar intenção de voto
 */
export function analyzeVoteIntent(message: string): VoteIntentResult {
  if (!message || message.length < 3) {
    return {
      hasIntent: false,
      confidence: 'none',
      isSupport: false,
      reason: 'Mensagem muito curta'
    };
  }

  const normalizedMessage = message.toLowerCase();

  // Verifica rejeição primeiro (prioridade)
  for (const pattern of REJEICAO) {
    if (pattern.test(normalizedMessage)) {
      return {
        hasIntent: true,
        confidence: 'high',
        isSupport: false,
        reason: 'Rejeição explícita detectada'
      };
    }
  }

  // Verifica apoio explícito
  for (const pattern of APOIO_EXPLICITO) {
    if (pattern.test(normalizedMessage)) {
      return {
        hasIntent: true,
        confidence: 'high',
        isSupport: true,
        reason: 'Apoio explícito detectado'
      };
    }
  }

  // Verifica apoio implícito (só se mencionar candidato)
  const mencionaCandidato = CANDIDATO_KEYWORDS.some(keyword => 
    normalizedMessage.includes(keyword)
  );

  if (mencionaCandidato) {
    for (const pattern of APOIO_IMPLICITO) {
      if (pattern.test(normalizedMessage)) {
        return {
          hasIntent: true,
          confidence: 'medium',
          isSupport: true,
          reason: 'Apoio implícito detectado'
        };
      }
    }
  }

  return {
    hasIntent: false,
    confidence: 'none',
    isSupport: false,
    reason: 'Nenhuma intenção clara detectada'
  };
}

/**
 * Analisa histórico de mensagens para confirmar intenção
 * Aumenta confiança se há múltiplas declarações consistentes
 */
export function analyzeConversationIntent(messages: string[]): VoteIntentResult {
  if (!messages || messages.length === 0) {
    return {
      hasIntent: false,
      confidence: 'none',
      isSupport: false,
      reason: 'Sem histórico de mensagens'
    };
  }

  const intents = messages.map(msg => analyzeVoteIntent(msg));
  const supportIntents = intents.filter(i => i.hasIntent && i.isSupport);
  const rejectIntents = intents.filter(i => i.hasIntent && !i.isSupport);

  // Se há rejeição explícita, prevalece
  if (rejectIntents.length > 0) {
    return {
      hasIntent: true,
      confidence: 'high',
      isSupport: false,
      reason: 'Rejeição detectada no histórico'
    };
  }

  // Se há múltiplas declarações de apoio, aumenta confiança
  if (supportIntents.length >= 2) {
    return {
      hasIntent: true,
      confidence: 'high',
      isSupport: true,
      reason: 'Múltiplas declarações de apoio no histórico'
    };
  }

  // Se há uma declaração de apoio com alta confiança
  const highConfidenceSupport = supportIntents.find(i => i.confidence === 'high');
  if (highConfidenceSupport) {
    return highConfidenceSupport;
  }

  // Se há declaração de apoio com média confiança
  const mediumConfidenceSupport = supportIntents.find(i => i.confidence === 'medium');
  if (mediumConfidenceSupport) {
    return mediumConfidenceSupport;
  }

  return {
    hasIntent: false,
    confidence: 'none',
    isSupport: false,
    reason: 'Sem intenção clara no histórico'
  };
}