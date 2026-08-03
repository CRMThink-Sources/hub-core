import 'dotenv/config'

/** Page size do worker: clamp [1,50] (50 = teto de comandos do batch Bitrix). */
function parsePageSize(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 20
  return Math.min(50, Math.max(1, Math.trunc(n)))
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  // Quando setado, pino envia direto pro Loki (dev local com yarn dev, sem promtail).
  lokiUrl: process.env.LOKI_URL ?? '',
  // Leitura do Loki (query_range) pela aba Logs; distinto do push do pino acima.
  lokiQueryUrl: process.env.LOKI_QUERY_URL ?? 'http://localhost:3100',
  appUrl: process.env.APP_URL ?? '',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  bullBoard: {
    enabled: process.env.BULL_BOARD_ENABLED === 'true',
    username: process.env.BULL_BOARD_USERNAME ?? '',
    password: process.env.BULL_BOARD_PASSWORD ?? '',
  },
  apiUrl:
    process.env.API_URL && process.env.API_URL !== 'undefined'
      ? process.env.API_URL
      : 'https://homolog-hubthink.crmthink.com.br/api',
  frontUrl: process.env.FRONT_URL ?? '',
  crmthinkWebhookUrl: process.env.CRMTHINK_WEBHOOK_URL ?? '',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  zApi: {
    partnerToken: process.env.Z_API_PARTNER_TOKEN ?? '',
    clientToken: process.env.Z_API_CLIENT_TOKEN ?? '',
    callbackUrl: process.env.Z_API_CALLBACK_URL ?? '',
  },
  hubMessage: {
    publicKey: process.env.HUBMESSAGE_PUBLIC_KEY ?? '',
    secretKey: process.env.HUBMESSAGE_SECRET_KEY ?? '',
    baseUrl: process.env.HUBMESSAGE_BASE_URL ?? 'https://api.hubmessage.io',
    webhookUrl: process.env.HUBMESSAGE_WEBHOOK_URL ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    authUrl:
      process.env.GOOGLE_AUTH_URL ??
      'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:
      process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token',
    userInfoUrl:
      process.env.GOOGLE_USERINFO_URL ??
      'https://www.googleapis.com/oauth2/v3/userinfo',
    sheetsApiUrl:
      process.env.GOOGLE_SHEETS_API_URL ?? 'https://sheets.googleapis.com/v4',
  },
  contaAzul: {
    ClientId: process.env.CONTA_AZUL_CLIENT_ID ?? '',
    ClientSecret: process.env.CONTA_AZUL_CLIENT_SECRET ?? '',
    AuthUrl:
      process.env.CONTA_AZUL_AUTH_URL ??
      'https://auth.contaazul.com/oauth2/authorize',
    TokenUrl:
      process.env.CONTA_AZUL_TOKEN_URL ??
      'https://auth.contaazul.com/oauth2/token',
    ApiUrl: process.env.CONTA_AZUL_API_URL ?? 'https://api-v2.contaazul.com/v1',
  },
  omie: {
    apiUrl: process.env.OMIE_API_URL ?? 'https://app.omie.com.br/api/v1',
  },
  bling: {
    ClientId: process.env.BLING_CLIENT_ID ?? '',
    ClientSecret: process.env.BLING_CLIENT_SECRET ?? '',
    AuthUrl:
      process.env.BLING_AUTH_URL ??
      'https://www.bling.com.br/Api/v3/oauth/authorize',
    TokenUrl:
      process.env.BLING_TOKEN_URL ??
      'https://www.bling.com.br/Api/v3/oauth/token',
    ApiUrl: process.env.BLING_API_URL ?? 'https://api.bling.com.br/Api/v3',
  },
  bitrix: {
    webhookUrl:
      process.env.BITRIX_WEBHOOK_URL ??
      (process.env.API_URL ? `${process.env.API_URL}/api/webhooks/bitrix` : ''),
    connector: {
      code: process.env.BITRIX_CONNECTOR_CODE ?? 'hubthink_thinkzap',
      name: process.env.BITRIX_CONNECTOR_NAME ?? 'ThinkZap',
      url: process.env.BITRIX_CONNECTOR_URL ?? '',
    },
    iframeAudio: {
      code: process.env.BITRIX_IFRAME_AUDIO_CODE ?? 'thinkzap_audio',
      name: process.env.BITRIX_IFRAME_AUDIO_NAME ?? 'ThinkZap Audio',
      url: process.env.BITRIX_IFRAME_AUDIO_URL ?? '',
      hash: process.env.BITRIX_IFRAME_AUDIO_HASH ?? '',
    },
    placement: {
      name: process.env.BITRIX_PLACEMENT_NAME ?? 'ThinkZap',
      url: process.env.BITRIX_PLACEMENT_URL ?? '',
    },
    robot: {
      code: process.env.BITRIX_ROBOT_CODE ?? 'thinkzap_robot',
      name: process.env.BITRIX_ROBOT_NAME ?? 'ThinkZap Robot',
      handlerUrl: process.env.BITRIX_ROBOT_HANDLER_URL ?? '',
    },
    /** false only in local dev (e.g. SSL-inspecting proxy). Set BITRIX_TLS_REJECT_UNAUTHORIZED=false */
    tlsRejectUnauthorized:
      process.env.BITRIX_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
  appCodes: {
    thinkzap: process.env.THINKZAP_APP_CODE ?? 'crmthink.thinkzap',
    thinkanalise: process.env.THINKANALISE_APP_CODE ?? 'crmthink.thinkanalise',
    importsheet: process.env.IMPORTSHEET_APP_CODE ?? 'crmthink.importsheet',
    clicksign: process.env.CLICKSIGN_APP_CODE ?? 'crmthink.clicksign',
  },
  importsheet: {
    // Linhas por ciclo (round-robin). Default 20, teto 50 (batch Bitrix).
    pageSize: parsePageSize(process.env.IMPORTSHEET_PAGE_SIZE),
    // Pausa entre páginas p/ ficar sob o limite do Bitrix. Default 500ms; 0 desliga.
    pageDelayMs: Math.max(
      0,
      Number(process.env.IMPORTSHEET_PAGE_DELAY_MS ?? 500) || 0,
    ),
  },
  thinkzapMockZApiProvisioning:
    process.env.THINKZAP_MOCK_ZAPI_PROVISIONING === 'true' ||
    (process.env.NODE_ENV === 'local' &&
      process.env.THINKZAP_MOCK_ZAPI_PROVISIONING !== 'false'),
  clicksign: {
    robot: {
      code: process.env.CLICKSIGN_ROBOT_CODE ?? 'ENVIAR_DOCUMENTO',
      name: process.env.CLICKSIGN_ROBOT_NAME ?? 'Enviar documento',
    },
  },
  payments: {
    spa: {
      productEntityType: 1134,
      planEntityType: 1138,
      subscriptionEntityType: 1142,
      /**
       * SPA de aplicação — o item por instalação de app (domínio + app code),
       * espelho de `core_apps`. Existe para montar o nome do campo parent
       * (`parentId1060`) num lugar só, em vez de espalhar a string literal pelo
       * mapper e pelo repositório.
       *
       * Mesmo `entityTypeId` que o onboarding chama de `SPA_CLIENT`
       * (`shared/domain/config/bitrix.env.ts`): o nome de lá é o vocabulário do
       * fluxo de instalação e fica como está.
       */
      aplicationEntityType: 1060,
      /**
       * SPA de itens de assinatura — o que uma assinatura provisiona, na prática
       * um conector. O vínculo com a assinatura é o campo parent
       * (`parentId1142`), montado a partir de `subscriptionEntityType`.
       *
       * Não tem campo de provider: são dois pares de credenciais, e o
       * preenchimento diz qual conector é (ver `subscription-item.mapper.ts`).
       */
      subscriptionItemEntityType: 1146,
    },
  },
} as const
