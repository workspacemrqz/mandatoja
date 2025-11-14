import { DateTime } from 'luxon';

/**
 * Timezone do Brasil - São Paulo
 * Todos os horários do sistema devem usar este timezone
 */
export const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtém o momento atual no timezone de São Paulo
 * @returns DateTime object no timezone de São Paulo
 */
export function nowInSaoPaulo(): DateTime {
  return DateTime.now().setZone(SAO_PAULO_TIMEZONE);
}

/**
 * Converte uma Date para DateTime no timezone de São Paulo
 * @param date Date object a ser convertida
 * @returns DateTime no timezone de São Paulo
 */
export function toSaoPauloTime(date: Date): DateTime {
  return DateTime.fromJSDate(date).setZone(SAO_PAULO_TIMEZONE);
}

/**
 * Formata uma data/hora para string legível em português brasileiro
 * @param date Date object ou DateTime
 * @returns String formatada (ex: "04/11/2025, 14:30:45")
 */
export function formatDateBrazil(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPauloTime(date) : date;
  return dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS, { locale: 'pt-BR' });
}

/**
 * Obtém o horário atual como string HH:mm no timezone de São Paulo
 * @returns String no formato HH:mm (ex: "14:30")
 */
export function getCurrentTimeString(): string {
  return nowInSaoPaulo().toFormat('HH:mm');
}

/**
 * Verifica se um horário está dentro de uma janela de tempo
 * @param timeStr Horário a verificar no formato HH:mm
 * @param startTime Horário de início no formato HH:mm
 * @param endTime Horário de fim no formato HH:mm
 * @returns true se o horário está dentro da janela
 */
export function isTimeInRange(timeStr: string, startTime: string, endTime: string): boolean {
  return timeStr >= startTime && timeStr <= endTime;
}

/**
 * Verifica se o horário atual está dentro do horário de funcionamento (09:00 - 21:00)
 * O agente responde normalmente entre 09:00 e 21:00.
 * Fora desse horário, as respostas são armazenadas em fila e enviadas a partir das 09:00.
 * @returns true se está dentro do horário de funcionamento
 */
export function isWithinWorkingHours(): boolean {
  const currentTimeStr = getCurrentTimeString();
  const startTime = '09:00';
  const endTime = '21:00';
  
  
  return isTimeInRange(currentTimeStr, startTime, endTime);
}

/**
 * Calcula o próximo horário válido para processar mensagens
 * Horário fixo: 09:00 - 21:00
 * Mensagens fora desse horário são agendadas para exatamente 09:00 do próximo dia útil
 * O delay de 1 minuto entre mensagens é gerenciado pela lógica de fila do workflow
 * @returns Date object do próximo horário válido (exatamente 09:00 se fora do horário)
 */
export function getNextValidProcessTime(): Date {
  const now = nowInSaoPaulo();
  const startTime = '09:00';
  const endTime = '21:00';
  
  // Parse start time
  const [startHour, startMinute] = startTime.split(':').map(Number);
  
  // Get current time as HH:mm string
  const currentTimeStr = now.toFormat('HH:mm');
  
  let nextValidTime: DateTime;
  
  if (currentTimeStr < startTime) {
    // Se é antes do horário de início hoje, agendar para exatamente 09:00 de hoje
    nextValidTime = now.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  } else if (currentTimeStr >= endTime) {
    // Se passou do horário de fim hoje, agendar para exatamente 09:00 de amanhã
    nextValidTime = now.plus({ days: 1 }).set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  } else {
    // Se estamos dentro do horário, pode processar agora
    nextValidTime = now;
  }
  
  
  // Retornar como Date object (será convertido para UTC ao salvar no banco)
  return nextValidTime.toJSDate();
}

/**
 * Converte uma string de tempo HH:mm para minutos desde meia-noite
 * Útil para comparações numéricas
 * @param timeStr String no formato HH:mm
 * @returns Número de minutos desde meia-noite
 */
export function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Verifica se dois timestamps estão no mesmo dia (São Paulo timezone)
 * @param date1 Primeira data
 * @param date2 Segunda data
 * @returns true se estão no mesmo dia
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const dt1 = toSaoPauloTime(date1);
  const dt2 = toSaoPauloTime(date2);
  return dt1.hasSame(dt2, 'day');
}
