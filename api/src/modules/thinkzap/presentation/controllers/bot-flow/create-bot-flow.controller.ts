import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { botFlowGraphSchema } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type {
  CountBotFlowsRepository,
  CreateBotFlowRepository,
  ExistsBotFlowNameRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import { EMPTY_GRAPH } from '@/modules/thinkzap/domain/bot-flow/empty-flow'

/** Espelhado em `front/shared/thinkzap-bot-flow.ts`, que esconde o botão de criar no teto. */
export const MAX_FLOWS_POR_APP = 5

export class CreateBotFlowController extends Controller {
  constructor(
    private readonly createFlow: CreateBotFlowRepository,
    private readonly existsName: ExistsBotFlowNameRepository,
    private readonly countFlows: CountBotFlowsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = z
      .object({
        name: z.string().trim().min(1).max(120),
        /** Ausente = fluxo novo; presente = duplicar/importar. */
        graph: botFlowGraphSchema.optional(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const { name, graph } = parsed.data

    // Antes da checagem de nome: quem está no teto receberia "já existe um fluxo com
    // esse nome" ao repetir o nome, o que manda procurar no lugar errado.
    if ((await this.countFlows.countByAppId(appId)) >= MAX_FLOWS_POR_APP) {
      return this.badRequest(
        new Error(
          `Esta instalação já atingiu o limite de ${MAX_FLOWS_POR_APP} fluxos. Edite um fluxo existente ou exclua um antes de criar outro.`,
        ),
      )
    }

    if (await this.existsName.existsName(appId, name)) {
      return this.badRequest(new Error('Já existe um fluxo com esse nome'))
    }

    const flow = await this.createFlow.create({
      appId,
      name,
      graph: graph ?? EMPTY_GRAPH,
    })

    return this.ok({ flow })
  }
}
