import { describe, expect, it, vi } from 'vitest'
import type { Logger } from 'pino'
import { createAgent, type CreateAgentDeps } from './create-agent'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { GptMakerClient } from '../infra/clients/gptmaker.client'
import { DEFAULT_WORKTIME } from '../domain/value-objects/worktime'

const APP_ID = 'app-1'

const LINHA = {
  id: 'local-1',
  appId: APP_ID,
  gptMakerAgentId: 'vendor-1',
  botId: null,
  name: 'Atendente',
  worktime: DEFAULT_WORKTIME,
  exitOnCollaboratorJoin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

type Harness = {
  deps: CreateAgentDeps
  countByApp: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  createOnVendor: ReturnType<typeof vi.fn>
  updateOnVendor: ReturnType<typeof vi.fn>
  deleteOnVendor: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function harness(
  overrides: {
    countByApp?: ReturnType<typeof vi.fn>
    create?: ReturnType<typeof vi.fn>
    createOnVendor?: ReturnType<typeof vi.fn>
    deleteOnVendor?: ReturnType<typeof vi.fn>
    updateOnVendor?: ReturnType<typeof vi.fn>
  } = {},
): Harness {
  const countByApp = overrides.countByApp ?? vi.fn().mockResolvedValue(0)
  const create = overrides.create ?? vi.fn().mockResolvedValue(LINHA)
  const createOnVendor =
    overrides.createOnVendor ??
    vi.fn().mockResolvedValue({ id: 'vendor-1', name: 'Atendente' })
  const updateOnVendor =
    overrides.updateOnVendor ??
    vi.fn().mockResolvedValue({ id: 'vendor-1', name: 'Atendente' })
  const deleteOnVendor =
    overrides.deleteOnVendor ?? vi.fn().mockResolvedValue(undefined)
  const warn = vi.fn()
  const error = vi.fn()

  return {
    countByApp,
    create,
    createOnVendor,
    updateOnVendor,
    deleteOnVendor,
    warn,
    error,
    deps: {
      agents: { countByApp, create } as unknown as AgentRepository,
      client: {
        createAgent: createOnVendor,
        updateAgent: updateOnVendor,
        deleteAgent: deleteOnVendor,
      } as unknown as GptMakerClient,
      logger: {
        warn,
        error,
        info: vi.fn(),
        debug: vi.fn(),
      } as unknown as Logger,
    },
  }
}

describe('createAgent', () => {
  it('cria no vendor e associa à instalação', async () => {
    const h = harness()

    const agent = await createAgent(h.deps, APP_ID, { name: 'Atendente' })

    expect(h.createOnVendor).toHaveBeenCalledWith({ name: 'Atendente' })
    expect(h.create).toHaveBeenCalledWith({
      appId: APP_ID,
      gptMakerAgentId: 'vendor-1',
      name: 'Atendente',
    })
    expect(agent.gptMakerAgentId).toBe('vendor-1')
  })

  it('manda o nome ao vendor sem prefixo de instalação', async () => {
    const h = harness()

    await createAgent(h.deps, APP_ID, { name: 'Atendente' })

    expect(h.createOnVendor.mock.calls[0]?.[0]).toMatchObject({
      name: 'Atendente',
    })
  })

  it('recusa quando a instalação está no teto', async () => {
    const h = harness({
      countByApp: vi.fn().mockResolvedValue(MAX_AGENTS_PER_APP),
    })

    await expect(
      createAgent(h.deps, APP_ID, { name: 'Sexto' }),
    ).rejects.toMatchObject({ errorCode: 'gptmaker.agent.limit_reached' })

    // O ponto do teto vir antes: uma criação recusada não pode deixar agente
    // no workspace para alguém compensar depois.
    expect(h.createOnVendor).not.toHaveBeenCalled()
  })

  describe('quando a gravação local falha depois de criar no vendor', () => {
    it('apaga o agente no vendor', async () => {
      const h = harness({
        create: vi.fn().mockRejectedValue(new Error('banco fora')),
      })

      await expect(
        createAgent(h.deps, APP_ID, { name: 'Atendente' }),
      ).rejects.toMatchObject({ errorCode: 'gptmaker.agent.create_failed' })

      expect(h.deleteOnVendor).toHaveBeenCalledWith('vendor-1')
    })

    it('registra o órfão quando a compensação também falha', async () => {
      const h = harness({
        create: vi.fn().mockRejectedValue(new Error('banco fora')),
        deleteOnVendor: vi.fn().mockRejectedValue(new Error('vendor fora')),
      })

      await expect(
        createAgent(h.deps, APP_ID, { name: 'Atendente' }),
      ).rejects.toMatchObject({ errorCode: 'gptmaker.agent.create_failed' })

      // Sem esta linha o agente é impossível de achar: existe no workspace,
      // cobra, e não há nada nosso apontando para ele.
      expect(h.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'gptmaker.agent.orphaned',
          gptMakerAgentId: 'vendor-1',
          appId: APP_ID,
        }),
        expect.any(String),
      )
    })
  })

  describe('communicationType e type', () => {
    // O vendor EXIGE `type` na criação — sem ele responde
    // `400 {"error":"type is required"}`. Os dois vão no POST, e o PUT só
    // aparece se o vendor devolver algo diferente do pedido.
    it('não faz PUT quando o vendor devolve o que foi pedido', async () => {
      const h = harness({
        createOnVendor: vi.fn().mockResolvedValue({
          id: 'vendor-1',
          name: 'Atendente',
          communicationType: 'FORMAL',
          type: 'SALE',
        }),
      })

      await createAgent(h.deps, APP_ID, {
        name: 'Atendente',
        communicationType: 'FORMAL',
        type: 'SALE',
      })

      expect(h.updateOnVendor).not.toHaveBeenCalled()
    })

    it('não faz PUT quando nenhum dos dois foi informado', async () => {
      const h = harness()

      await createAgent(h.deps, APP_ID, { name: 'Atendente' })

      expect(h.updateOnVendor).not.toHaveBeenCalled()
    })

    it('não faz PUT quando o vendor não ecoa os campos', async () => {
      // Ausência na resposta não é divergência: o vendor nem sempre devolve
      // tudo que recebeu, e tratar isso como erro faria um PUT em toda criação.
      const h = harness()

      await createAgent(h.deps, APP_ID, {
        name: 'Atendente',
        communicationType: 'FORMAL',
        type: 'SALE',
      })

      expect(h.updateOnVendor).not.toHaveBeenCalled()
    })

    it('corrige num PUT quando o vendor devolve valor divergente', async () => {
      const h = harness({
        createOnVendor: vi.fn().mockResolvedValue({
          id: 'vendor-1',
          name: 'Atendente',
          communicationType: 'NORMAL',
          type: 'SUPPORT',
        }),
      })

      await createAgent(h.deps, APP_ID, {
        name: 'Atendente',
        communicationType: 'FORMAL',
        type: 'SALE',
      })

      expect(h.updateOnVendor).toHaveBeenCalledWith('vendor-1', {
        communicationType: 'FORMAL',
        type: 'SALE',
      })
    })

    it('entrega o agente mesmo se o PUT de correção falhar', async () => {
      const h = harness({
        createOnVendor: vi.fn().mockResolvedValue({
          id: 'vendor-1',
          name: 'Atendente',
          communicationType: 'NORMAL',
        }),
        updateOnVendor: vi.fn().mockRejectedValue(new Error('vendor fora')),
      })

      // Um agente com os defaults é utilizável; perdê-lo porque o ajuste fino
      // falhou seria pior.
      const agent = await createAgent(h.deps, APP_ID, {
        name: 'Atendente',
        communicationType: 'FORMAL',
      })

      expect(agent.gptMakerAgentId).toBe('vendor-1')
      expect(h.warn).toHaveBeenCalled()
    })
  })
})
