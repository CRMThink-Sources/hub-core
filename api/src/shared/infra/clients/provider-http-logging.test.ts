import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test' },
}))

import { redactProviderUrl } from './provider-http-logging'

/**
 * O token da Z-API viaja **no caminho da URL**. Logar a URL crua publicaria credencial
 * de cliente no Loki, onde ela ficaria pelo tempo de retenção e em qualquer backup.
 *
 * Estes testes existem para que uma mudança no regex não deixe isso passar em silêncio.
 */
describe('redactProviderUrl', () => {
  it('mascara o token da Z-API preservando instância e operação', () => {
    const url =
      'https://api.z-api.io/instances/3D1A2B/token/F8e2K9segredo/send-text'

    const result = redactProviderUrl(url)

    expect(result).toBe(
      'https://api.z-api.io/instances/3D1A2B/token/***/send-text',
    )
  })

  it.each([
    'https://api.z-api.io/instances/ABC/token/SEGREDO/send-image',
    'https://api.z-api.io/instances/ABC/token/SEGREDO/me',
    'https://api.z-api.io/instances/ABC/token/SEGREDO/integrator/on-demand/cancel',
  ])('não deixa o segredo escapar em %s', url => {
    expect(redactProviderUrl(url)).not.toContain('SEGREDO')
  })

  /** O `instanceId` identifica a linha e não é credencial — precisa sobreviver. */
  it('preserva o instanceId, que é o que identifica a linha', () => {
    const result = redactProviderUrl(
      'https://api.z-api.io/instances/3D1A2B/token/SEGREDO/status',
    )

    expect(result).toContain('3D1A2B')
    expect(result).toContain('/status')
  })

  it('não altera URL sem token no caminho (HubMessage)', () => {
    const url = 'https://api.hubmessage.io/v1/channels/C-9/messages'

    expect(redactProviderUrl(url)).toBe(url)
  })

  it.each([undefined, ''])('trata %s sem quebrar', value => {
    expect(redactProviderUrl(value)).toBe('')
  })

  it('mascara mesmo com variação de caixa no segmento', () => {
    expect(
      redactProviderUrl('https://api.z-api.io/instances/ABC/TOKEN/SEGREDO/me'),
    ).not.toContain('SEGREDO')
  })
})
