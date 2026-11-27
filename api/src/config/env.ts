import 'dotenv/config'

// Parsers

export type StripeEnvironment = 'production' | 'homolog'

export function resolveStripeEnvironment(
  secretKey: string | undefined,
): StripeEnvironment {
  return /^(sk|rk)_live_/.test(secretKey ?? '') ? 'production' : 'homolog'
}

/** Milissegundos > 0 vindos do ambiente; ausente, inválido ou ≤ 0 cai no padrão. */
export function positiveMs(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0
    ? Math.trunc(n)
    : fallback
}

function parsePageSize(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 20
  return Math.min(50, Math.max(1, Math.trunc(n)))
}

export function bitrixBotWebhookFromApiUrl(apiUrl: string | undefined): string {
  if (!apiUrl) return ''

  const base = apiUrl.replace(/\/+$/, '')
  const prefixo = base.endsWith('/api') ? '' : '/api'

  return `${base}${prefixo}/webhooks/bitrix-bot`
}

export const DEFAULT_FAILURE_RETENTION_DAYS = 7

export function parseFailureRetentionDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_FAILURE_RETENTION_DAYS
  }

  const days = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(
      `FAILURE_RETENTION_DAYS inválido ("${raw}"): informe um número inteiro de dias maior ou igual a 1 (ou deixe vazio para ${DEFAULT_FAILURE_RETENTION_DAYS}).`,
    )
  }

  return days
}

export const DEFAULT_SEND_HISTORY_DAYS = 90

/**
 * Por quantos dias o banco guarda o histórico dos envios rastreados (widget e robôs),
 * que a aba de envios consulta. Mesma validação de `FAILURE_RETENTION_DAYS`.
 */
export function parseSendHistoryDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_SEND_HISTORY_DAYS
  }

  const days = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(
      `THINKZAP_SEND_HISTORY_DAYS inválido ("${raw}"): informe um número inteiro de dias maior ou igual a 1 (ou deixe vazio para ${DEFAULT_SEND_HISTORY_DAYS}).`,
    )
  }

  return days
}

export function parseSubscriptionExpirationEnabled(
  raw: string | undefined,
  fallback: boolean,
): boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

export function parseManualSubscriptionGraceDays(
  raw: string | undefined,
): number {
  if (raw === undefined || raw.trim() === '') return 0

  const days = Number(raw)
  if (Number.isInteger(days) && days >= 0) return days

  console.warn(
    `[env] MANUAL_SUBSCRIPTION_GRACE_DAYS inválido (${JSON.stringify(raw)}) — usando 0`,
  )
  return 0
}

export function parseReconcileHour(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 3
  const hour = Number(raw)
  if (Number.isInteger(hour) && hour >= 0 && hour <= 23) return hour
  console.warn(
    `[env] SUBSCRIPTION_RECONCILE_HOUR inválido (${JSON.stringify(raw)}) — usando 3`,
  )
  return 3
}

export function parseStripeSyncEnabled(
  raw: string | undefined,
  providerEffects: boolean,
  stripeEnvironment: StripeEnvironment,
): boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return providerEffects && stripeEnvironment === 'production'
}

export function parseCrmthinkTasksGroupId(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 2677
  const id = Number(raw)
  if (Number.isInteger(id) && id > 0) return id
  console.warn(
    `[env] CRMTHINK_TASKS_GROUP_ID inválido (${JSON.stringify(raw)}) — usando 2677`,
  )
  return 2677
}

const providerEffectsEnabled =
  process.env.THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED !== 'false'

const stripeEnvironment = resolveStripeEnvironment(
  process.env.STRIPE_SECRET_KEY,
)

