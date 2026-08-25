import { describe, expect, it, vi } from 'vitest'
import { forAgent } from './scoped-agent.client'
import type { AgentRepository } from '@/modules/gptmaker/domain/repositories/agent.repository'
import type { GptMakerClient } from './gptmaker.client'
import { DEFAULT_WORKTIME } from '@/modules/gptmaker/domain/value-objects/worktime'
import type { AppError } from '@/shared/domain/errors/app-error'

const DONO = 'app-dono'
const INTRUSO = 'app-intruso'

const LINHA = {
  id: 'local-1',
  appId: DONO,
  gptMakerAgentId: 'vendor-1',
  botId: null,
  name: 'Atendente',
  worktime: DEFAULT_WORKTIME,
  exitOnCollaboratorJoin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function harness() {
  const getAgent = vi
    .fn()
    .mockResolvedValue({ id: 'vendor-1', name: 'Atendente' })
  const updateAgent = vi.fn().mockResolvedValue({ id: 'vendor-1' })
  const deleteAgent = vi.fn().mockResolvedValue(undefined)

  // `findOwned` só devolve a linha quando o `appId` bate — como no banco.
  const findOwned = vi.fn((appId: string, gptMakerAgentId: string) =>
    Promise.resolve(
      appId === LINHA.appId && gptMakerAgentId === LINHA.gptMakerAgentId
        ? LINHA
        : null,
    ),
  )

  return {
    getAgent,
    updateAgent,
    deleteAgent,
    agents: { findOwned } as unknown as AgentRepository,
    client: {
      getAgent,
      updateAgent,
      deleteAgent,
    } as unknown as GptMakerClient,
  }
}

describe('forAgent', () => {
  it('devolve o cliente escopado para a instalação dona', async () => {
    const h = harness()

    const scoped = await forAgent(h.agents, h.client, DONO, 'vendor-1')

    expect(scoped.gptMakerAgentId).toBe('vendor-1')
    expect(scoped.local.appId).toBe(DONO)
  })

  it('recusa o agente de outra instalação sem chamar o vendor', async () => {
    const h = harness()

    // O workspace é compartilhado: 'vendor-1' EXISTE e a API do vendor o
    // entregaria a quem pedisse. O que impede é só a linha local.
    await expect(
      forAgent(h.agents, h.client, INTRUSO, 'vendor-1'),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.agent.not_found' })

    expect(h.getAgent).not.toHaveBeenCalled()
    expect(h.updateAgent).not.toHaveBeenCalled()
    expect(h.deleteAgent).not.toHaveBeenCalled()
  })

  it('recusa agente inexistente sem chamar o vendor', async () => {
    const h = harness()

    await expect(
      forAgent(h.agents, h.client, DONO, 'nao-existe'),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.agent.not_found' })

    expect(h.getAgent).not.toHaveBeenCalled()
  })

  it('responde igual para agente alheio e agente inexistente', async () => {
    const h = harness()

    const alheio = (await forAgent(
      h.agents,
      h.client,
      INTRUSO,
      'vendor-1',
    ).catch((e: AppError) => e)) as AppError

    const inexistente = (await forAgent(
      h.agents,
      h.client,
      DONO,
      'nao-existe',
    ).catch((e: AppError) => e)) as AppError

    // Distinguir os dois confirmaria a existência do agente alheio a quem não
    // é dono dele.
    expect(alheio.errorCode).toBe(inexistente.errorCode)
    expect(alheio.httpStatus).toBe(inexistente.httpStatus)
    expect(alheio.message).toBe(inexistente.message)
  })

  it('age sempre sobre o agente resolvido, não sobre um id recebido', async () => {
    const h = harness()
    const scoped = await forAgent(h.agents, h.client, DONO, 'vendor-1')

    await scoped.update({ name: 'Novo' })
    await scoped.remove()

    expect(h.updateAgent).toHaveBeenCalledWith('vendor-1', { name: 'Novo' })
    expect(h.deleteAgent).toHaveBeenCalledWith('vendor-1')
  })
})
