import 'dotenv/config'

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appUrl: process.env.APP_URL ?? '',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  apiUrl:
    process.env.API_URL && process.env.API_URL !== 'undefined'
      ? process.env.API_URL
      : 'https://homolog-hubthink.crmthink.com.br/api',
  crmthinkWebhookUrl: process.env.CRMTHINK_WEBHOOK_URL ?? '',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  /** Price ID do produto ThinkZap (linhas) — mesmo valor que NEXT_PUBLIC_THINKZAP_PRICE_CONNECTORS no front */
  thinkzapStripePriceId: process.env.THINKZAP_PRICE_CONNECTORS ?? '',
  zApi: {
    partnerToken: process.env.Z_API_PARTNER_TOKEN ?? '',
    clientToken: process.env.Z_API_CLIENT_TOKEN ?? '',
    callbackUrl: process.env.Z_API_CALLBACK_URL ?? '',
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
    bot: {
      code: process.env.BITRIX_BOT_CODE ?? 'thinkzap_bot',
      name: process.env.BITRIX_BOT_NAME ?? 'ThinkZap Bot',
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
  },
  appCodes: {
    thinkzap: process.env.THINKZAP_APP_CODE ?? 'crmthink.thinkzap',
    thinkanalise: process.env.THINKANALISE_APP_CODE ?? 'crmthink.thinkanalise',
  },
  thinkzapMockZApiProvisioning:
    process.env.THINKZAP_MOCK_ZAPI_PROVISIONING === 'true' ||
    (process.env.NODE_ENV === 'local' &&
      process.env.THINKZAP_MOCK_ZAPI_PROVISIONING !== 'false'),
} as const
