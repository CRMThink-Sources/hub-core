import { describe, expect, it, vi } from 'vitest'
import { createBot, deleteBot, listBots, type BotsDeps } from './bots'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { ImbotGateway, PortalBot } from '../infra/bitrix/imbot.gateway'

const APP_ID = 'app-1'
const EVENT_HANDLER = 'https://api.exemplo/webhooks/gptmaker'

const bot = (id: number): PortalBot => ({
  id,
  code: `gptmaker_${id}`,
  name: `Bot ${id}`,
})

const agent = (gptMakerAgentId: string, botId: number | null) => ({
  id: `local-${gptMakerAgentId}`,
  appId: APP_ID,
  gptMakerAgentId,
  botId,
  name: `Agente ${gptMakerAgentId}`,
})

function harness(
  overrides: {
    bots?: PortalBot[]
    agents?: ReturnType<typeof agent>[]
    findOwnedByBotId?: ReturnType<typeof vi.fn>
  } = {},
) {
  const listApplicationBots = vi.fn().mockResolvedValue(overrides.bots ?? [])
  const register = vi.fn().mockResolvedValue(42)
  const unregister = vi.fn().mockResolvedValue(undefined)
  const listByApp = vi.fn().mockResolvedValue(overrides.agents ?? [])
  const findOwnedByBotId =
    overrides.findOwnedByBotId ?? vi.fn().mockResolvedValue(null)

  const deps: BotsDeps = {
    agents: { listByApp, findOwnedByBotId } as unknown as AgentRepository,
    imbot: {
      listApplicationBots,
      register,
      unregister,
    } as unknown as ImbotGateway,
    eventHandlerUrl: EVENT_HANDLER,
  }

  return { deps, listApplicationBots, register, unregister, listByApp }
}

describe('listBots', () => {
  it('marca o agente que usa cada bot', async () => {
    const h = harness({
      bots: [bot(7), bot(8)],
      agents: [agent('vendor-1', 7), agent('vendor-2', null)],
    })

    const bots = await listBots(h.deps, APP_ID)

    expect(bots).toEqual([
      {
        ...bot(7),
        boundToAgentId: 'vendor-1',
        boundToAgentName: 'Agente vendor-1',
      },
      { ...bot(8), boundToAgentId: null, boundToAgentName: null },
    ])
  })

  it('lista o que existe no portal, mesmo sem agente nenhum', async () => {
    // A lista sai do portal: um bot criado e ainda não vinculado precisa
    // aparecer, senão não há como escolhê-lo depois.
    const h = harness({ bots: [bot(7)], agents: [] })

    expect(await listBots(h.deps, APP_ID)).toHaveLength(1)
  })
})

describe('createBot', () => {
  it('registra no portal sem vincular a agente', async () => {
    const h = harness()

    const created = await createBot(h.deps, 'Atendimento')

    expect(h.register).toHaveBeenCalledWith({
      name: 'Atendimento',
      eventHandlerUrl: EVENT_HANDLER,
    })
    expect(created.id).toBe(42)
  })

  it('recusa quando o portal está no teto', async () => {
    const cheio = Array.from({ length: MAX_AGENTS_PER_APP }, (_, i) =>
      bot(i + 1),
    )
    const h = harness({ bots: cheio })

    await expect(createBot(h.deps, 'Sexto')).rejects.toMatchObject({
      errorCode: 'gptmaker.bot.limit_reached',
    })

    expect(h.register).not.toHaveBeenCalled()
  })

  it('libera vaga quando o cliente apagou um bot no painel do Bitrix', async () => {
    // O nosso banco pode achar que há 5; o portal é quem responde.
    const h = harness({ bots: [bot(1), bot(2)] })

    expect((await createBot(h.deps, 'Terceiro')).id).toBe(42)
  })
})

describe('deleteBot', () => {
  it('remove o bot livre do portal', async () => {
    const h = harness({ bots: [bot(7)] })

    await deleteBot(h.deps, APP_ID, 7)

    expect(h.unregister).toHaveBeenCalledWith(7)
  })

  it('recusa bot ainda vinculado a um agente', async () => {
    const h = harness({
      bots: [bot(7)],
      findOwnedByBotId: vi.fn().mockResolvedValue(agent('vendor-1', 7)),
    })

    await expect(deleteBot(h.deps, APP_ID, 7)).rejects.toMatchObject({
      errorCode: 'gptmaker.bot.in_use',
    })

    expect(h.unregister).not.toHaveBeenCalled()
  })

  it('conclui quando o bot já não existe no portal', async () => {
    const h = harness({ bots: [] })

    await deleteBot(h.deps, APP_ID, 7)

    expect(h.unregister).not.toHaveBeenCalled()
  })
})
