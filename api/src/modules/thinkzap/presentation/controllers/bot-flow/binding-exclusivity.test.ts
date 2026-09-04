import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlowBinding } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import {
  CreateBotFlowBindingController,
  UpdateBotFlowBindingController,
  type WelcomeBotPort,
} from './bot-flow-binding.controllers'

const welcomeBotFake = (): WelcomeBotPort => ({
  ensureBot: vi.fn().mockResolvedValue({ bitrixBotId: 7 }),
  bindLine: vi.fn().mockResolvedValue(undefined),
  unbindLine: vi.fn().mockResolvedValue(undefined),
  removeBotIfUnused: vi.fn().mockResolvedValue(undefined),
})

const APP = 'app-1'

const binding = (over: Partial<BotFlowBinding> = {}): BotFlowBinding => ({
  id: 'b1',
  appId: APP,
  flowId: 'f1',
  lineId: '7',
  priority: 100,
  active: true,
  condition: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

const req = (body: unknown, params: unknown = {}): Request =>
  ({ thinkzapInstalledAppId: APP, body, params }) as unknown as Request

const res = {} as Response

const publicada = { id: 'f1', status: 'PUBLISHED' as const }

// O Bitrix guarda um `WELCOME_BOT_ID` por linha, então o segundo vínculo na mesma linha
// sobrescreveria o primeiro em silêncio. A recusa tem que vir antes da `@@unique`, senão
// a tela recebe erro de constraint do MySQL.
describe('vínculo: um fluxo por canal', () => {
  it('recusa vincular numa linha já ocupada', async () => {
    const create = vi.fn()
    const controller = new CreateBotFlowBindingController(
      { create },
      { getById: vi.fn().mockResolvedValue(publicada) } as never,
      { getByLineId: vi.fn().mockResolvedValue(binding()) },
      welcomeBotFake(),
    )

    const result = await controller.perform(
      req({ flowId: 'f2', lineId: '7' }),
      res,
    )

    expect(result.status).toBe(400)
    expect(JSON.stringify(result.result)).toContain('já tem um fluxo')
    expect(create).not.toHaveBeenCalled()
  })

  it('aceita numa linha livre', async () => {
    const create = vi.fn().mockResolvedValue(binding({ lineId: '9' }))
    const controller = new CreateBotFlowBindingController(
      { create },
      { getById: vi.fn().mockResolvedValue(publicada) } as never,
      { getByLineId: vi.fn().mockResolvedValue(null) },
      welcomeBotFake(),
    )

    const result = await controller.perform(
      req({ flowId: 'f1', lineId: '9' }),
      res,
    )

    expect(result.status).toBe(200)
    expect(create).toHaveBeenCalledOnce()
  })

  it('rascunho é recusado antes de olhar a linha', async () => {
    const getByLineId = vi.fn()
    const controller = new CreateBotFlowBindingController(
      { create: vi.fn() },
      {
        getById: vi.fn().mockResolvedValue({ id: 'f1', status: 'DRAFT' }),
      } as never,
      { getByLineId },
      welcomeBotFake(),
    )

    const result = await controller.perform(
      req({ flowId: 'f1', lineId: '9' }),
      res,
    )

    expect(result.status).toBe(400)
    expect(getByLineId).not.toHaveBeenCalled()
  })

  it('mover para linha ocupada é recusado', async () => {
    const update = vi.fn()
    const controller = new UpdateBotFlowBindingController(
      { update },
      { getById: vi.fn().mockResolvedValue(binding({ lineId: '7' })) },
      { getByLineId: vi.fn().mockResolvedValue(binding({ id: 'b2' })) },
      welcomeBotFake(),
    )

    const result = await controller.perform(
      req({ lineId: '9' }, { bindingId: 'b1' }),
      res,
    )

    expect(result.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('repetir a própria linha no corpo não é conflito', async () => {
    const update = vi.fn().mockResolvedValue(binding())
    const getByLineId = vi.fn()
    const controller = new UpdateBotFlowBindingController(
      { update },
      { getById: vi.fn().mockResolvedValue(binding({ lineId: '7' })) },
      { getByLineId },
      welcomeBotFake(),
    )

    const result = await controller.perform(
      req({ lineId: '7', active: false }, { bindingId: 'b1' }),
      res,
    )

    expect(result.status).toBe(200)
    // Não consulta: o vínculo encontrado seria ele mesmo.
    expect(getByLineId).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
  })

  it('mudar só a prioridade não consulta linha', async () => {
    const getByLineId = vi.fn()
    const controller = new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding()) },
      { getById: vi.fn().mockResolvedValue(binding()) },
      { getByLineId },
      welcomeBotFake(),
    )

    await controller.perform(req({ active: true }, { bindingId: 'b1' }), res)

    expect(getByLineId).not.toHaveBeenCalled()
  })
})
