export const CLICKSIGN_APP_CODE_ID = 'crmthink.clicksign'

// Handlers em rota pública (sem authMiddleware); relativos a `env.apiUrl`.
export const CLICKSIGN_ROBOT_HANDLER_PATH = '/clicksign/bitrix/enviar-documento'
export const CLICKSIGN_CANCEL_HANDLER_PATH =
  '/clicksign/bitrix/cancelar-documento'

export const CLICKSIGN_HOSTS = {
  prod: 'https://app.clicksign.com',
  sandbox: 'https://sandbox.clicksign.com',
} as const

export const CLICKSIGN_VND_JSON = 'application/vnd.api+json'

export const CLICKSIGN_HMAC_HEADER = 'content-hmac'

export const CLICKSIGN_WEBHOOK_EVENTS = [
  'sign',
  'document_closed',
  'refusal',
  'cancel',
  'deadline',
] as const
