import { describe, expect, it, vi } from 'vitest'
import { bindBot, unbindBot, type BindBotDeps } from './bind-bot'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { ImbotGateway, PortalBot } from '../infra/bitrix/imbot.gateway'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'
import { DEFAULT_WORKTIME } from '../domain/value-objects/worktime'

const EVENT_HANDLER = 'https://api.exemplo/webhooks/gptmaker'

function scopedWith(botId: number | null): ScopedAgentClient {
  return {
    local: {
      id: 'local-1',
      appId: 'app-1',
      gptMakerAgentId: 'vendor-1',
      botId,
      name: 'Atendente',
      worktime: DEFAULT_WORKTIME,
      exitOnCollaboratorJoin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as unknown as ScopedAgentClient
}

function harness(bots: PortalBot[] = []) {
  const update = vi.fn((id: string, patch: { botId?: number | null }) =>
    Promise.resolve({ ...scopedWith(patch.botId ?? null).local, id }),
  )
  const listApplicationBots = vi.fn().mockResolvedValue(bots)
  const register = vi.fn().mockResolvedValue(42)
  const unregister = vi.fn().mockResolvedValue(undefined)

  const deps: BindBotDeps = {
    agents: { update } as unknown as AgentRepository,
    imbot: {
      listApplicationBots,
      register,
      unregister,
    } as unknown as ImbotGateway,
    eventHandlerUrl: EVENT_HANDLER,
  }

  return { deps, update, listApplicationBots, register, unregister }
}

describe('bindBot', () => {
  it('cria o bot e grava o botId no agente', async () => {
    const h = harness()

    const updated = await bindBot(h.deps, scopedWith(null), 'Atendente')

    expect(h.register).toHaveBeenCalledWith({
      name: 'Atendente',
      eventHandlerUrl: EVENT_HANDLER,
    })
    expect(h.update).toHaveBeenCalledWith('local-1', { botId: 42 })
    expect(updated.botId).toBe(42)
  })

  it('recusa agente que já tem bot', async () => {
    const h = harness()

    await expect(
      bindBot(h.deps, scopedWith(7), 'Atendente'),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.bot.already_bound' })

    expect(h.register).not.toHaveBeenCalled()
  })

  it('recusa quando o portal está no limite', async () => {
    const cheio = Array.from({ length: MAX_AGENTS_PER_APP }, (_, i) => ({
      id: i + 1,
      code: `gptmaker_${i}`,
    }))
    const h = harness(cheio)

    await expect(
      bindBot(h.deps, scopedWith(null), 'Sexto'),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.bot.limit_reached' })

    expect(h.register).not.toHaveBeenCalled()
  })

  it('libera vaga quando o cliente apagou um bot no painel do Bitrix', async () => {
    // O nosso banco pode achar que há 5; o portal é quem responde.
    const h = harness([
      { id: 1, code: 'gptmaker_1' },
      { id: 2, code: 'gptmaker_2' },
    ])

    const updated = await bindBot(h.deps, scopedWith(null), 'Atendente')

    expect(updated.botId).toBe(42)
  })
})

describe('unbindBot', () => {
  it('remove o bot do portal e limpa o vínculo', async () => {
    const h = harness([{ id: 7, code: 'gptmaker_7' }])

    const updated = await unbindBot(h.deps, scopedWith(7))

    expect(h.unregister).toHaveBeenCalledWith(7)
    expect(h.update).toHaveBeenCalledWith('local-1', { botId: null })
    expect(updated.botId).toBeNull()
  })

  it('conclui quando o bot já não existe no portal', async () => {
    const h = harness([])

    const updated = await unbindBot(h.deps, scopedWith(7))

    // O estado desejado já é o corrente. Recusar deixaria o agente preso a um
    // botId que não aponta para nada.
    expect(h.unregister).not.toHaveBeenCalled()
    expect(updated.botId).toBeNull()
  })

  it('não faz nada para agente sem bot', async () => {
    const h = harness()

    await unbindBot(h.deps, scopedWith(null))

    expect(h.unregister).not.toHaveBeenCalled()
    expect(h.update).not.toHaveBeenCalled()
  })
})
