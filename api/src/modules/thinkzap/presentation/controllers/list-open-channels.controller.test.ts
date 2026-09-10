import { describe, expect, it } from 'vitest'
import type { Request, Response } from 'express'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ListOpenChannelsController } from './list-open-channels.controller'

type Channel = { id: string; name: string; active: boolean }

async function listar(result: unknown): Promise<Channel[]> {
  const bitrix = {
    getOpenChannels: () => Promise.resolve({ result }),
  } as unknown as BitrixClient

  const response = await new ListOpenChannelsController(bitrix).perform(
    {} as Request,
    {} as Response,
  )

  return (response.result as { channels: Channel[] }).channels
}

describe('ListOpenChannelsController', () => {
  it('achata resposta em objeto indexado por id', async () => {
    /**
     * `.map` direto sobre `result` estourava `is not a function` nesta forma — a lista
     * chegava ao cliente como 500. É o caminho que o ThinkBot passou a usar no lugar do
     * `BX24.callMethod`, então a falha apagaria o seletor de canais inteiro.
     */
    const canais = await listar({
      '7': { ID: '7', LINE_NAME: 'Suporte', ACTIVE: 'Y' },
    })

    expect(canais).toEqual([{ id: '7', name: 'Suporte', active: true }])
  })

  it('trata ACTIVE ausente como ativo', async () => {
    /**
     * `config.list.get` não devolve `ACTIVE` em toda versão de portal, e o antigo
     * `=== 'Y'` marcava todos como inativos — o front filtra por este campo, então a
     * lista chegava cheia e era exibida vazia.
     */
    const canais = await listar([
      { ID: '1', LINE_NAME: 'Sem flag' },
      { ID: '2', LINE_NAME: 'Desligado', ACTIVE: 'N' },
    ])

    expect(canais.map(c => c.active)).toEqual([true, false])
  })
})
