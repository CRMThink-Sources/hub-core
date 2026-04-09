import 'dotenv/config'

export const env = {
  appUrl: process.env.APP_URL ?? '',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  apiUrl: process.env.API_URL ?? '',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  zApi: {
    partnerToken: process.env.Z_API_PARTNER_TOKEN ?? '',
    clientToken: process.env.Z_API_CLIENT_TOKEN ?? '',
    callbackUrl: process.env.Z_API_CALLBACK_URL ?? '',
  },
  bitrix: {
    webhookUrl:
      process.env.BITRIX_WEBHOOK_URL ??
      (process.env.API_URL ? `${process.env.API_URL}/api/webhooks/bitrix` : ''),
    connector: {
      url: process.env.BITRIX_CONNECTOR_URL ?? '',
    },
    widgetUrl:
      process.env.BITRIX_WIDGET_URL ??
      'http://localhost:3002/bitrix/widget/audio',
    chatIframeHash:
      process.env.BITRIX_CHAT_IFRAME_HASH ?? 'd1ab17949a572b0979d8db0d5b349cd2',
    chatIframeContext: process.env.BITRIX_CHAT_IFRAME_CONTEXT ?? 'LINES',
    chatIframeLivechatSupport:
      process.env.BITRIX_CHAT_IFRAME_LIVECHAT ??
      ((process.env.BITRIX_CHAT_IFRAME_CONTEXT ?? 'LINES').startsWith('LINES')
        ? 'Y'
        : 'N'),
    chatIframeCode:
      process.env.BITRIX_CHAT_IFRAME_CODE ?? 'thinkzap_chat_iframe',
    chatIframeAppId: Number(process.env.BITRIX_CHAT_IFRAME_APP_ID ?? 0),
    chatIframeHidden: process.env.BITRIX_CHAT_IFRAME_HIDDEN ?? 'N',
    chatBotCode: process.env.BITRIX_CHAT_BOT_CODE ?? 'thinkzap_chat_bot',
    chatBotName: process.env.BITRIX_CHAT_BOT_NAME ?? 'ThinkersZap Bot',
    chatBotWorkPosition:
      process.env.BITRIX_CHAT_BOT_WORK_POSITION ?? 'Automacao ThinkersZap',
    chatBotType: process.env.BITRIX_CHAT_BOT_TYPE ?? 'O',
    chatBotOpenline: process.env.BITRIX_CHAT_BOT_OPENLINE ?? 'Y',
  },
  appCodes: {
    thinkzap: process.env.THINKZAP_APP_CODE ?? 'crmthink.thinkzap',
    thinkanalise: process.env.THINKANALISE_APP_CODE ?? 'crmthink.thinkanalise',
  },
} as const
