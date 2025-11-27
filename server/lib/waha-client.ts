/**
 * WAHA API Client
 * Centralized client for all WAHA WhatsApp API calls
 * Documentation: https://waha.devlike.pro/docs/
 */

export interface WahaConfig {
  url: string;
  apiKey: string;
  session: string;
}

export interface WahaSendTextParams {
  chatId: string;
  text: string;
  reply_to?: string;
}

export interface WahaSendImageParams {
  chatId: string;
  file: {
    url?: string;
    data?: string;
    mimetype?: string;
    filename?: string;
  };
  caption?: string;
  reply_to?: string;
}

export interface WahaSendVideoParams {
  chatId: string;
  file: {
    url?: string;
    data?: string;
    mimetype?: string;
    filename?: string;
  };
  caption?: string;
  reply_to?: string;
}

export interface WahaTypingParams {
  chatId: string;
}

export interface WahaSendReactionParams {
  messageId: string;
  reaction: string;
}

export interface WahaChat {
  id: string;
  name?: string;
  picture?: string;
  [key: string]: any;
}

export interface WahaGroup {
  id: string;
  name: string;
  subject?: string;
  participants?: Array<{
    id: string;
    pushName?: string;
    name?: string;
    notify?: string;
    phone?: string;
  }>;
  [key: string]: any;
}

export interface WahaContact {
  id: string;
  name?: string;
  pushName?: string;
  notify?: string;
  number?: string;
  [key: string]: any;
}

export interface WahaMessage {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  to?: string;
  body: string;
  hasMedia: boolean;
  [key: string]: any;
}

/**
 * Base WAHA API request
 */
async function wahaRequest<T = any>(
  config: WahaConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.url}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': config.apiKey,
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Send text message
 */
