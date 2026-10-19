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

const conectado = () => Promise.resolve(true)
const semConector = () => Promise.resolve(false)

// Spies à parte por causa do lint `unbound-method`.
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
    removeBot: vi.fn().mockResolvedValue(undefined),
  }
  return { port, ensureBot, bindLine, unbindLine, removeBotIfUnused }
}

describe('vínculo: exige conector ThinkZap ativo', () => {
  it('recusa vincular sem conector e não toca portal nem banco', async () => {
    const bot = welcomeBot()
    const create = vi.fn()

    await expect(
      new CreateBotFlowBindingController(
        { create },
        { getById: vi.fn().mockResolvedValue(publicada) } as never,
        { getByLineId: vi.fn().mockResolvedValue(null) },
        bot.port,
        semConector,
      ).perform(req({ flowId: 'f1', lineId: '9' }), res),
    ).rejects.toMatchObject({ errorCode: 'thinkzap.bot.connector_inactive' })

    expect(bot.ensureBot).not.toHaveBeenCalled()
    expect(bot.bindLine).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('recusa religar vínculo sem conector', async () => {
    const bot = welcomeBot()

    await expect(
      new UpdateBotFlowBindingController(
        { update: vi.fn() },
        { getById: vi.fn().mockResolvedValue(binding({ active: false })) },
        { getByLineId: vi.fn() },
        bot.port,
        semConector,
      ).perform(req({ active: true }, { bindingId: 'b1' }), res),
    ).rejects.toMatchObject({ errorCode: 'thinkzap.bot.connector_inactive' })

    expect(bot.bindLine).not.toHaveBeenCalled()
  })

  // Conector vencido não pode prender o bot no canal.
  it('desligar vínculo segue livre sem conector', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ active: false })) },
      { getById: vi.fn().mockResolvedValue(binding({ active: true })) },
      { getByLineId: vi.fn() },
      bot.port,
      semConector,
    ).perform(req({ active: false }, { bindingId: 'b1' }), res)

    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
  })
})

// A ordem portal/banco decide o que sobra quando um falha.
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
      conectado,
    ).perform(req({ flowId: 'f1', lineId: '9' }), res)

    expect(ordem).toEqual(['ensureBot', 'bindLine', 'create'])
    expect(bot.bindLine).toHaveBeenCalledWith({
      appId: APP,
      lineId: '9',
      bitrixBotId: BOT_ID,
    })
  })

  it('usa o bot do fluxo vinculado, com o nome dele', async () => {
    const bot = welcomeBot()

    await new CreateBotFlowBindingController(
      { create: vi.fn().mockResolvedValue(binding()) },
      {
        getById: vi
          .fn()
          .mockResolvedValue({ ...publicada, id: 'f2', name: 'Suporte' }),
      } as never,
      { getByLineId: vi.fn().mockResolvedValue(null) },
      bot.port,
      conectado,
    ).perform(req({ flowId: 'f2', lineId: '9' }), res)

    expect(bot.ensureBot).toHaveBeenCalledWith(APP, 'f2', 'Suporte')
  })

  it('último vínculo do fluxo removido tenta tirar o bot dele', async () => {
    const bot = welcomeBot()

    await new DeleteBotFlowBindingController(
      { delete: vi.fn().mockResolvedValue(undefined) },
      { getById: vi.fn().mockResolvedValue(binding({ flowId: 'f2' })) },
      bot.port,
    ).perform(req({}, { bindingId: 'b1' }), res)

    expect(bot.removeBotIfUnused).toHaveBeenCalledWith(APP, 'f2')
  })

  it('portal falhou: nada é gravado no banco', async () => {
    // O oposto deixaria vínculo salvo com linha sem bot.
    const create = vi.fn()

    await expect(
      new CreateBotFlowBindingController(
        { create },
        { getById: vi.fn().mockResolvedValue(publicada) } as never,
        { getByLineId: vi.fn().mockResolvedValue(null) },
        welcomeBot({
          bindLine: vi.fn().mockRejectedValue(new Error('não persistiu')),
        }).port,
        conectado,
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
      conectado,
    ).perform(req({ lineId: '9' }, { bindingId: 'b1' }), res)

    expect(bot.unbindLine).toHaveBeenCalledWith({ lineId: '7' })
    expect(bot.bindLine).toHaveBeenCalledWith({
      appId: APP,
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
      conectado,
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
      conectado,
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
      conectado,
    ).perform(req({ active: true }, { bindingId: 'b1' }), res)

    expect(bot.bindLine).toHaveBeenCalledWith({
      appId: APP,
      lineId: '7',
      bitrixBotId: BOT_ID,
    })
  })

  // O painel do Bitrix pode limpar o `WELCOME_BOT_ID` em silêncio; salvar conserta.
  it('salvar vínculo ativo reatrela o portal', async () => {
    const bot = welcomeBot()

    await new UpdateBotFlowBindingController(
      { update: vi.fn().mockResolvedValue(binding({ priority: 50 })) },
      { getById: vi.fn().mockResolvedValue(binding({ active: true })) },
      { getByLineId: vi.fn() },
      bot.port,
      conectado,
    ).perform(req({ priority: 50 }, { bindingId: 'b1' }), res)

    expect(bot.bindLine).toHaveBeenCalledWith({
      appId: APP,
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
      conectado,
    ).perform(req({ priority: 50 }, { bindingId: 'b1' }), res)

    expect(bot.ensureBot).not.toHaveBeenCalled()
    expect(bot.bindLine).not.toHaveBeenCalled()
    expect(bot.unbindLine).not.toHaveBeenCalled()
  })
})
