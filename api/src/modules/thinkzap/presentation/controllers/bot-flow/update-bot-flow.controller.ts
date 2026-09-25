import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import {
  botFlowGraphSchema,
  validateFlowGraph,
} from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type {
  ExistsBotFlowNameRepository,
  GetBotFlowRepository,
  UpdateBotFlowRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

export class UpdateBotFlowController extends Controller {
  constructor(
    private readonly updateFlow: UpdateBotFlowRepository,
    private readonly getFlow: GetBotFlowRepository,
    private readonly existsName: ExistsBotFlowNameRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const params = z.object({ flowId: z.string().min(1) }).safeParse(req.params)
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        graph: botFlowGraphSchema.optional(),
      })
      .safeParse(req.body)

    // Com o motivo junto: rascunho salva grafo incompleto, então quando o schema recusa é
    // por forma inesperada, e "Invalid request" sozinho não diz qual campo.
    if (!params.success || !body.success) {
      const motivo = (params.error ?? body.error)?.message ?? ''
      return this.badRequest(new Error(`Invalid request: ${motivo}`))
    }

    const { flowId } = params.data
    const existing = await this.getFlow.getById(appId, flowId)
    if (!existing) {
      return this.notFound(new Error('Flow not found'))
    }

    if (
      body.data.name &&
      (await this.existsName.existsName(appId, body.data.name, flowId))
    ) {
      return this.badRequest(new Error('Já existe um fluxo com esse nome'))
    }

    // Rascunho salva quebrado de propósito: o portão é a publicação.
    const flow = await this.updateFlow.update(appId, flowId, {
      ...(body.data.name === undefined ? {} : { name: body.data.name }),
      ...(body.data.graph === undefined ? {} : { graph: body.data.graph }),
    })

    return this.ok({ flow, issues: validateFlowGraph(flow.graph) })
  }
}
