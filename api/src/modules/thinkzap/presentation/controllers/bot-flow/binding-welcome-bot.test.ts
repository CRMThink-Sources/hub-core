import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlowBinding } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import {
  CreateBotFlowBindingController,
  DeleteBotFlowBindingController,
  UpdateBotFlowBindingController,
  type WelcomeBotPort,
} from './bot-flow-binding.controllers'

const APP = 'app-1'
const BOT_ID = 7

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

// Spies expostos à parte: `expect(port.bindLine)` desanexaria o método do objeto e o
// lint (`unbound-method`) recusa.
function welcomeBot(over: Partial<WelcomeBotPort> = {}) {
  const ensureBot =
    over.ensureBot ?? vi.fn().mockResolvedValue({ bitrixBotId: BOT_ID })
  const bindLine = over.bindLine ?? vi.fn().mockResolvedValue(undefined)
  const unbindLine = over.unbindLine ?? vi.fn().mockResolvedValue(undefined)
  const removeBotIfUnused =
    over.removeBotIfUnused ?? vi.fn().mockResolvedValue(undefined)

  const port: WelcomeBotPort = {
    ensureBot,
    bindLine,
    unbindLine,
    removeBotIfUnused,
  }
  return { port, ensureBot, bindLine, unbindLine, removeBotIfUnused }
}

