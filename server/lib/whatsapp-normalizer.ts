/**
 * Utilitário centralizado para extração e normalização de números de WhatsApp
 * Hierarquia de prioridade: Chat → Sender → phone/chatId → from → fromChat
 */

export interface WhatsAppPayload {
  // Campos de _data.Info (mais confiáveis - números reais)
  _data?: {
    Info?: {
      Chat?: string;        // "5511944433996@s.whatsapp.net" (número real!)
      Sender?: string;      // "5511944433996:70@s.whatsapp.net" 
      SenderAlt?: string;   // "141420438544522:70@lid" (ID interno - NÃO USAR!)
    };
  };
  
  // Campos alternativos com data wrapper
  data?: {
    _data?: {
      Info?: {
        Chat?: string;
        Sender?: string;
        SenderAlt?: string;
      };
    };
    phone?: string;
    chatId?: string;
    from?: string;
  };
  
  // Campos de fallback
  phone?: string;
  chatId?: string;
  from?: string;
  fromChat?: string;
  
  // Campos legados/alternativos
  sender?: string;
}

/**
 * Extrai o número de telefone real do payload do WhatsApp
 * seguindo a hierarquia correta de campos
 * 
 * @param payload - Payload do webhook WAHA/WhatsApp
 * @returns Número de telefone limpo (apenas dígitos) ou null se não encontrado
 */
export function extractPhoneNumber(payload: WhatsAppPayload): string | null {
  // Helper: verifica se o valor termina com @lid (ID interno)
  const isInternalId = (value: string) => value.includes('@lid');
  
  // Lista de tentativas em ordem de prioridade
  // Tenta TODOS os campos até encontrar um sem @lid
  const attempts = [
    // PRIORIDADE 1: Campo Chat (contém número real)
    { value: payload._data?.Info?.Chat, source: 'Chat' },
    { value: payload.data?._data?.Info?.Chat, source: 'data.Chat' },
    
    // PRIORIDADE 2: Campo Sender (também contém número real)
    { value: payload._data?.Info?.Sender, source: 'Sender' },
    { value: payload.data?._data?.Info?.Sender, source: 'data.Sender' },
    
    // PRIORIDADE 3: SenderAlt - QUANDO Chat tem @lid, SenderAlt tem o número real!
    // Exemplo: Chat="169389399781422@lid" → SenderAlt="5511973046371@s.whatsapp.net" ✅
    { value: payload._data?.Info?.SenderAlt, source: 'SenderAlt' },
    { value: payload.data?._data?.Info?.SenderAlt, source: 'data.SenderAlt' },
    
    // PRIORIDADE 4: Campos phone/chatId
    { value: payload.phone, source: 'phone' },
    { value: payload.data?.phone, source: 'data.phone' },
    { value: payload.chatId, source: 'chatId' },
    { value: payload.data?.chatId, source: 'data.chatId' },
    
    // PRIORIDADE 5: Campo from
    { value: payload.from, source: 'from' },
    { value: payload.data?.from, source: 'data.from' },
    
    // PRIORIDADE 6: Campo fromChat (último recurso)
    { value: payload.fromChat, source: 'fromChat' },
  ];
  
  // Tentar cada campo em ordem, pulando os que têm @lid
  for (const attempt of attempts) {
    if (!attempt.value) continue; // Campo vazio, próximo
    
    if (isInternalId(attempt.value)) {
      console.log(`[WhatsApp Normalizer] ⏭️ Pulando ${attempt.source}: ${attempt.value} (contém @lid - ID interno)`);
      continue; // Tem @lid, próximo
    }
    
    // Encontrou número válido sem @lid!
    console.log(`[WhatsApp Normalizer] ✅ Usando número do campo ${attempt.source}: ${attempt.value}`);
    return processPhoneNumber(attempt.value);
  }
  
  // IMPORTANTE: NUNCA usar SenderAlt ou campos terminados com @lid pois contêm IDs internos!
  // @lid indica: "141420438544522:70@lid" ou "154502942425112@lid" (IDs internos)
  
  console.warn('[WhatsApp Normalizer] ❌ Nenhum número válido encontrado no payload (todos os campos continham @lid ou estavam vazios)');
  return null;
}

