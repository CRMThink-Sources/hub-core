import type { Controller } from '@/shared/presentation/controller'
import {
  CreateAgentController,
  DeleteAgentController,
  GetAgentController,
  ListAgentsController,
} from '../presentation/controllers/agents.controller'
import {
  UpdateAgentProfileController,
  UpdateAgentSettingsController,
} from '../presentation/controllers/agent-settings.controller'
import {
  BindBotController,
  CreateBotController,
  DeleteBotController,
  ListBotsController,
  UnbindBotController,
} from '../presentation/controllers/bot.controller'

export const makeListAgentsController = (): Controller =>
  new ListAgentsController()

export const makeCreateAgentController = (): Controller =>
  new CreateAgentController()

export const makeGetAgentController = (): Controller => new GetAgentController()

export const makeDeleteAgentController = (): Controller =>
  new DeleteAgentController()

export const makeUpdateAgentProfileController = (): Controller =>
  new UpdateAgentProfileController()

export const makeUpdateAgentSettingsController = (): Controller =>
  new UpdateAgentSettingsController()

export const makeListBotsController = (): Controller => new ListBotsController()

export const makeCreateBotController = (): Controller =>
  new CreateBotController()

export const makeDeleteBotController = (): Controller =>
  new DeleteBotController()

export const makeBindBotController = (): Controller => new BindBotController()

export const makeUnbindBotController = (): Controller =>
  new UnbindBotController()
