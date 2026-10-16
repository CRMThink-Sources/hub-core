import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import type {
  DeleteBotFlowRepository,
  GetBotFlowRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import type { ListBotFlowBindingsRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { WelcomeBotPort } from './bot-flow-binding.controllers'

export class DeleteBotFlowController extends Controller {
  constructor(
    private readonly deleteFlow: DeleteBotFlowRepository,
    private readonly getFlow: GetBotFlowRepository,
    private readonly listBindings: ListBotFlowBindingsRepository,
    private readonly welcomeBot: WelcomeBotPort,
  ) {
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

    const { flowId } = parsed.data
    const existing = await this.getFlow.getById(appId, flowId)
    if (!existing) {
      return this.notFound(new Error('Flow not found'))
    }

    // O `onDelete: Cascade` levaria os vínculos calado e a linha ficaria sem fluxo.
    const bindings = await this.listBindings.listByAppId(appId)
    const doFluxo = bindings.filter(binding => binding.flowId === flowId)
    const inUse = doFluxo.filter(binding => binding.active)

    if (inUse.length > 0) {
      return this.conflict(
        new Error(
          `O fluxo está vinculado a ${inUse.length} linha(s). Desative os vínculos antes de excluir.`,
        ),
      )
    }

    // Vínculo inativo passa pela checagem acima e o `Cascade` apaga a nossa row, mas o
    // `WELCOME_BOT_ID` continuaria no canal e o bot ficaria mudo. Desliga antes de
    // apagar: falha aqui mantém o fluxo e dá para repetir.
    for (const binding of doFluxo) {
      await this.welcomeBot.unbindLine({ lineId: binding.lineId })
    }

    // Antes de apagar o fluxo: depois o bot perde o `flowId` (`SetNull`) e não há mais como
    // achá-lo pelo fluxo.
    await this.welcomeBot.removeBot(appId, flowId)

    await this.deleteFlow.delete(appId, flowId)

    return this.ok({ deleted: true })
  }
}
