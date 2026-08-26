import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeBindBotController,
  makeCreateBotController,
  makeDeleteBotController,
  makeListBotsController,
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

  // Bots existem por si: vivem no portal do cliente e podem ser criados,
  // removidos e reaproveitados sem agente nenhum. O vínculo é a rota
  // `/agents/:agentId/bot`.
  router.get('/bots', adaptControllerFactory(makeListBotsController))
  router.post('/bots', adaptControllerFactory(makeCreateBotController))
  router.delete('/bots/:botId', adaptControllerFactory(makeDeleteBotController))

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