/**
 * Processa e valida o número de telefone extraído
 */
function processPhoneNumber(phoneNumber: string): string | null {
  
  // Limpar o número: remover @suffix e caracteres não numéricos
  const cleanNumber = phoneNumber
    .split('@')[0]      // Remove @s.whatsapp.net, @c.us, @lid, etc
    .split(':')[0]      // Remove :70 ou outros sufixos
    .replace(/\D/g, ''); // Remove todos caracteres não numéricos
  
  // Validar que o número tem pelo menos 10 dígitos
  if (cleanNumber.length < 10) {
    console.warn(`[WhatsApp Normalizer] ⚠️ Número muito curto (${cleanNumber.length} dígitos): ${cleanNumber}`);
    return null;
  }
  
  // VALIDAÇÃO CRÍTICA: Distinguir entre números brasileiros, internacionais e IDs internos
  // IDs internos geralmente têm 14+ dígitos sem código de país válido
  if (cleanNumber.length >= 14) {
    // Códigos de país válidos comuns (1-3 dígitos no início)
    const validCountryCodes = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244', '245', '246', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675', '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998'];
    
    const hasValidCountryCode = validCountryCodes.some(code => cleanNumber.startsWith(code));
    
    if (!hasValidCountryCode) {
      console.error(`[WhatsApp Normalizer] ❌ ID INTERNO DETECTADO (${cleanNumber.length} dígitos sem código de país válido): ${cleanNumber}`);
      console.error('[WhatsApp Normalizer] ❌ REJEITADO: Não começa com código de país conhecido');
      return null;
    }
  }
  
  // Padrão E.164: números internacionais válidos têm até 15 dígitos
  if (cleanNumber.length > 15) {
    console.error(`[WhatsApp Normalizer] ❌ ID INTERNO DETECTADO (${cleanNumber.length} dígitos): ${cleanNumber}`);
    console.error('[WhatsApp Normalizer] ❌ REJEITADO: Excede limite E.164 de 15 dígitos');
    return null;
  }
  
  // Para números brasileiros (código 55), aplicar validação estrita
  if (cleanNumber.startsWith('55')) {
    // Números brasileiros válidos: 12-13 dígitos (55 + DDD + telefone)
    if (cleanNumber.length < 12 || cleanNumber.length > 13) {
      console.error(`[WhatsApp Normalizer] ❌ Número brasileiro inválido (${cleanNumber.length} dígitos): ${cleanNumber}`);
      console.error('[WhatsApp Normalizer] ❌ REJEITADO: Números brasileiros devem ter 12-13 dígitos');
      return null;
    }
    console.log(`[WhatsApp Normalizer] ✅ Número brasileiro válido extraído: ${cleanNumber}`);
  } else {
    // Números internacionais: permitir 10-15 dígitos (padrão E.164)
    console.log(`[WhatsApp Normalizer] ✅ Número internacional válido extraído: ${cleanNumber} (${cleanNumber.length} dígitos)`);
  }
  
  return cleanNumber;
}

/**
 * Valida se um número de telefone é válido para o Brasil
 * @param phone - Número de telefone (apenas dígitos)
 * @returns true se o número é válido
 */
export function isValidBrazilianPhone(phone: string): boolean {
  if (!phone) return false;
  
  // Deve ter 12 ou 13 dígitos (55 + DDD + número com ou sem 9)
  if (phone.length < 12 || phone.length > 13) return false;
  
  // Deve começar com 55 (código do Brasil)
  if (!phone.startsWith('55')) return false;
  
  // DDD deve ser válido (11-99)
  const ddd = phone.substring(2, 4);
  const dddNum = parseInt(ddd);
  if (dddNum < 11 || dddNum > 99) return false;
  
  return true;
}

/**
 * Formata um número de telefone para exibição
 * @param phone - Número de telefone (apenas dígitos)
 * @returns Número formatado ou original se não for brasileiro
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  
  // Se for número brasileiro válido, formatar
  if (isValidBrazilianPhone(phone)) {
    const ddd = phone.substring(2, 4);
    const firstPart = phone.substring(4, 9);
    const secondPart = phone.substring(9);
    
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Retornar número sem formatação
  return phone;
}