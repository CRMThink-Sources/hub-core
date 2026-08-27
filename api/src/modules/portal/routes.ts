import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { createPortalLoginController } from './main/factories/create-portal-login-controller'
import { createPortalSessionController } from './main/factories/create-portal-session-controller'
import { createListPortalDomainsController } from './main/factories/create-list-portal-domains-controller'
import { createGetPortalDomainController } from './main/factories/create-get-portal-domain-controller'
import { createCreatePortalUserController } from './main/factories/create-create-portal-user-controller'
import { createListPortalUsersController } from './main/factories/create-list-portal-users-controller'
import { createCreateMcpUserController } from './main/factories/create-create-mcp-user-controller'
import { createListMcpUsersController } from './main/factories/create-list-mcp-users-controller'
import { createUpdateMcpUserController } from './main/factories/create-update-mcp-user-controller'
import { createRegisterAudioImbotAppController } from './main/factories/create-register-audio-imbot-app-controller'
import { createDeleteAudioImbotAppController } from './main/factories/create-delete-audio-imbot-app-controller'
import { createRegisterConversationWidgetAppController } from './main/factories/create-register-conversation-widget-app-controller'
import { createDeleteConversationWidgetAppController } from './main/factories/create-delete-conversation-widget-app-controller'
import { createRegisterBizprocRobotAppController } from './main/factories/create-register-bizproc-robot-app-controller'
import { createDeleteBizprocRobotAppController } from './main/factories/create-delete-bizproc-robot-app-controller'
import { createListPlacementsAppController } from './main/factories/create-list-placements-app-controller'
import { createListBizprocRobotsAppController } from './main/factories/create-list-bizproc-robots-app-controller'
import { createRegisterSpaWidgetAppController } from './main/factories/create-register-spa-widget-app-controller'
import { createDeleteSpaWidgetAppController } from './main/factories/create-delete-spa-widget-app-controller'
import { createListThinkzapInstancesAppController } from './main/factories/create-list-thinkzap-instances-app-controller'
import { createListAppSubscriptionsController } from './main/factories/create-list-app-subscriptions-controller'
import { createSubscribeThinkzapLineController } from './main/factories/create-subscribe-thinkzap-line-controller'
import { createUnsubscribeThinkzapLineController } from './main/factories/create-unsubscribe-thinkzap-line-controller'
import { createUpdateThinkzapLineNameController } from './main/factories/create-update-thinkzap-line-name-controller'
import { createReactivateThinkzapLineController } from './main/factories/create-reactivate-thinkzap-line-controller'
import type { RequestHandler } from 'express'

export const createPortalRoutes = (
  portalAuthMiddleware: RequestHandler,
): Router => {
  const router = Router()

  router.post(
    '/auth/login',
    adaptControllerFactory(createPortalLoginController),
  )
  router.get(
    '/auth/session',
    portalAuthMiddleware,
    adaptControllerFactory(createPortalSessionController),
  )
  router.get(
    '/domains',
    portalAuthMiddleware,
    adaptControllerFactory(createListPortalDomainsController),
  )
  router.get(
    '/domains/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetPortalDomainController),
  )
  router.get(
    '/users',
    portalAuthMiddleware,
    adaptControllerFactory(createListPortalUsersController),
  )
  router.post(
    '/users',
    portalAuthMiddleware,
    adaptControllerFactory(createCreatePortalUserController),
  )
  router.get(
    '/mcp-users',
    portalAuthMiddleware,
    adaptControllerFactory(createListMcpUsersController),
  )
  router.post(
    '/mcp-users',
    portalAuthMiddleware,
    adaptControllerFactory(createCreateMcpUserController),
  )
  router.patch(
    '/mcp-users/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createUpdateMcpUserController),
  )
  router.post(
    '/apps/:appId/audio-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterAudioImbotAppController),
  )
  router.delete(
    '/apps/:appId/audio-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteAudioImbotAppController),
  )
  router.post(
    '/apps/:appId/conversation-widget',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterConversationWidgetAppController),
  )
  router.delete(
    '/apps/:appId/conversation-widget',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteConversationWidgetAppController),
  )
  router.post(
    '/apps/:appId/bizproc-robot',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterBizprocRobotAppController),
  )
  router.delete(
    '/apps/:appId/bizproc-robot',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteBizprocRobotAppController),
  )
  router.get(
    '/apps/:appId/placements',
    portalAuthMiddleware,
    adaptControllerFactory(createListPlacementsAppController),
  )
  router.get(
    '/apps/:appId/bizproc-robots',
    portalAuthMiddleware,
    adaptControllerFactory(createListBizprocRobotsAppController),
  )
  router.post(
    '/apps/:appId/spa-placements',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterSpaWidgetAppController),
  )
  router.delete(
    '/apps/:appId/spa-placements',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteSpaWidgetAppController),
  )
  router.get(
    '/apps/:appId/thinkzap-instances',
    portalAuthMiddleware,
    adaptControllerFactory(createListThinkzapInstancesAppController),
  )
  /**
   * Ações de linha, todas keyed pelo **item de assinatura**: a linha é o item, e as
   * rows de `Instance`/`Connector` não existem para linha criada na SPA — enquanto as
   * rotas eram keyed por elas, a tela escondia toda ação justamente nas linhas reais.
   */
  router.post(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/subscribe',
    portalAuthMiddleware,
    adaptControllerFactory(createSubscribeThinkzapLineController),
  )
  router.post(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/unsubscribe',
    portalAuthMiddleware,
    adaptControllerFactory(createUnsubscribeThinkzapLineController),
  )
  router.patch(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/name',
    portalAuthMiddleware,
    adaptControllerFactory(createUpdateThinkzapLineNameController),
  )
  router.patch(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/reactivate',
    portalAuthMiddleware,
    adaptControllerFactory(createReactivateThinkzapLineController),
  )
  /**
   * Listagem de assinaturas, de volta — agora lendo as SPAs 1142/1146 pelo contexto da
   * instalação, e **somente leitura**. As rotas de escrita da cobrança antiga (criar,
   * criar trial, estender e cancelar trial, cancelar assinatura) continuam fora: liam e
   * escreviam `billing_subscriptions`, que saiu do schema.
   */
  router.get(
    '/apps/:appId/subscriptions',
    portalAuthMiddleware,
    adaptControllerFactory(createListAppSubscriptionsController),
  )

  return router
}
