import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWhatsApp(phone: string): string {
  if (!phone) return phone;
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length === 13) {
    const countryCode = digitsOnly.substring(0, 2);
    const areaCode = digitsOnly.substring(2, 4);
    const firstPart = digitsOnly.substring(4, 9);
    const secondPart = digitsOnly.substring(9, 13);
    return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  if (digitsOnly.length === 12) {
    const countryCode = digitsOnly.substring(0, 2);
    const areaCode = digitsOnly.substring(2, 4);
    const firstPart = digitsOnly.substring(4, 8);
    const secondPart = digitsOnly.substring(8, 12);
    return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  if (digitsOnly.length === 11) {
    const areaCode = digitsOnly.substring(0, 2);
    const firstPart = digitsOnly.substring(2, 7);
    const secondPart = digitsOnly.substring(7, 11);
    return `+55 (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  if (digitsOnly.length === 10) {
    const areaCode = digitsOnly.substring(0, 2);
    const firstPart = digitsOnly.substring(2, 6);
    const secondPart = digitsOnly.substring(6, 10);
    return `+55 (${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
}

export function maskWhatsAppInput(value: string): string {
  if (!value) return '';
  
  const digitsOnly = value.replace(/\D/g, '');
  
  // Detectar se tem código de país (55 no início)
  let hasCountryCode = false;
  let phoneDigits = digitsOnly;
  
  if (digitsOnly.length >= 12 && digitsOnly.startsWith('55')) {
    hasCountryCode = true;
    phoneDigits = digitsOnly.substring(2); // Remove o 55 para processar
  }
  
  let formatted = '';
  
  if (phoneDigits.length <= 2) {
    formatted = phoneDigits;
  } else if (phoneDigits.length <= 6) {
    formatted = `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2)}`;
  } else if (phoneDigits.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    formatted = `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2, 6)}-${phoneDigits.substring(6, 10)}`;
  } else {
    // Celular: (XX) XXXXX-XXXX
    formatted = `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2, 7)}-${phoneDigits.substring(7, 11)}`;
  }
  
  return hasCountryCode ? `+55 ${formatted}` : formatted;
}

export function unmaskWhatsApp(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatWhatsAppWithoutCountry(phoneNumber: string): string {
  if (!phoneNumber) return '';
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  let withoutCountry = cleaned;
  if (cleaned.startsWith('55')) {
    withoutCountry = cleaned.slice(2);
  }
  
  // 11 dígitos = celular (XX) XXXXX-XXXX
  if (withoutCountry.length === 11) {
    return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 7)}-${withoutCountry.slice(7)}`;
  }
  
  // 10 dígitos = fixo (XX) XXXX-XXXX
  if (withoutCountry.length === 10) {
    return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 6)}-${withoutCountry.slice(6)}`;
  }
  
  // Fallback para formatWhatsApp se não se encaixar nos padrões acima
  return formatWhatsApp(phoneNumber);
}

export function copyPhoneToClipboard(phoneNumber: string): void {
  if (!phoneNumber) {
    return;
  }
  
  const cleaned = phoneNumber.replace(/\D/g, '');
  const fullNumber = cleaned.startsWith('55') ? `+${cleaned}` : `+55${cleaned}`;
  
  navigator.clipboard.writeText(fullNumber).catch(() => {
    console.error('Failed to copy phone number');
  });
}