export async function wahaSendText(
  config: WahaConfig,
  params: WahaSendTextParams
): Promise<any> {
  return wahaRequest(config, '/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Send image
 */
export async function wahaSendImage(
  config: WahaConfig,
  params: WahaSendImageParams
): Promise<any> {
  return wahaRequest(config, '/api/sendImage', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Send video
 */
export async function wahaSendVideo(
  config: WahaConfig,
  params: WahaSendVideoParams
): Promise<any> {
  return wahaRequest(config, '/api/sendVideo', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Get all chats (groups + direct messages)
 */
export async function wahaGetChats(
  config: WahaConfig,
  params?: { limit?: number; offset?: number }
): Promise<WahaChat[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  
  const query = queryParams.toString();
  const endpoint = `/api/${config.session}/chats${query ? `?${query}` : ''}`;
  
  return wahaRequest<WahaChat[]>(config, endpoint, { method: 'GET' });
}

/**
 * Get all groups
 */
export async function wahaGetGroups(
  config: WahaConfig,
  params?: { limit?: number; offset?: number }
): Promise<WahaGroup[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  
  const query = queryParams.toString();
  const endpoint = `/api/${config.session}/groups${query ? `?${query}` : ''}`;
  
  return wahaRequest<WahaGroup[]>(config, endpoint, { method: 'GET' });
}

/**
 * Get group by ID
 */
export async function wahaGetGroup(
  config: WahaConfig,
  groupId: string,
  options?: { force?: boolean }
): Promise<WahaGroup> {
  const queryParams = options?.force ? '?force=true' : '';
  const endpoint = `/api/${config.session}/groups/${encodeURIComponent(groupId)}${queryParams}`;
  return wahaRequest<WahaGroup>(config, endpoint, { method: 'GET' });
}

/**
 * Get group participants
 */
export async function wahaGetGroupParticipants(
  config: WahaConfig,
  groupId: string
): Promise<Array<any>> {
  const endpoint = `/api/${config.session}/groups/${encodeURIComponent(groupId)}/participants`;
  return wahaRequest<Array<any>>(config, endpoint, { method: 'GET' });
}

/**
 * Get contact by ID
 */
export async function wahaGetContact(
  config: WahaConfig,
  contactId: string
): Promise<WahaContact> {
  const queryParams = new URLSearchParams({
    contactId,
    session: config.session,
  });
  
  return wahaRequest<WahaContact>(config, `/api/contacts?${queryParams.toString()}`, {
    method: 'GET',
  });
}

/**
 * Get messages from chat
 */
export async function wahaGetMessages(
  config: WahaConfig,
  chatId: string,
  params?: { limit?: number; downloadMedia?: boolean }
): Promise<WahaMessage[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.downloadMedia !== undefined) {
    queryParams.set('downloadMedia', params.downloadMedia.toString());
  }
  
  const query = queryParams.toString();
  const endpoint = `/api/${config.session}/chats/${encodeURIComponent(chatId)}/messages${query ? `?${query}` : ''}`;
  
  return wahaRequest<WahaMessage[]>(config, endpoint, { method: 'GET' });
}

/**
 * Check if phone number exists on WhatsApp
 */
export async function wahaCheckNumberExists(
  config: WahaConfig,
  phone: string
): Promise<{ numberExists: boolean; chatId?: string }> {
  const queryParams = new URLSearchParams({
    phone,
    session: config.session,
  });
  
  return wahaRequest<{ numberExists: boolean; chatId?: string }>(
    config,
    `/api/contacts/check-exists?${queryParams.toString()}`,
    { method: 'GET' }
  );
}

/**
 * Helper to convert phone number to chatId format
 * @param phone - Phone number (e.g., "5511999999999")
 * @returns chatId in format "5511999999999@c.us"
 */
export function phoneToChatId(phone: string): string {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // If already has @c.us or @g.us suffix, return as is
  if (phone.includes('@')) {
    return phone;
  }
  
  // Add @c.us suffix for individual chats
  return `${cleanPhone}@c.us`;
}

/**
 * Helper to convert group ID to proper format
 * @param groupId - Group ID (may include -group suffix or not)
 * @returns groupId in format "123123123@g.us"
 */
export function groupIdToWaha(groupId: string): string {
  // If already has @g.us, return as is
  if (groupId.includes('@g.us')) {
    return groupId;
  }
  
  // Remove -group suffix if present
  const cleanId = groupId.replace('-group', '');
  
  // Add @g.us suffix
  return `${cleanId}@g.us`;
}

/**
 * Create WAHA session with webhook configuration
 */
export async function wahaCreateSession(
  config: WahaConfig,
  webhookUrl?: string,
  events: string[] = ['message']
): Promise<any> {
  const sessionConfig: any = {
    name: config.session,
  };

  if (webhookUrl) {
    sessionConfig.config = {
      webhooks: [
        {
          url: webhookUrl,
          events,
        },
      ],
    };
  }

  return wahaRequest(config, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionConfig),
  });
}

/**
 * Get session info
 */
export async function wahaGetSession(config: WahaConfig): Promise<any> {
  return wahaRequest(config, `/api/sessions/${config.session}`, {
    method: 'GET',
  });
}

/**
 * Start session
 */
export async function wahaStartSession(config: WahaConfig): Promise<any> {
  return wahaRequest(config, `/api/sessions/${config.session}/start`, {
    method: 'POST',
  });
}

/**
 * Stop session
 */
export async function wahaStopSession(config: WahaConfig): Promise<any> {
  return wahaRequest(config, `/api/sessions/${config.session}/stop`, {
    method: 'POST',
  });
}

/**
 * Logout from session (disconnects WhatsApp account and removes saved credentials)
 */
export async function wahaLogoutSession(config: WahaConfig): Promise<any> {
  const url = `${config.url}/api/sessions/${config.session}/logout`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  // WAHA may return empty response for logout, handle gracefully
  const text = await response.text();
  if (!text) {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true, message: text };
  }
}

/**
 * Start typing indicator
 */
export async function wahaStartTyping(
  config: WahaConfig,
  params: WahaTypingParams
): Promise<any> {
  return wahaRequest(config, '/api/startTyping', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Stop typing indicator
 */
export async function wahaStopTyping(
  config: WahaConfig,
  params: WahaTypingParams
): Promise<any> {
  return wahaRequest(config, '/api/stopTyping', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Send reaction to a message
 */
export async function wahaSendReaction(
  config: WahaConfig,
  params: WahaSendReactionParams
): Promise<any> {
  return wahaRequest(config, '/api/reaction', {
    method: 'PUT',
    body: JSON.stringify({
      session: config.session,
      ...params,
    }),
  });
}

/**
 * Mark messages as read (send "seen" status)
 * @param config - WAHA configuration
 * @param chatId - Chat ID to mark as read
 */
export async function wahaSendSeen(
  config: WahaConfig,
  chatId: string
): Promise<any> {
  return wahaRequest(config, '/api/sendSeen', {
    method: 'POST',
    body: JSON.stringify({
      session: config.session,
      chatId,
    }),
  });
}

/**
 * Calculate typing duration with random variation between 2-6 seconds
 * @param messageLength - Length of the message in characters (unused, kept for backwards compatibility)
 * @returns Duration in seconds (random between 2-6 seconds)
 */
export function calculateTypingDuration(messageLength: number): number {
  // Retorna um valor aleatório entre 2 e 6 segundos
  return 2 + Math.random() * 4;
}

/**
 * Delete/remove a WAHA session
 */
export async function wahaDeleteSession(config: WahaConfig): Promise<any> {
  const url = `${config.url}/api/sessions/${config.session}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  // WAHA returns empty response for DELETE, handle gracefully
  const text = await response.text();
  if (!text) {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true, message: text };
  }
}

/**
 * Get QR code for session authentication
 * Returns the QR code as base64 image data
 */
export async function wahaGetQrCode(config: WahaConfig): Promise<{ value: string; mimetype?: string }> {
  const url = `${config.url}/api/${config.session}/auth/qr`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get QR code as raw image
 */
export async function wahaGetQrCodeImage(config: WahaConfig): Promise<Buffer> {
  const url = `${config.url}/api/${config.session}/auth/qr`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'image/png',
      'X-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * List all sessions
 */
export async function wahaListSessions(baseUrl: string, apiKey: string): Promise<any[]> {
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA API error (${response.status}): ${errorText}`);
  }

  return response.json();
}
