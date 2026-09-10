import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { validateFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type { GetBotFlowRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

export class GetBotFlowController extends Controller {
  constructor(private readonly getFlow: GetBotFlowRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = z.object({ flowId: z.string().min(1) }).safeParse(req.params)
    if (!parsed.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    const flow = await this.getFlow.getById(appId, parsed.data.flowId)
    if (!flow) {
      return this.notFound(new Error('Flow not found'))
    }

    // Problemas junto do rascunho: o editor marca o card quebrado enquanto edita.
    return this.ok({ flow, issues: validateFlowGraph(flow.graph) })
  }
}
