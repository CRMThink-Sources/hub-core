import { describe, expect, it, vi } from 'vitest'
import { bindBot, unbindBot, type BindBotDeps } from './bind-bot'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { ImbotGateway, PortalBot } from '../infra/bitrix/imbot.gateway'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'
import { DEFAULT_WORKTIME } from '../domain/value-objects/worktime'

const bot = (id: number): PortalBot => ({
  id,
  code: `gptmaker_${id}`,
  name: `Bot ${id}`,
})

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

function harness(
  bots: PortalBot[] = [],
  overrides: { findOwnedByBotId?: ReturnType<typeof vi.fn> } = {},
) {
  const update = vi.fn((id: string, patch: { botId?: number | null }) =>
    Promise.resolve({ ...scopedWith(patch.botId ?? null).local, id }),
  )
  const findOwnedByBotId =
    overrides.findOwnedByBotId ?? vi.fn().mockResolvedValue(null)
  const listApplicationBots = vi.fn().mockResolvedValue(bots)
  const unregister = vi.fn().mockResolvedValue(undefined)

  const deps: BindBotDeps = {
    agents: { update, findOwnedByBotId } as unknown as AgentRepository,
    imbot: { listApplicationBots, unregister } as unknown as ImbotGateway,
  }

  return { deps, update, findOwnedByBotId, listApplicationBots, unregister }
}

describe('bindBot', () => {
  it('grava o botId do bot escolhido', async () => {
    const h = harness([bot(7)])

    const updated = await bindBot(h.deps, scopedWith(null), 7)

    expect(h.update).toHaveBeenCalledWith('local-1', { botId: 7 })
    expect(updated.botId).toBe(7)
  })

  it('recusa agente que já tem bot', async () => {
    const h = harness([bot(7)])

    await expect(bindBot(h.deps, scopedWith(9), 7)).rejects.toMatchObject({
      errorCode: 'gptmaker.bot.already_bound',
    })

    expect(h.update).not.toHaveBeenCalled()
  })

  it('recusa bot que não é desta aplicação no portal', async () => {
    // Um BOT_ID arbitrário pode ser de outra aplicação instalada no mesmo
    // portal — a lista filtrada pelo prefixo do code é o que barra isso.
    const h = harness([bot(7)])

    await expect(bindBot(h.deps, scopedWith(null), 999)).rejects.toMatchObject({
      errorCode: 'gptmaker.bot.not_found',
    })

    expect(h.update).not.toHaveBeenCalled()
  })

  it('recusa bot já vinculado a outro agente', async () => {
    const h = harness([bot(7)], {
      findOwnedByBotId: vi
        .fn()
        .mockResolvedValue({ id: 'local-2', gptMakerAgentId: 'vendor-2' }),
    })

    await expect(bindBot(h.deps, scopedWith(null), 7)).rejects.toMatchObject({
      errorCode: 'gptmaker.bot.in_use',
    })

    expect(h.update).not.toHaveBeenCalled()
  })
})

describe('unbindBot', () => {
  it('limpa o vínculo e preserva o bot no portal', async () => {
    const h = harness([bot(7)])

    const updated = await unbindBot(h.deps, scopedWith(7))

    // Desvincular troca quem responde; destruir o canal é ação da tela de bots.
    expect(h.unregister).not.toHaveBeenCalled()
    expect(h.update).toHaveBeenCalledWith('local-1', { botId: null })
    expect(updated.botId).toBeNull()
  })

  it('não faz nada para agente sem bot', async () => {
    const h = harness()

    await unbindBot(h.deps, scopedWith(null))

    expect(h.update).not.toHaveBeenCalled()
  })
})
