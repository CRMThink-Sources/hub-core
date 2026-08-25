import type { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { bindBot, unbindBot } from '@/modules/gptmaker/application/bind-bot'
import {
  agentRepository,
  botEventHandlerUrl,
  makeImbotGateway,
  resolveAppId,
  scopeTo,
} from '@/modules/gptmaker/main/make-gptmaker-deps'

/** O `:agentId` da rota — id do agente no vendor, vindo do cliente. */
const agentIdSchema = z.string().min(1, 'Informe o agente')

const bindBotSchema = z.object({
  name: z.string().min(1).optional(),
})

export class BindBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))
    const { name } = bindBotSchema.parse(req.body ?? {})

    const updated = await bindBot(
      {
        agents: agentRepository,
        imbot: await makeImbotGateway(req),
        eventHandlerUrl: botEventHandlerUrl(),
      },
      scoped,
      name ?? scoped.local.name ?? 'Agente',
    )

    return this.ok(updated)
  }
}

export class UnbindBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))

    const updated = await unbindBot(
      {
        agents: agentRepository,
        imbot: await makeImbotGateway(req),
        eventHandlerUrl: botEventHandlerUrl(),
      },
      scoped,
    )

    return this.ok(updated)
  }
}
