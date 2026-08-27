import type { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { bindBot, unbindBot } from '@/modules/gptmaker/application/bind-bot'
import {
  createBot,
  deleteBot,
  listBots,
} from '@/modules/gptmaker/application/bots'
import {
  agentRepository,
  botEventHandlerUrl,
  makeImbotGateway,
  resolveAppId,
  scopeTo,
} from '@/modules/gptmaker/main/make-gptmaker-deps'

/** O `:agentId` da rota — id do agente no vendor, vindo do cliente. */
const agentIdSchema = z.string().min(1, 'Informe o agente')

/** `BOT_ID` do portal. Sequencial dentro do portal, então é inteiro positivo. */
const botIdSchema = z.coerce.number().int().positive('Informe o bot')

const bindBotSchema = z.object({ botId: botIdSchema })

const createBotSchema = z.object({
  name: z.string().min(1, 'Informe o nome do bot'),
})

async function makeBotsDeps(req: Request) {
  return {
    agents: agentRepository,
    imbot: await makeImbotGateway(req),
    eventHandlerUrl: botEventHandlerUrl(),
  }
}

export class ListBotsController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)

    return this.ok(await listBots(await makeBotsDeps(req), appId))
  }
}

export class CreateBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    // Resolve a instalação mesmo sem usar o id: é o que garante que a
    // requisição vem de uma instalação conhecida antes de criar no portal.
    await resolveAppId(req)
    const { name } = createBotSchema.parse(req.body ?? {})

    return this.ok(await createBot(await makeBotsDeps(req), name))
  }
}

export class DeleteBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const botId = botIdSchema.parse(req.params.botId)

    await deleteBot(await makeBotsDeps(req), appId, botId)

    return this.ok({ deleted: true })
  }
}

export class BindBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))
    const { botId } = bindBotSchema.parse(req.body ?? {})

    const updated = await bindBot(
      { agents: agentRepository, imbot: await makeImbotGateway(req) },
      scoped,
      botId,
    )

    return this.ok(updated)
  }
}

export class UnbindBotController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))

    const updated = await unbindBot(
      { agents: agentRepository, imbot: await makeImbotGateway(req) },
      scoped,
    )

    return this.ok(updated)
  }
}
