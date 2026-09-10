import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BotFlowBinding } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import { PublishBotFlowController } from './publish-bot-flow.controller'
import type { WelcomeBotPort } from './bot-flow-binding.controllers'

const APP = 'app-1'

const req = (): Request =>
  ({
    thinkzapInstalledAppId: APP,
    params: { flowId: 'f1' },
  }) as unknown as Request

const res = {} as Response

/** Grafo publicável: uma mensagem que termina. */
const graph = {
  entryNodeId: 'n1',
  settings: { escapeKeywords: [], escapeNext: null },
  nodes: [
    { id: 'n1', kind: 'message', text: 'Olá', next: 'n2' },
    { id: 'n2', kind: 'finish' },
  ],
}

const binding = (): BotFlowBinding => ({
  id: 'b1',
  appId: APP,
  flowId: 'f1',
  lineId: '224',
  priority: 100,
  active: true,
  condition: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})

function setup(
  over: { vinculos?: BotFlowBinding[]; ensureBot?: unknown } = {},
) {
  const ensureBot =
    over.ensureBot ?? vi.fn().mockResolvedValue({ bitrixBotId: 7 })

  const welcomeBot = {
    ensureBot,
    bindLine: vi.fn(),
    unbindLine: vi.fn(),
    removeBotIfUnused: vi.fn(),
  } as unknown as WelcomeBotPort

  const controller = new PublishBotFlowController(
    { publish: vi.fn().mockResolvedValue({ id: 'f1', name: 'Comercial' }) },
    {
      getById: vi
        .fn()
        .mockResolvedValue({ id: 'f1', name: 'Comercial', graph }),
    } as never,
    welcomeBot,
    { listByAppId: vi.fn().mockResolvedValue(over.vinculos ?? [binding()]) },
  )

  return { controller, ensureBot: ensureBot as ReturnType<typeof vi.fn> }
}

describe('publicar renomeia o bot no portal', () => {
  it('leva o nome do fluxo quando há canal vinculado', async () => {
    const { controller, ensureBot } = setup()

    const out = await controller.perform(req(), res)

    expect(out.status).toBe(200)
    expect(ensureBot).toHaveBeenCalledWith(APP, 'Comercial')
  })

  it('sem vínculo não registra bot nenhum', async () => {
    // Criar um bot só para renomear poria no portal do cliente um bot sem nada a atender.
    const { controller, ensureBot } = setup({ vinculos: [] })

    const out = await controller.perform(req(), res)

    expect(out.status).toBe(200)
    expect(ensureBot).not.toHaveBeenCalled()
  })

  it('portal fora não derruba a publicação', async () => {
    // O fluxo foi publicado; recusar a resposta faria o usuário republicar atrás de um
    // erro que é só cosmético no portal.
    const { controller } = setup({
      ensureBot: vi.fn().mockRejectedValue(new Error('portal fora')),
    })

    const out = await controller.perform(req(), res)

    expect(out.status).toBe(200)
  })
})
