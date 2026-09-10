import { describe, expect, it, vi } from 'vitest'
import { adoptLineBinding } from './adopt-line-binding'
import type { BotFlowSummary } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

const APP = 'app-1'
const LINE = '300'

function flow(over: Partial<BotFlowSummary> = {}): BotFlowSummary {
  return {
    id: 'f1',
    appId: APP,
    name: 'Atendimento',
    status: 'PUBLISHED',
    version: 1,
    nodeCount: 3,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function deps(flows: BotFlowSummary[]) {
  const create = vi.fn().mockImplementation(async (input) => ({
    id: 'b1',
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  return {
    create,
    deps: {
      flows: { listByAppId: vi.fn().mockResolvedValue(flows) },
      bindings: { create },
    },
  }
}

describe('adoptLineBinding', () => {
  it('adota o canal quando há um fluxo publicado', async () => {
    const { create, deps: d } = deps([flow()])

    const binding = await adoptLineBinding(APP, LINE, d)

    expect(binding).not.toBeNull()
    expect(create).toHaveBeenCalledWith({
      appId: APP,
      flowId: 'f1',
      lineId: LINE,
      priority: 100,
      active: true,
      condition: null,
    })
  })

  it('não adota sem fluxo publicado', async () => {
    const { create, deps: d } = deps([flow({ status: 'DRAFT' })])

    expect(await adoptLineBinding(APP, LINE, d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  // Escolher um dos dois seria palpitar sobre a intenção do cliente, e o palpite errado
  // atende o cliente dele com o fluxo errado.
  it('não adota com mais de um fluxo publicado', async () => {
    const { create, deps: d } = deps([flow(), flow({ id: 'f2' })])

    expect(await adoptLineBinding(APP, LINE, d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('rascunho e arquivado não contam para o desempate', async () => {
    const { create, deps: d } = deps([
      flow(),
      flow({ id: 'f2', status: 'DRAFT' }),
      flow({ id: 'f3', status: 'ARCHIVED' }),
    ])

    expect(await adoptLineBinding(APP, LINE, d)).not.toBeNull()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: 'f1' }),
    )
  })

  it('nenhum fluxo cadastrado não adota', async () => {
    const { create, deps: d } = deps([])

    expect(await adoptLineBinding(APP, LINE, d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })
})
