// Script to configure webhook in WAHA

import { wahaGetSession, wahaSetWebhook, type WahaConfig } from './lib/waha-client';

async function configureWebhook() {
  const wahaUrl = process.env.WAHA_URL;
  const wahaApiKey = process.env.WAHA_API_KEY;
  const wahaSession = process.env.WAHA_SESSION;
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;

  if (!wahaUrl || !wahaApiKey || !wahaSession) {
    console.error('❌ Credenciais WAHA não configuradas');
    console.error('WAHA_URL:', wahaUrl ? 'Configurado' : 'Não configurado');
    console.error('WAHA_API_KEY:', wahaApiKey ? 'Configurado' : 'Não configurado');
    console.error('WAHA_SESSION:', wahaSession ? 'Configurado' : 'Não configurado');
    process.exit(1);
  }

  if (!domain) {
    console.error('❌ Domínio do Replit não encontrado');
    process.exit(1);
  }

  const webhookUrl = `https://${domain}/api/webhooks/whatsapp-messages`;
  console.log('📌 Configurando webhook para:', webhookUrl);

  const wahaConfig: WahaConfig = {
    url: wahaUrl,
    apiKey: wahaApiKey,
    session: wahaSession
  };

  try {
    // Check if session exists
    console.log('🔍 Verificando sessão WAHA...');
    try {
      const sessionInfo = await wahaGetSession(wahaConfig);
      console.log('✅ Sessão encontrada:', sessionInfo.name);
    } catch (error) {
      console.error('⚠️ Sessão não encontrada ou erro ao verificar:', error instanceof Error ? error.message : 'Erro desconhecido');
      console.log('💡 Certifique-se de que a sessão existe e está ativa no WAHA');
    }

    // Configure webhook
    console.log('📝 Configurando webhook...');
    await wahaSetWebhook(wahaConfig, webhookUrl);
    
    console.log('✅ Webhook configurado com sucesso!');
    console.log('🎯 Mensagens serão enviadas para:', webhookUrl);
    console.log('');
    console.log('📋 Configuração WAHA:');
    console.log('  - URL:', wahaUrl);
    console.log('  - Sessão:', wahaSession);
    console.log('  - Webhook:', webhookUrl);

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error);
    console.error('💡 Verifique se:');
    console.log('  1. O servidor WAHA está rodando e acessível');
    console.log('  2. A API key está correta');
    console.log('  3. A sessão existe e está ativa');
    console.log('  4. O webhook URL é acessível publicamente');
    process.exit(1);
  }
}

// Executar configuração
console.log('🚀 Iniciando configuração do webhook WAHA...\n');
configureWebhook().then(() => {
  console.log('\n✨ Configuração concluída!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erro na configuração:', error);
  process.exit(1);
});