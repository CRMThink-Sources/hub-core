import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { missingBotScopes } from './check-bot-scopes'

function makeClient(callMethod: ReturnType<typeof vi.fn>) {
  return { callMethod } as unknown as BitrixClient
}

describe('missingBotScopes', () => {
  it('app completo não tem escopo faltando', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue(['crm', 'im', 'imbot', 'imopenlines']),
    )

    expect(await missingBotScopes(client)).toEqual([])
  })

  it('nomeia o escopo ausente', async () => {
    // `imbot` faltando é a causa mais comum de falha na publicação.
    const client = makeClient(
      vi.fn().mockResolvedValue(['crm', 'im', 'imopenlines']),
    )

    expect(await missingBotScopes(client)).toEqual(['imbot'])
  })

  it('nomeia os dois quando faltam os dois', async () => {
    const client = makeClient(vi.fn().mockResolvedValue(['crm', 'im']))

    expect(await missingBotScopes(client)).toEqual(['imbot', 'imopenlines'])
  })

  it('pergunta pelos escopos do app, não pelos do portal', async () => {
    // `full: true` devolveria todos os escopos que o portal conhece, e a checagem passaria
    // sempre — inclusive num app sem permissão nenhuma.
    const callMethod = vi.fn().mockResolvedValue(['imbot', 'imopenlines'])

    await missingBotScopes(makeClient(callMethod))

    expect(callMethod).toHaveBeenCalledWith('scope', {})
    expect(callMethod.mock.calls[0]?.[1]).not.toHaveProperty('full')
  })

  it('aceita a resposta embrulhada em `result`', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({ result: ['imbot', 'imopenlines'] }),
    )

    expect(await missingBotScopes(client)).toEqual([])
  })

  it('normaliza caixa e espaço', async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue([' IMBOT ', 'ImOpenLines']),
    )

    expect(await missingBotScopes(client)).toEqual([])
  })

  it('consulta que falha não bloqueia a publicação', async () => {
    // Diagnóstico, não porteiro: quem chama segue e tenta registrar, e o erro do registro
    // diz mais que um erro sobre a checagem.
    const client = makeClient(vi.fn().mockRejectedValue(new Error('boom')))

    expect(await missingBotScopes(client)).toEqual([])
  })

  it('resposta ilegível não vira "falta tudo"', async () => {
    // Errar para mais bloquearia quem está com o portal certo por mudança de formato do
    // Bitrix.
    for (const resposta of [null, undefined, {}, [], 'imbot', [1, 2]]) {
      const client = makeClient(vi.fn().mockResolvedValue(resposta))
      expect(await missingBotScopes(client)).toEqual([])
    }
  })
})
