import type { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { PrismaBotFlowRepository } from '../../infra/persistence/repositories/prisma-bot-flow.repository'
import { PrismaBotFlowBindingRepository } from '../../infra/persistence/repositories/prisma-bot-flow-binding.repository'
import { PrismaBotFlowBotRepository } from '../../infra/persistence/repositories/prisma-bot-flow-bot.repository'
import { BitrixWelcomeBotAdapter } from '../../infra/adapters/bitrix-welcome-bot.adapter'
import { ListBotFlowsController } from '../../presentation/controllers/bot-flow/list-bot-flows.controller'
import { GetBotFlowController } from '../../presentation/controllers/bot-flow/get-bot-flow.controller'
import { CreateBotFlowController } from '../../presentation/controllers/bot-flow/create-bot-flow.controller'
import { UpdateBotFlowController } from '../../presentation/controllers/bot-flow/update-bot-flow.controller'
import { PublishBotFlowController } from '../../presentation/controllers/bot-flow/publish-bot-flow.controller'
import { DeleteBotFlowController } from '../../presentation/controllers/bot-flow/delete-bot-flow.controller'
import { SimulateBotFlowController } from '../../presentation/controllers/bot-flow/simulate-bot-flow.controller'
import {
  CreateBotFlowBindingController,
  DeleteBotFlowBindingController,
  ListBotFlowBindingsController,
  UpdateBotFlowBindingController,
  type WelcomeBotPort,
} from '../../presentation/controllers/bot-flow/bot-flow-binding.controllers'

export const makeListBotFlowsController = (): Controller =>
  new ListBotFlowsController(new PrismaBotFlowRepository())

export const makeGetBotFlowController = (): Controller =>
  new GetBotFlowController(new PrismaBotFlowRepository())

export const makeCreateBotFlowController = (): Controller => {
  const repository = new PrismaBotFlowRepository()
  return new CreateBotFlowController(repository, repository, repository)
}

export const makeUpdateBotFlowController = (): Controller => {
  const repository = new PrismaBotFlowRepository()
  return new UpdateBotFlowController(repository, repository, repository)
}

// `async` com `req` por causa do rename do bot no portal: publicar leva o nome do fluxo
// ao perfil do bot, e `makeBitrixClient` resolve a credencial a partir do request.
export const makePublishBotFlowController = async (
  req: Request,
): Promise<Controller> => {
  const repository = new PrismaBotFlowRepository()
  return new PublishBotFlowController(
    repository,
    repository,
    await makeWelcomeBot(req),
    new PrismaBotFlowBindingRepository(),
  )
}

export const makeDeleteBotFlowController = async (
  req: Request,
): Promise<Controller> => {
  const repository = new PrismaBotFlowRepository()
  return new DeleteBotFlowController(
    repository,
    repository,
    new PrismaBotFlowBindingRepository(),
    await makeWelcomeBot(req),
  )
}

export const makeSimulateBotFlowController = (): Controller =>
  new SimulateBotFlowController(new PrismaBotFlowRepository())

export const makeListBotFlowBindingsController = (): Controller =>
  new ListBotFlowBindingsController(new PrismaBotFlowBindingRepository())

// As fábricas de vínculo são `async` e recebem `req` porque `makeBitrixClient` resolve a
// credencial da instalação a partir do request.
const makeWelcomeBot = async (req: Request): Promise<WelcomeBotPort> => {
  const bots = new PrismaBotFlowBotRepository()
  return new BitrixWelcomeBotAdapter(await makeBitrixClient(req), {
    get: bots,
    save: bots,
    delete: bots,
    bindings: new PrismaBotFlowBindingRepository(),
  })
}

export const makeCreateBotFlowBindingController = async (
  req: Request,
): Promise<Controller> => {
  const bindings = new PrismaBotFlowBindingRepository()
  return new CreateBotFlowBindingController(
    bindings,
    new PrismaBotFlowRepository(),
    bindings,
    await makeWelcomeBot(req),
  )
}

export const makeUpdateBotFlowBindingController = async (
  req: Request,
): Promise<Controller> => {
  const repository = new PrismaBotFlowBindingRepository()
  return new UpdateBotFlowBindingController(
    repository,
    repository,
    repository,
    await makeWelcomeBot(req),
  )
}

export const makeDeleteBotFlowBindingController = async (
  req: Request,
): Promise<Controller> => {
  const repository = new PrismaBotFlowBindingRepository()
  return new DeleteBotFlowBindingController(
    repository,
    repository,
    await makeWelcomeBot(req),
  )
}
