import { describe, expect, it, vi } from 'vitest'
import { reconcileAgents, type ReconcileAgentsDeps } from './reconcile-agents'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { GptMakerClient } from '../infra/clients/gptmaker.client'
import { DEFAULT_WORKTIME } from '../domain/value-objects/worktime'

function linha(gptMakerAgentId: string, appId = 'app-1') {
  return {
    id: `local-${gptMakerAgentId}`,
    appId,
    gptMakerAgentId,
    botId: null,
    name: 'Atendente',
    worktime: DEFAULT_WORKTIME,
    exitOnCollaboratorJoin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function deps(
  vendorAgents: Array<{ id: string; name: string }>,
  localAgents: ReturnType<typeof linha>[],
): ReconcileAgentsDeps {
  return {
    client: {
      listWorkspaceAgents: vi.fn().mockResolvedValue(vendorAgents),
    } as unknown as GptMakerClient,
    agents: {
      listAll: vi.fn().mockResolvedValue(localAgents),
    } as unknown as AgentRepository,
  }
}

describe('reconcileAgents', () => {
  it('acusa agente do workspace que nenhuma instalação reivindica', async () => {
    const report = await reconcileAgents(
      deps(
        [
          { id: 'vendor-1', name: 'Atendente' },
          { id: 'vendor-orfao', name: 'Sobrou' },
        ],
        [linha('vendor-1')],
      ),
    )

    expect(report.orphanedInVendor).toEqual([
      { gptMakerAgentId: 'vendor-orfao', name: 'Sobrou' },
    ])
    expect(report.orphanedInDatabase).toEqual([])
  })

  it('acusa linha local sem agente correspondente no workspace', async () => {
    const report = await reconcileAgents(
      deps(
        [{ id: 'vendor-1', name: 'Atendente' }],
        [linha('vendor-1'), linha('vendor-sumiu', 'app-2')],
      ),
    )

    expect(report.orphanedInDatabase).toEqual([
      {
        id: 'local-vendor-sumiu',
        appId: 'app-2',
        gptMakerAgentId: 'vendor-sumiu',
      },
    ])
    expect(report.orphanedInVendor).toEqual([])
  })

  it('não acusa nada quando workspace e banco batem', async () => {
    const report = await reconcileAgents(
      deps([{ id: 'vendor-1', name: 'Atendente' }], [linha('vendor-1')]),
    )

    expect(report.orphanedInVendor).toEqual([])
    expect(report.orphanedInDatabase).toEqual([])
  })

  it('relata sem apagar', async () => {
    const d = deps([{ id: 'vendor-orfao', name: 'Sobrou' }], [])
    const deleteAgent = vi.fn()
    ;(d.client as unknown as Record<string, unknown>).deleteAgent = deleteAgent

    await reconcileAgents(d)

    // Num workspace compartilhado, o que se apaga por engano é o agente de um
    // cliente pagante — e a evidência do bug que o gerou vai junto.
    expect(deleteAgent).not.toHaveBeenCalled()
  })
})
