import { afterEach, describe, expect, it, vi } from 'vitest'

const VAR = 'NEXT_PUBLIC_THINKZAP_ENABLED_PROVIDERS'
const original = process.env[VAR]

/**
 * Recarrega o módulo com a env aplicada.
 *
 * `envConfig` lê `process.env` na carga — é o que permite ao Next inlinar o
 * valor no build. Trocar a lista entre casos exige, então, remontar os dois
 * módulos, e não só mexer no `process.env`.
 */
async function withEnv(raw: string | undefined) {
  vi.resetModules()

  if (raw === undefined) delete process.env[VAR]
  else process.env[VAR] = raw

  return import('./provider-availability')
}

afterEach(() => {
  if (original === undefined) delete process.env[VAR]
  else process.env[VAR] = original
})

describe('isProviderUnavailable', () => {
  it('libera os dois conectores quando o ambiente lista os dois', async () => {
    const { isProviderUnavailable } = await withEnv('ZAPI,HUBMESSAGE')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(false)
  })

  it('bloqueia o oficial quando o ambiente lista só o Z-API', async () => {
    const { isProviderUnavailable } = await withEnv('ZAPI')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(true)
  })

  it('tolera espaço e caixa trocada', async () => {
    const { isProviderUnavailable } = await withEnv(' zapi , HubMessage ')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(false)
  })

  it('ignora nome desconhecido e mantém o resto da lista', async () => {
    const { isProviderUnavailable } = await withEnv('ZAPI,TWILIO,HUBMESSAGE')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(false)
  })

  it('cai no padrão conservador quando a variável não existe', async () => {
    const { isProviderUnavailable } = await withEnv(undefined)

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(true)
  })

  it('cai no padrão conservador quando a variável só tem separadores', async () => {
    const { isProviderUnavailable } = await withEnv(' , , ')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(true)
  })

  it('cai no padrão conservador quando nenhum nome é reconhecido', async () => {
    // Lista inteira inválida não pode virar "nada liberado": a tela ficaria sem
    // conector nenhum por causa de um typo na configuração.
    const { isProviderUnavailable } = await withEnv('TWILIO,GUPSHUP')

    expect(isProviderUnavailable('ZAPI')).toBe(false)
    expect(isProviderUnavailable('HUBMESSAGE')).toBe(true)
  })
})
