import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import {
  advance,
  collapseSays,
  type BotSessionState,
} from '@/modules/thinkzap/domain/bot-flow/advance'
import type { BotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow'
import { botFlowGraphSchema } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type { GetBotFlowRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

const stateSchema = z.object({
  currentNodeId: z.string().min(1),
  vars: z.record(z.string(), z.string()),
  attempts: z.number().int().min(0),
})

// Usa o mesmo `advance` do worker: motor próprio aprovaria fluxo que quebra em
// produção. Estado vai e volta no corpo para não misturar com sessão real.
export class SimulateBotFlowController extends Controller {
  constructor(private readonly getFlow: GetBotFlowRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = z
      .object({
        /** Fluxo salvo; ou `graph` cru, para simular rascunho não salvo. */
        flowId: z.string().min(1).optional(),
        graph: botFlowGraphSchema.optional(),
        state: stateSchema.nullable().optional(),
        input: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('start') }),
          z.object({ kind: z.literal('text'), text: z.string() }),
        ]),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const { flowId, graph, state, input } = parsed.data

    // `as BotFlowGraph`: o `.transform()` que normaliza `text` vazio faz o tipo inferido
    // pelo zod deixar de casar nominalmente, mas a estrutura é a mesma.
    let resolvedGraph = graph as BotFlowGraph | undefined
    if (!resolvedGraph) {
      if (!flowId) {
        return this.badRequest(new Error('Informe flowId ou graph'))
      }
      const flow = await this.getFlow.getById(appId, flowId)
      if (!flow) {
        return this.notFound(new Error('Flow not found'))
      }
      resolvedGraph = flow.graph
    }

    const result = advance(
      resolvedGraph,
      (state ?? null) as BotSessionState | null,
      input,
    )

    return this.ok({
      // Colapsado como o worker envia: uma mensagem por passo, não uma por nó.
      effects: collapseSays(result.effects),
      state: result.state,
      awaitingNodeId: result.awaiting?.id ?? null,
    })
  }
}