export const env = {
  // Geral
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  lokiUrl: process.env.LOKI_URL ?? '',
  lokiQueryUrl: process.env.LOKI_QUERY_URL ?? 'http://localhost:3100',
  appUrl: process.env.APP_URL ?? '',
  apiUrl:
    process.env.API_URL && process.env.API_URL !== 'undefined'
      ? process.env.API_URL
      : 'https://homolog-hubthink.crmthink.com.br/api',
  frontUrl: process.env.FRONT_URL ?? process.env.APP_URL ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  queuePrefix: process.env.QUEUE_PREFIX ?? 'bull',
  // Insights: valores a calibrar com os logs `insightsTiming` (ver a change
  // `insights-carga-assincrona`). Inválido ou ausente cai no padrão.
  insights: {
    // Validade, no Redis, das sessões de dias já fechados (anteriores a ontem).
    // Fechamento tardio de sessão só aparece depois disso.
    closedDayTtlMs: positiveMs(
      process.env.INSIGHTS_CLOSED_DAY_TTL_MS,
      24 * 3600e3,
    ),
    // Espera da última nova tentativa quando a Vibe API devolve 429 ao ler um chat.
    chat429FinalWaitMs: positiveMs(
      process.env.INSIGHTS_CHAT_429_FINAL_WAIT_MS,
      5000,
    ),
  },
  bullBoard: {
    enabled: process.env.BULL_BOARD_ENABLED === 'true',
    username: process.env.BULL_BOARD_USERNAME ?? '',
    password: process.env.BULL_BOARD_PASSWORD ?? '',
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  failureRetention: {
    days: parseFailureRetentionDays(process.env.FAILURE_RETENTION_DAYS),
    purgeEnabled: process.env.FAILURE_PURGE_ENABLED === 'true',
  },
  thinkzapSendHistoryDays: parseSendHistoryDays(
    process.env.THINKZAP_SEND_HISTORY_DAYS,
  ),
  appCodes: {
    thinkzap: process.env.THINKZAP_APP_CODE ?? 'crmthink.thinkzap',
    thinkanalise: process.env.THINKANALISE_APP_CODE ?? 'crmthink.thinkanalise',
    importsheet: process.env.IMPORTSHEET_APP_CODE ?? 'crmthink.importsheet',
    clicksign: process.env.CLICKSIGN_APP_CODE ?? 'crmthink.clicksign2',
    gptmaker: process.env.GPTMAKER_APP_CODE ?? 'crmthink.gptmaker',
  },

  // Portal CRMThink
  crmthinkWebhookUrl: process.env.CRMTHINK_WEBHOOK_URL ?? '',
  bitrixSpaWebhookToken: process.env.BITRIX_SPA_WEBHOOK_TOKEN ?? '',
  crmthinkTasks: {
    syncEnabled: process.env.CRMTHINK_TASKS_SYNC_ENABLED === 'true',
    groupId: parseCrmthinkTasksGroupId(process.env.CRMTHINK_TASKS_GROUP_ID),
    webhookToken: process.env.CRMTHINK_TASKS_WEBHOOK_TOKEN ?? '',
  },

  // Pagamentos
  payments: {
    spa: {
      productEntityType: 1134,
      planEntityType: 1138,
      subscriptionEntityType: 1142,
      aplicationEntityType: 1060,
      subscriptionItemEntityType: 1146,
      providerEffectsEnabled,
    },
    expiration: {
      enabled: parseSubscriptionExpirationEnabled(
        process.env.SUBSCRIPTION_EXPIRATION_ENABLED,
        providerEffectsEnabled,
      ),
      manualGraceDays: parseManualSubscriptionGraceDays(
        process.env.MANUAL_SUBSCRIPTION_GRACE_DAYS,
      ),
      reconcileHour: parseReconcileHour(
        process.env.SUBSCRIPTION_RECONCILE_HOUR,
      ),
      reconcileTimeZone:
        process.env.SUBSCRIPTION_RECONCILE_TIMEZONE ?? 'America/Sao_Paulo',
    },
    trialPlanId: process.env.THINKZAP_TRIAL_PLAN_ID ?? '',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      environment: stripeEnvironment,
    },
    stripeSync: {
      enabled: parseStripeSyncEnabled(
        process.env.STRIPE_SYNC_ENABLED,
        providerEffectsEnabled,
        stripeEnvironment,
      ),
    },
  },

  // Bitrix24
  bitrix: {
    webhookUrl:
      process.env.BITRIX_WEBHOOK_URL ??
      (process.env.API_URL ? `${process.env.API_URL}/api/webhooks/bitrix` : ''),
    botWebhookUrl:
      process.env.BITRIX_BOT_WEBHOOK_URL ??
      bitrixBotWebhookFromApiUrl(process.env.API_URL),
    botFlowCode: process.env.BITRIX_BOT_FLOW_CODE ?? 'thinkzap-flow',
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
    iframeButton: {
      code: process.env.BITRIX_IFRAME_BUTTON_CODE ?? 'thinkzap_button',
      name: process.env.BITRIX_IFRAME_BUTTON_NAME ?? 'ThinkZap Botões',
      url: process.env.BITRIX_IFRAME_BUTTON_URL ?? '',
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
    templateRobot: {
      code: process.env.BITRIX_TEMPLATE_ROBOT_CODE ?? 'thinkzap_template_robot',
      name:
        process.env.BITRIX_TEMPLATE_ROBOT_NAME ??
        'ThinkZap - Enviar template (WhatsApp Oficial)',
      handlerUrl: process.env.BITRIX_TEMPLATE_ROBOT_HANDLER_URL ?? '',
      placementUrl: process.env.BITRIX_TEMPLATE_ROBOT_PLACEMENT_URL ?? '',
    },
    buttonRobotOfficial: {
      code:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_CODE ??
        'thinkzap_button_robot_official',
      name:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_NAME ??
        'ThinkZap - Enviar botões (WhatsApp Oficial)',
      handlerUrl: process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_HANDLER_URL ?? '',
      placementUrl:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_PLACEMENT_URL ?? '',
    },
    buttonRobotUnofficial: {
      code:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_CODE ??
        'thinkzap_button_robot_unofficial',
      name:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_NAME ??
        'ThinkZap - Enviar botões (Z-API)',
      handlerUrl: process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_HANDLER_URL ?? '',
      placementUrl:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_PLACEMENT_URL ?? '',
    },
    smsSender: {
      codePrefix: process.env.BITRIX_SMS_SENDER_CODE_PREFIX ?? 'thinkzap_sms',
      handlerUrl: process.env.BITRIX_SMS_HANDLER_URL ?? '',
    },
    tlsRejectUnauthorized:
      process.env.BITRIX_TLS_REJECT_UNAUTHORIZED !== 'false',
  },

  // ThinkZap
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
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
    outboundMediaBucket: process.env.R2_OUTBOUND_MEDIA_BUCKET ?? '',
  },
  thinkzapMockZApiProvisioning:
    process.env.THINKZAP_MOCK_ZAPI_PROVISIONING === 'true' ||
    (process.env.NODE_ENV === 'local' &&
      process.env.THINKZAP_MOCK_ZAPI_PROVISIONING !== 'false'),
  thinkzapZApiLidIdentity: process.env.THINKZAP_ZAPI_LID_IDENTITY === 'true',
  thinkzapUnifiedOutboxDomains:
    process.env.THINKZAP_UNIFIED_OUTBOX_DOMAINS ?? '',
  thinkzapCadenceOffFifoPerDestination:
    process.env.THINKZAP_CADENCE_OFF_FIFO_PER_DESTINATION === 'true',

  // GPT Maker
  gptMaker: {
    apiToken: process.env.GPTMAKER_API_TOKEN ?? '',
    workspaceId: process.env.GPTMAKER_WORKSPACE_ID ?? '',
    baseUrl: process.env.GPTMAKER_BASE_URL ?? 'https://api.gptmaker.ai/v2',
  },

  // ImportSheet
  importsheet: {
    pageSize: parsePageSize(process.env.IMPORTSHEET_PAGE_SIZE),
    pageDelayMs: Math.max(
      0,
      Number(process.env.IMPORTSHEET_PAGE_DELAY_MS ?? 500) || 0,
    ),
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

  // Clicksign
  clicksign: {
    robot: {
      code: process.env.CLICKSIGN_ROBOT_CODE ?? 'ENVIAR_DOCUMENTO',
      name: process.env.CLICKSIGN_ROBOT_NAME ?? 'Enviar documento',
    },
  },

  // ERPs
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

  // MCP
  mcpOauth: {
    jwtSecret: process.env.MCP_JWT_SECRET ?? '',
    issuerUrl: process.env.MCP_OAUTH_ISSUER_URL ?? '',
    mcpServerUrl: process.env.MCP_SERVER_URL ?? '',
    accessTokenTtlSeconds: Number(process.env.MCP_ACCESS_TOKEN_TTL ?? 3600),
    refreshTokenTtlSeconds: Number(
      process.env.MCP_REFRESH_TOKEN_TTL ?? 60 * 60 * 24 * 30,
    ),
    authCodeTtlSeconds: Number(process.env.MCP_AUTH_CODE_TTL ?? 60),
  },
} as const
