import { describe, expect, it, vi } from 'vitest'
import { adoptLineBinding } from './adopt-line-binding'
import type { CreateBotFlowBindingRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type {
  BotFlow,
  GetBotFlowRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

const APP = 'app-1'
const LINE = '300'

function flow(over: Partial<BotFlow> = {}): BotFlow {
  return {
    id: 'f1',
    appId: APP,
    name: 'Atendimento',
    status: 'PUBLISHED',
    version: 1,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as BotFlow
}

function deps(flows: BotFlow[]) {
  // Tipado pelo contrato do repositório: `vi.fn()` cru devolve `any`, e o mock deixaria de
  // acusar mudança na assinatura de `create` — o teste passaria com o código quebrado.
  const create = vi.fn<CreateBotFlowBindingRepository['create']>(input =>
    Promise.resolve({
      id: 'b1',
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )

  return {
    create,
    deps: {
      flows: {
        getById: vi.fn<GetBotFlowRepository['getById']>((_app, id) =>
          Promise.resolve(flows.find(item => item.id === id) ?? null),
        ),
      },
      bindings: { create },
    },
  }
}

describe('adoptLineBinding', () => {
  it('adota o canal com o fluxo dono do bot', async () => {
    const { create, deps: d } = deps([flow(), flow({ id: 'f2' })])

    const binding = await adoptLineBinding(APP, LINE, 'f2', d)

    expect(binding).not.toBeNull()
    expect(create).toHaveBeenCalledWith({
      appId: APP,
      flowId: 'f2',
      lineId: LINE,
      priority: 100,
      active: true,
      condition: null,
    })
  })

  it('não adota fluxo em rascunho', async () => {
    const { create, deps: d } = deps([flow({ status: 'DRAFT' })])

    expect(await adoptLineBinding(APP, LINE, 'f1', d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('bot órfão não adota', async () => {
    // O fluxo foi apagado e o portal recusou o `unregister`: não há fluxo a rodar.
    const { create, deps: d } = deps([flow()])

    expect(await adoptLineBinding(APP, LINE, null, d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('fluxo que não existe mais não adota', async () => {
    const { create, deps: d } = deps([])

    expect(await adoptLineBinding(APP, LINE, 'f1', d)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })
})
