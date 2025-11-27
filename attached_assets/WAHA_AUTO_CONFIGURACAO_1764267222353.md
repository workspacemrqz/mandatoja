# Configuracao Automatica de Instancias WAHA

Este documento explica como o sistema configura automaticamente webhook, headers e eventos quando uma nova instancia e criada no WAHA.

---

## Visao Geral

Quando uma nova instancia e criada atraves do endpoint `POST /api/instancias`, o sistema executa automaticamente as seguintes configuracoes:

1. **Webhook URL** - Endpoint para receber notificacoes do WAHA
2. **Eventos** - Tipos de eventos que o WAHA deve enviar
3. **Custom Headers** - Headers de autenticacao para as requisicoes do webhook

---

## Fluxo de Criacao e Configuracao

### Etapa 1: Criacao da Sessao no WAHA

Primeiro, o sistema cria a sessao no WAHA atraves da API:

```typescript
const wahaUrl = `${process.env.WAHA_API}/api/sessions`;
const wahaResponse = await fetch(wahaUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.WAHA_API_KEY || ''
  },
  body: JSON.stringify({
    name,
    config: {}
  })
});
```

### Etapa 2: Construcao Dinamica do Webhook URL

O sistema constroi automaticamente a URL do webhook utilizando o dominio publico do Replit:

```typescript
let domain: string;
if (process.env.REPLIT_DEV_DOMAIN) {
  domain = `https://${process.env.REPLIT_DEV_DOMAIN}`;
} else if (process.env.REPLIT_DOMAINS) {
  const firstDomain = process.env.REPLIT_DOMAINS.split(',')[0].trim();
  domain = `https://${firstDomain}`;
} else {
  domain = `${req.protocol}://${req.get('host')}`;
}

const webhookUrl = `${domain}/api/webhook/waha`;
```

**Resultado:** A URL do webhook sera algo como `https://seu-projeto.replit.app/api/webhook/waha`

### Etapa 3: Definicao dos Eventos

O sistema configura os eventos que o WAHA deve notificar:

```typescript
const events = ["message", "session.status"];
```

| Evento | Descricao |
|--------|-----------|
| `message` | Notifica quando uma mensagem e recebida |
| `session.status` | Notifica mudancas de status da sessao (WORKING, SCAN_QR_CODE, etc.) |

### Etapa 4: Configuracao dos Custom Headers

Se a variavel de ambiente `WAHA_API_KEY` estiver definida, o sistema adiciona o header de autenticacao:

```typescript
const customHeaders: Record<string, string> = {};
if (process.env.WAHA_API_KEY) {
  customHeaders['X-Api-Key'] = process.env.WAHA_API_KEY;
}
```

### Etapa 5: Envio da Configuracao para o WAHA

O sistema envia toda a configuracao para o WAHA atraves do metodo `updateSessionConfig`:

```typescript
const wahaConfig = {
  webhooks: webhooks,
  events: events,
  customHeaders: customHeaders
};

const wahaConfigSuccess = await wahaAPI.updateSessionConfig(sessionName, wahaConfig);
```

---

## Estrutura da Requisicao PUT para o WAHA

O WAHA espera a configuracao no seguinte formato:

```typescript
const body = {
  name: instanceName,
  config: {
    webhooks: [
      {
        url: "https://seu-projeto.replit.app/api/webhook/waha",
        events: ["message", "session.status"],
        customHeaders: [
          { name: "X-Api-Key", value: "sua-api-key" }
        ]
      }
    ]
  }
};
```

**Importante:** O WAHA espera `customHeaders` como um array de objetos `{name, value}`, nao como um objeto chave-valor simples.

### Conversao dos Headers

O sistema converte o objeto de headers para o formato esperado pelo WAHA:

```typescript
if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
  webhookConfig.customHeaders = Object.entries(config.customHeaders).map(([name, value]) => ({
    name,
    value
  }));
}
```

---

## Tratamento de Erros e Rollback

Se a configuracao falhar, o sistema realiza rollback completo:

### Falha na Configuracao do WAHA

```typescript
if (!wahaConfigSuccess) {
  // Rollback: Deleta a sessao do WAHA
  await fetch(`${process.env.WAHA_API}/api/sessions/${sessionName}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': process.env.WAHA_API_KEY || '' }
  });
  
  // Rollback: Deleta a instancia do banco de dados
  await storage.deleteInstance(sessionName);
  
  return res.status(500).json({ 
    error: 'Falha ao configurar webhook automaticamente'
  });
}
```

### Falha ao Salvar no Banco de Dados

```typescript
if (!updatedInstance) {
  // Deleta a sessao completa do WAHA
  await wahaAPI.deleteSession(sessionName);
  
  // Deleta a instancia do banco de dados
  await storage.deleteInstance(sessionName);
  
  return res.status(500).json({ 
    error: 'Falha ao salvar configuracao no banco de dados'
  });
}
```

---

## Variaveis de Ambiente Necessarias

| Variavel | Descricao | Obrigatoria |
|----------|-----------|-------------|
| `WAHA_API` | URL base da API do WAHA (ex: `http://localhost:3000`) | Sim |
| `WAHA_API_KEY` | Chave de autenticacao da API do WAHA | Nao (mas recomendada) |
| `REPLIT_DEV_DOMAIN` ou `REPLIT_DOMAINS` | Dominio publico do Replit (preenchido automaticamente) | Automatico |

---

## Resumo do Fluxo Completo

```
1. POST /api/instancias { name: "minha-instancia" }
        |
        v
2. Cria sessao no WAHA (POST /api/sessions)
        |
        v
3. Salva instancia no banco de dados
        |
        v
4. Constroi webhook URL dinamicamente
        |
        v
5. Define eventos: ["message", "session.status"]
        |
        v
6. Define headers: { "X-Api-Key": "..." }
        |
        v
7. Envia configuracao para WAHA (PUT /api/sessions/{name})
        |
        v
8. Atualiza banco de dados com configuracao
        |
        v
9. Retorna instancia configurada
```

---

## Exemplo de Resposta de Sucesso

```json
{
  "id": 1,
  "name": "minha-instancia",
  "status": "STARTING",
  "webhooks": ["https://seu-projeto.replit.app/api/webhook/waha"],
  "events": ["message", "session.status"],
  "customHeaders": { "X-Api-Key": "sua-api-key" },
  "autoConfigured": true
}
```

O campo `autoConfigured: true` indica que webhook, eventos e headers foram configurados automaticamente.
