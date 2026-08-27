import { describe, expect, it, vi } from 'vitest'
import type { Logger } from 'pino'
import { listAgents } from './list-agents'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'
import { DEFAULT_WORKTIME } from '../domain/value-objects/worktime'
import type { VendorAgent } from '../domain/entities/agent'

const APP_ID = 'app-1'

function linha(gptMakerAgentId: string, name: string) {
  return {
    id: `local-${gptMakerAgentId}`,
    appId: APP_ID,
    gptMakerAgentId,
    botId: null,
    name,
    worktime: DEFAULT_WORKTIME,
    exitOnCollaboratorJoin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Um cliente escopado cujo `fetch` devolve (ou falha com) o que se pedir. */
function scopedReturning(
  fetch: () => Promise<VendorAgent | null>,
): ScopedAgentClient {
  return { fetch } as unknown as ScopedAgentClient
}

describe('listAgents', () => {
  it('lista do banco, filtrado pela instalação', async () => {
    const listByApp = vi
      .fn()
      .mockResolvedValue([linha('vendor-1', 'Atendente')])
    const warn = vi.fn()

    const result = await listAgents(
      {
        agents: { listByApp } as unknown as AgentRepository,
        logger: { warn, error: vi.fn() } as unknown as Logger,
        scopeTo: () =>
          Promise.resolve(
            scopedReturning(() =>
              Promise.resolve({ id: 'vendor-1', name: 'Atendente' }),
            ),
          ),
      },
      APP_ID,
    )

    expect(listByApp).toHaveBeenCalledWith(APP_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.vendor?.name).toBe('Atendente')
  })

  it('devolve lista vazia para instalação sem agentes', async () => {
    const listByApp = vi.fn().mockResolvedValue([])

    const result = await listAgents(
      {
        agents: { listByApp } as unknown as AgentRepository,
        logger: { warn: vi.fn(), error: vi.fn() } as unknown as Logger,
        scopeTo: vi.fn(),
      },
      APP_ID,
    )

    // O ponto: uma instalação sem agentes vê vazio, e não os agentes dos
    // outros clientes que estão no mesmo workspace.
    expect(result).toEqual([])
  })

  it('mantém a lista quando o vendor não responde', async () => {
    const listByApp = vi
      .fn()
      .mockResolvedValue([
        linha('vendor-1', 'Atendente'),
        linha('vendor-2', 'Vendedor'),
      ])
    const warn = vi.fn()

    const result = await listAgents(
      {
        agents: { listByApp } as unknown as AgentRepository,
        logger: { warn, error: vi.fn() } as unknown as Logger,
        scopeTo: (_appId: string, gptMakerAgentId: string) =>
          Promise.resolve(
            scopedReturning(() =>
              gptMakerAgentId === 'vendor-2'
                ? Promise.reject(new Error('vendor fora'))
                : Promise.resolve({ id: gptMakerAgentId, name: 'Atendente' }),
            ),
          ),
      },
      APP_ID,
    )

    // A tela é onde o cliente vê quantos agentes tem e qual bot está
    // vinculado — tudo isso vem do nosso banco. O terceiro fora do ar tira o
    // perfil, não a lista.
    expect(result).toHaveLength(2)
    expect(result[0]?.vendor).toBeDefined()
    expect(result[1]?.vendor).toBeUndefined()
    expect(result[1]?.name).toBe('Vendedor')
    expect(warn).toHaveBeenCalled()
  })
})
