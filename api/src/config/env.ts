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
    widgetUrl:
      process.env.BITRIX_WIDGET_URL ?? 'http://localhost:3002/bitrix/widget',
    imTextAreaUrl:
      process.env.BITRIX_IM_TEXTAREA_URL ??
      'http://localhost:3002/bitrix/im-text-area',
  },
} as const
