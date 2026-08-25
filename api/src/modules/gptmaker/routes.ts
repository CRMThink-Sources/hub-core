import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeBindBotController,
  makeCreateAgentController,
  makeDeleteAgentController,
  makeGetAgentController,
  makeListAgentsController,
  makeUnbindBotController,
  makeUpdateAgentProfileController,
  makeUpdateAgentSettingsController,
} from './main/make-gptmaker-controllers'

/**
 * `:agentId` é o id do agente **no vendor**, e chega do cliente.
 *
 * Nenhuma destas rotas o repassa adiante: os controllers resolvem a posse em
 * `core_gpt_agents` (via `scopeTo` → `forAgent`) antes de qualquer chamada ao
 * GPT Maker. O workspace é compartilhado, então um id de outra instalação seria
 * aceito pela API do vendor — o que impede é a resolução, não a rota.
 */
export const createGptMakerRoutes = (): Router => {
  const router = Router()

  router.get('/agents', adaptControllerFactory(makeListAgentsController))
  router.post('/agents', adaptControllerFactory(makeCreateAgentController))
  router.get('/agents/:agentId', adaptControllerFactory(makeGetAgentController))
  router.delete(
    '/agents/:agentId',
    adaptControllerFactory(makeDeleteAgentController),
  )

  router.put(
    '/agents/:agentId/profile',
    adaptControllerFactory(makeUpdateAgentProfileController),
  )
  router.put(
    '/agents/:agentId/settings',
    adaptControllerFactory(makeUpdateAgentSettingsController),
  )

  router.post(
    '/agents/:agentId/bot',
    adaptControllerFactory(makeBindBotController),
  )
  router.delete(
    '/agents/:agentId/bot',
    adaptControllerFactory(makeUnbindBotController),
  )

  return router
}
