import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlow } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import { CreateBotFlowController } from './create-bot-flow.controller'

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

// A regra vive no controller e não só na tela: o botão de criar saiu do cabeçalho, mas a
// rota segue aberta, e um segundo fluxo ficaria invisível na interface.
describe('fluxo: uma por instalação', () => {
  it('recusa criar a segunda', async () => {
    const { controller: ctrl, create } = controller({ total: 1 })

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

  it('checa o limite antes do nome', async () => {
    // Com o nome primeiro, quem já tem fluxo e repetisse o nome ouviria "nome já existe"
    // e iria renomear em vez de editar o fluxo que tem.
    const { controller: ctrl, existsName } = controller({
      total: 1,
      nomeExiste: true,
    })

    const result = await ctrl.perform(req({ name: 'Comercial' }), res)

    expect(existsName).not.toHaveBeenCalled()
    expect((result.result as { error: string }).error).toContain(
      'já tem um fluxo',
    )
  })
})
