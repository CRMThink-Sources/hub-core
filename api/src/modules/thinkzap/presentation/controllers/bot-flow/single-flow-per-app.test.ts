import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlow } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import {
  CreateBotFlowController,
  MAX_FLOWS_POR_APP,
} from './create-bot-flow.controller'

const APP = 'app-1'

const req = (body: unknown): Request =>
  ({ thinkzapInstalledAppId: APP, body }) as unknown as Request

const res = {} as Response

function controller(over: { total?: number; nomeExiste?: boolean } = {}) {
  const create = vi.fn().mockResolvedValue({ id: 'f1' } as unknown as BotFlow)
  const existsName = vi.fn().mockResolvedValue(over.nomeExiste ?? false)
  const countByAppId = vi.fn().mockResolvedValue(over.total ?? 0)

  return {
    controller: new CreateBotFlowController(
      { create },
      { existsName },
      { countByAppId },
    ),
    create,
    existsName,
    countByAppId,
  }
}

// A regra vive no controller e não só na tela: a rota segue aberta, e um fluxo além do
// teto passaria por cima do limite contratado.
describe(`fluxo: até ${MAX_FLOWS_POR_APP} por instalação`, () => {
  it('é 5', () => {
    expect(MAX_FLOWS_POR_APP).toBe(5)
  })

  it('recusa criar além do teto', async () => {
    const { controller: ctrl, create } = controller({
      total: MAX_FLOWS_POR_APP,
    })

    const result = await ctrl.perform(req({ name: 'Outra' }), res)

    expect(result.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('permite a primeira', async () => {
    const { controller: ctrl, create } = controller({ total: 0 })

    const result = await ctrl.perform(req({ name: 'Comercial' }), res)

    expect(result.status).toBe(200)
    expect(create).toHaveBeenCalledOnce()
  })

  it('permite a última antes do teto', async () => {
    const { controller: ctrl, create } = controller({
      total: MAX_FLOWS_POR_APP - 1,
    })

    const result = await ctrl.perform(req({ name: 'Suporte' }), res)

    expect(result.status).toBe(200)
    expect(create).toHaveBeenCalledOnce()
  })

  it('checa o limite antes do nome', async () => {
    // Com o nome primeiro, quem está no teto e repetisse o nome ouviria "nome já existe"
    // e iria renomear em vez de editar ou excluir um fluxo.
    const { controller: ctrl, existsName } = controller({
      total: MAX_FLOWS_POR_APP,
      nomeExiste: true,
    })

    const result = await ctrl.perform(req({ name: 'Comercial' }), res)

    expect(existsName).not.toHaveBeenCalled()
    expect((result.result as { error: string }).error).toContain(
      'limite de 5 fluxos',
    )
  })
})
