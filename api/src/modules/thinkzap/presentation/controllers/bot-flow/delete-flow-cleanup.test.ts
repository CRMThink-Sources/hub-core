import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlowBindingWithFlow } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { WelcomeBotPort } from './bot-flow-binding.controllers'
import { DeleteBotFlowController } from './delete-bot-flow.controller'

const APP = 'app-1'
const FLOW = 'f1'

const binding = (
  over: Partial<BotFlowBindingWithFlow> = {},
): BotFlowBindingWithFlow => ({
  id: 'b1',
  appId: APP,
  flowId: FLOW,
  flowName: 'Comercial',
  flowStatus: 'PUBLISHED',
  lineId: '7',
  priority: 100,
  active: true,
  condition: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

const req = (): Request =>
  ({
    thinkzapInstalledAppId: APP,
    params: { flowId: FLOW },
    body: {},
  }) as unknown as Request

const res = {} as Response

function welcomeBot(over: Partial<WelcomeBotPort> = {}) {
  const unbindLine = over.unbindLine ?? vi.fn().mockResolvedValue(undefined)
  const removeBotIfUnused =
    over.removeBotIfUnused ?? vi.fn().mockResolvedValue(undefined)

  const port: WelcomeBotPort = {
    ensureBot: vi.fn().mockResolvedValue({ bitrixBotId: 7 }),
    bindLine: vi.fn().mockResolvedValue(undefined),
    unbindLine,
    removeBotIfUnused,
  }
  return { port, unbindLine, removeBotIfUnused }
}

function controller(opts: {
  bindings: BotFlowBindingWithFlow[]
  bot: WelcomeBotPort
  del?: (appId: string, flowId: string) => Promise<void>
}) {
  return new DeleteBotFlowController(
    { delete: opts.del ?? (() => Promise.resolve()) },
    { getById: vi.fn().mockResolvedValue({ id: FLOW, status: 'PUBLISHED' }) },
    { listByAppId: vi.fn().mockResolvedValue(opts.bindings) },
    opts.bot,
  )
}

// O `onDelete: Cascade` apaga o vínculo em silêncio, mas o `WELCOME_BOT_ID` fica no
// canal apontando nosso bot: sem fluxo para rodar, ele atende mudo.
describe('excluir fluxo limpa o Bitrix', () => {
  it('vínculo ativo continua bloqueando a exclusão', async () => {
    const bot = welcomeBot()
    const del = vi.fn()

    const result = await controller({
      bindings: [binding({ active: true })],
      bot: bot.port,
      del,
    }).perform(req(), res)

    expect(result.status).toBe(409)
    expect(del).not.toHaveBeenCalled()
    expect(bot.unbindLine).not.toHaveBeenCalled()
  })

  it('vínculo inativo é desligado na linha antes de apagar', async () => {
    // A checagem só olhava `active`: vínculo inativo passava e ninguém desligava o
    // `WELCOME_BOT_ID` do canal.
    const bot = welcomeBot()
    const ordem: string[] = []

    const del = vi.fn().mockImplementation(() => {
      ordem.push('delete')
      return Promise.resolve()
    })
    const unbind = vi.fn().mockImplementation(() => {
      ordem.push('unbind')
      return Promise.resolve()
    })

    const comSpy = welcomeBot({ unbindLine: unbind })

    await controller({
      bindings: [binding({ active: false, lineId: '9' })],
      bot: comSpy.port,
      del,
    }).perform(req(), res)

    expect(unbind).toHaveBeenCalledWith({ lineId: '9' })
    expect(ordem).toEqual(['unbind', 'delete'])
    void bot
  })

  it('desliga todas as linhas do fluxo, não só a primeira', async () => {
    const bot = welcomeBot()

    await controller({
      bindings: [
        binding({ id: 'b1', active: false, lineId: '7' }),
        binding({ id: 'b2', active: false, lineId: '9' }),
        // De outro fluxo: não é para tocar.
        binding({ id: 'b3', active: false, lineId: '11', flowId: 'outra' }),
      ],
      bot: bot.port,
    }).perform(req(), res)

    expect(bot.unbindLine).toHaveBeenCalledTimes(2)
    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '9' })
    expect(bot.unbindLine).not.toHaveBeenCalledWith({ lineId: '11' })
  })

  it('falha ao desligar não apaga o fluxo', async () => {
    // Fluxo apagado + bot na linha = bot mudo. Nesta ordem dá para repetir.
    const del = vi.fn()
    const bot = welcomeBot({
      unbindLine: vi.fn().mockRejectedValue(new Error('boom')),
    })

    await expect(
      controller({
        bindings: [binding({ active: false })],
        bot: bot.port,
        del,
      }).perform(req(), res),
    ).rejects.toThrow('boom')

    expect(del).not.toHaveBeenCalled()
  })

  it('tenta remover o bot do portal depois de apagar', async () => {
    const bot = welcomeBot()

    await controller({ bindings: [], bot: bot.port }).perform(req(), res)

    expect(bot.removeBotIfUnused).toHaveBeenCalledWith(APP)
  })

  it('fluxo sem vínculo nenhum apaga direto', async () => {
    const bot = welcomeBot()
    const del = vi.fn().mockResolvedValue(undefined)

    const result = await controller({
      bindings: [],
      bot: bot.port,
      del,
    }).perform(req(), res)

    expect(result.status).toBe(200)
    expect(bot.unbindLine).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledOnce()
  })
})
