import { describe, expect, it } from 'vitest'
import { bitrixBotWebhookFromApiUrl } from './env'

// `API_URL` terminando em `/api` mais o prefixo do default dava
// `/api/api/webhooks/bitrix-bot`. `Bot.register` não atualiza em chamada repetida, então
// o bot fica registrado no endereço errado e não recebe evento nenhum.
describe('bitrixBotWebhookFromApiUrl', () => {
  it('não duplica o prefixo quando API_URL já termina em /api', () => {
    expect(bitrixBotWebhookFromApiUrl('https://x.ngrok-free.dev/api')).toBe(
      'https://x.ngrok-free.dev/api/webhooks/bitrix-bot',
    )
  })

  it('acrescenta /api quando API_URL é a raiz', () => {
    expect(bitrixBotWebhookFromApiUrl('https://api.hubthink.com')).toBe(
      'https://api.hubthink.com/api/webhooks/bitrix-bot',
    )
  })

  it('tolera barra no fim', () => {
    expect(bitrixBotWebhookFromApiUrl('https://x.dev/api/')).toBe(
      'https://x.dev/api/webhooks/bitrix-bot',
    )
    expect(bitrixBotWebhookFromApiUrl('https://x.dev/')).toBe(
      'https://x.dev/api/webhooks/bitrix-bot',
    )
  })

  it('devolve vazio sem API_URL', () => {
    // Vazio é o sinal que `ensureBot` usa para recusar antes de registrar torto.
    expect(bitrixBotWebhookFromApiUrl(undefined)).toBe('')
    expect(bitrixBotWebhookFromApiUrl('')).toBe('')
  })
})