// Vincular mexe no portal e no nosso banco: a ordem decide o que sobra quando um dos
// dois falha.
describe('vínculo: efeito no portal', () => {
  it('registra o bot e grava na linha antes de gravar no banco', async () => {
    const ordem: string[] = []
    const bot = welcomeBot({
      ensureBot: vi.fn().mockImplementation(() => {
        ordem.push('ensureBot')
        return Promise.resolve({ bitrixBotId: BOT_ID })
      }),
      bindLine: vi.fn().mockImplementation(() => {
        ordem.push('bindLine')
        return Promise.resolve()
      }),
    })
    const create = vi.fn().mockImplementation(() => {
      ordem.push('create')
      return Promise.resolve(binding({ lineId: '9' }))
    })

    await new CreateBotFlowBindingController(
      { create },
      { getById: vi.fn().mockResolvedValue(publicada) } as never,
      { getByLineId: vi.fn().mockResolvedValue(null) },
      bot.port,
    ).perform(req({ flowId: 'f1', lineId: '9' }), res)

    expect(ordem).toEqual(['ensureBot', 'bindLine', 'create'])
    expect(bot.bindLine).toHaveBeenCalledWith({
      lineId: '9',
      bitrixBotId: BOT_ID,
    })
  })

  it('portal falhou: nada é gravado no banco', async () => {
    // O oposto deixaria vínculo no banco com a linha sem bot: a tela mostraria o fluxo
    // ativo e nenhuma mensagem entraria na linha.
    const create = vi.fn()

    await expect(
      new CreateBotFlowBindingController(
        { create },
        { getById: vi.fn().mockResolvedValue(publicada) } as never,
        { getByLineId: vi.fn().mockResolvedValue(null) },
        welcomeBot({
          bindLine: vi.fn().mockRejectedValue(new Error('não persistiu')),
        }).port,
      ).perform(req({ flowId: 'f1', lineId: '9' }), res),
    ).rejects.toThrow('não persistiu')

    expect(create).not.toHaveBeenCalled()
  })

  it('desvincular desliga na linha antes de apagar o vínculo', async () => {
    const ordem: string[] = []
    const bot = welcomeBot({
      unbindLine: vi.fn().mockImplementation(() => {
        ordem.push('unbindLine')
        return Promise.resolve()
      }),
    })
    const del = vi.fn().mockImplementation(() => {
      ordem.push('delete')
      return Promise.resolve()
    })

    await new DeleteBotFlowBindingController(
      { delete: del },
      { getById: vi.fn().mockResolvedValue(binding({ lineId: '7' })) },
      bot.port,
    ).perform(req({}, { bindingId: 'b1' }), res)

    expect(ordem).toEqual(['unbindLine', 'delete'])
    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
  })

  it('desligar falhou: o vínculo continua no banco', async () => {
    // Vínculo apagado + bot ativo na linha = bot mudo atendendo o cliente.
    const del = vi.fn()

    await expect(
      new DeleteBotFlowBindingController(
        { delete: del },
        { getById: vi.fn().mockResolvedValue(binding()) },
        welcomeBot({
          unbindLine: vi.fn().mockRejectedValue(new Error('boom')),
        }).port,
      ).perform(req({}, { bindingId: 'b1' }), res),
    ).rejects.toThrow('boom')

    expect(del).not.toHaveBeenCalled()
  })

  it('mover de linha: desliga na antiga e liga na nova', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ lineId: '9' })) },
      { getById: vi.fn().mockResolvedValue(binding({ lineId: '7' })) },
      { getByLineId: vi.fn().mockResolvedValue(null) },
      bot.port,
    ).perform(req({ lineId: '9' }, { bindingId: 'b1' }), res)

    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
    expect(bot.bindLine).toHaveBeenCalledWith({
      lineId: '9',
      bitrixBotId: BOT_ID,
    })
  })

  it('mover um vínculo inativo não liga o bot na nova linha', async () => {
    // Ligar aqui poria o bot a atender por um vínculo desligado.
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding()) },
      {
        getById: vi
          .fn()
          .mockResolvedValue(binding({ lineId: '7', active: false })),
      },
      { getByLineId: vi.fn().mockResolvedValue(null) },
      bot.port,
    ).perform(req({ lineId: '9' }, { bindingId: 'b1' }), res)

    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
    expect(bot.bindLine).not.toHaveBeenCalled()
  })

  it('desativar desliga o bot na linha', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ active: false })) },
      { getById: vi.fn().mockResolvedValue(binding({ active: true })) },
      { getByLineId: vi.fn() },
      bot.port,
    ).perform(req({ active: false }, { bindingId: 'b1' }), res)

    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
    expect(bot.bindLine).not.toHaveBeenCalled()
  })

  it('reativar liga de novo', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding()) },
      { getById: vi.fn().mockResolvedValue(binding({ active: false })) },
      { getByLineId: vi.fn() },
      bot.port,
    ).perform(req({ active: true }, { bindingId: 'b1' }), res)

    expect(bot.bindLine).toHaveBeenCalledWith({
      lineId: '7',
      bitrixBotId: BOT_ID,
    })
  })

  /**
   * O `WELCOME_BOT_ID` da linha é editável pelo painel do Bitrix, e mexer na configuração
   * do canal desliga a saudação sem avisar. O vínculo continua `active` aqui, o portal
   * para de convocar o bot e nada aparece em log — só o silêncio.
   *
   * Salvar o vínculo é o gesto de quem quer consertar isso, então reatrela mesmo sem
   * mudança de estado: chamar o portal à toa custa duas chamadas num gesto raro, e não
   * chamar deixava a tela sem como devolver o bot à linha.
   */
  it('salvar vínculo ativo reatrela o portal', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ priority: 50 })) },
      { getById: vi.fn().mockResolvedValue(binding({ active: true })) },
      { getByLineId: vi.fn() },
      bot.port,
    ).perform(req({ priority: 50 }, { bindingId: 'b1' }), res)

    expect(bot.bindLine).toHaveBeenCalledWith({
      lineId: '7',
      bitrixBotId: BOT_ID,
    })
    expect(bot.unbindLine).not.toHaveBeenCalled()
  })

  it('salvar vínculo inativo não toca no portal', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ priority: 50 })) },
      { getById: vi.fn().mockResolvedValue(binding({ active: false })) },
      { getByLineId: vi.fn() },
      bot.port,
    ).perform(req({ priority: 50 }, { bindingId: 'b1' }), res)

    expect(bot.ensureBot).not.toHaveBeenCalled()
    expect(bot.bindLine).not.toHaveBeenCalled()
    expect(bot.unbindLine).not.toHaveBeenCalled()
  })
})
