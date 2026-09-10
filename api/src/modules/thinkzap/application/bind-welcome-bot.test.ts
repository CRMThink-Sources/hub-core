import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { bindWelcomeBot, unbindWelcomeBot } from './bind-welcome-bot'

const LINHA = '224'
const NOSSO_BOT = 2060

type Config = {
  WELCOME_BOT_ENABLE?: string
  WELCOME_BOT_ID?: string | number
  LINE_NAME?: string
}

/**
 * `config.update` responde e `config.get` devolve o estado; o dublê encadeia os dois para
 * o `get` refletir o que o `update` gravou, que é o que as asserções de persistência leem.
 */
function makeClient(estado: Config, opts: { updateFalha?: boolean } = {}) {
  const atual: Config = { ...estado }

  const callMethod = vi.fn(
    (method: string, params: Record<string, unknown>) => {
      if (method === 'imopenlines.config.update') {
        if (!opts.updateFalha) {
          const p = params.PARAMS as Config
          if (p.WELCOME_BOT_ENABLE !== undefined) {
            atual.WELCOME_BOT_ENABLE = p.WELCOME_BOT_ENABLE
          }
          if (p.WELCOME_BOT_ID !== undefined) {
            atual.WELCOME_BOT_ID = p.WELCOME_BOT_ID
          }
        }
        return Promise.resolve({ result: true })
      }

      if (method === 'imopenlines.config.get') {
        return Promise.resolve({ result: { ...atual } })
      }

      return Promise.resolve({ result: true })
    },
  )

  return {
    client: { callMethod } as unknown as BitrixClient,
    callMethod,
    atual,
  }
}

const LIVRE: Config = { WELCOME_BOT_ENABLE: 'N', WELCOME_BOT_ID: '0' }

describe('bindWelcomeBot', () => {
  it('vincula na linha livre', async () => {
    const { client, atual } = makeClient(LIVRE)

    await bindWelcomeBot(client, { lineId: LINHA, bitrixBotId: NOSSO_BOT })

    expect(atual.WELCOME_BOT_ENABLE).toBe('Y')
    expect(Number(atual.WELCOME_BOT_ID)).toBe(NOSSO_BOT)
  })

  it('recusa a linha com bot de outro app, sem gravar nada', async () => {
    // O Bitrix guarda um bot por linha: sobrescrever tiraria o outro app de operação em
    // silêncio, e o unbind não sabe devolvê-lo.
    const { client, callMethod } = makeClient({
      WELCOME_BOT_ENABLE: 'Y',
      WELCOME_BOT_ID: '777',
      LINE_NAME: 'Suporte',
    })

    await expect(
      bindWelcomeBot(client, { lineId: LINHA, bitrixBotId: NOSSO_BOT }),
    ).rejects.toThrow()

    const updates = callMethod.mock.calls.filter(
      ([method]) => method === 'imopenlines.config.update',
    )
    expect(updates).toHaveLength(0)
  })

  it('revincular a mesma linha com o nosso bot é idempotente', async () => {
    // É o caminho de reativar um vínculo desligado: o id na linha é o nosso.
    const { client, atual } = makeClient({
      WELCOME_BOT_ENABLE: 'Y',
      WELCOME_BOT_ID: String(NOSSO_BOT),
    })

    await bindWelcomeBot(client, { lineId: LINHA, bitrixBotId: NOSSO_BOT })

    expect(atual.WELCOME_BOT_ENABLE).toBe('Y')
    expect(Number(atual.WELCOME_BOT_ID)).toBe(NOSSO_BOT)
  })

  it('bot desativado na linha não ocupa a vaga', async () => {
    // `ENABLE: 'N'` com id sobrando é resto de configuração: a linha está livre.
    const { client, atual } = makeClient({
      WELCOME_BOT_ENABLE: 'N',
      WELCOME_BOT_ID: '777',
    })

    await bindWelcomeBot(client, { lineId: LINHA, bitrixBotId: NOSSO_BOT })

    expect(Number(atual.WELCOME_BOT_ID)).toBe(NOSSO_BOT)
  })

  it('update que não persiste é detectado', async () => {
    // `config.update` responde `true` sem garantir gravação; quem prova é o `config.get`.
    const { client } = makeClient(LIVRE, { updateFalha: true })

    await expect(
      bindWelcomeBot(client, { lineId: LINHA, bitrixBotId: NOSSO_BOT }),
    ).rejects.toThrow()
  })
})

describe('unbindWelcomeBot', () => {
  it('zera o id junto com o desligamento', async () => {
    // Quem chama pode desregistrar o bot em seguida: id sobrando na linha apontaria para
    // um bot que não existe mais.
    const { client, atual } = makeClient({
      WELCOME_BOT_ENABLE: 'Y',
      WELCOME_BOT_ID: String(NOSSO_BOT),
    })

    await unbindWelcomeBot(client, { lineId: LINHA })

    expect(atual.WELCOME_BOT_ENABLE).toBe('N')
    expect(Number(atual.WELCOME_BOT_ID)).toBe(0)
  })

  it('desligamento que não persiste sobe', async () => {
    // Quem chama apaga o vínculo depois: bot ativo em linha sem fluxo ficaria mudo.
    const { client } = makeClient(
      { WELCOME_BOT_ENABLE: 'Y', WELCOME_BOT_ID: String(NOSSO_BOT) },
      { updateFalha: true },
    )

    await expect(unbindWelcomeBot(client, { lineId: LINHA })).rejects.toThrow()
  })
})
