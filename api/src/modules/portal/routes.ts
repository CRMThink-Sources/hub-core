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
import { createRegisterConnectorAppController } from './main/factories/create-register-connector-app-controller'
import { createRegisterButtonImbotAppController } from './main/factories/create-register-button-imbot-app-controller'
import { createDeleteButtonImbotAppController } from './main/factories/create-delete-button-imbot-app-controller'
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
import { createRegisterSmsProviderAppController } from './main/factories/create-register-sms-provider-app-controller'
import { createDeleteSmsProviderAppController } from './main/factories/create-delete-sms-provider-app-controller'
import { createListSmsProvidersAppController } from './main/factories/create-list-sms-providers-app-controller'
import { createDeleteSmsProviderByCodeAppController } from './main/factories/create-delete-sms-provider-by-code-app-controller'
import {
  createGetSubscriptionExpirationRunController,
  createListSubscriptionExpirationRunsController,
  createStartSubscriptionExpirationRunController,
} from './main/factories/create-subscription-expiration-runs-controllers'
import {
  createGetOutboxFailureController,
  createListOutboxFailuresController,
  createReprocessOutboxFailureController,
  createReprocessOutboxFailuresBatchController,
} from './main/factories/create-outbox-failures-controllers'
import { createGetDashboardSummaryController } from './main/factories/create-get-dashboard-summary-controller'
import { createGetPortalAppController } from './main/factories/create-get-portal-app-controller'
import { createLinkAplicationMirrorController } from './main/factories/create-link-aplication-mirror-controller'
import {
  createActivateSubscriptionController,
  createDeactivateSubscriptionController,
  createSubscribeSubscriptionLinesController,
} from './main/factories/create-subscription-actions-controllers'
import {
  createGetStripeSyncRunController,
  createListStripeSyncRunsController,
  createStartStripeSyncRunController,
} from './main/factories/create-stripe-sync-runs-controllers'
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
  /** Cabeçalho da tela de aplicação: instalação, domínio e estado do espelho. */
  router.get(
    '/apps/:appId',
    portalAuthMiddleware,
    adaptControllerFactory(createGetPortalAppController),
  )
  /** Religa a instalação ao item que já existe na SPA 1060. Nunca cria item. */
  router.post(
    '/apps/:appId/link-mirror',
    portalAuthMiddleware,
    adaptControllerFactory(createLinkAplicationMirrorController),
  )
  router.post(
    '/apps/:appId/connector',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterConnectorAppController),
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
    '/apps/:appId/button-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterButtonImbotAppController),
  )
  router.delete(
    '/apps/:appId/button-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteButtonImbotAppController),
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
   * Provedor de mensagem da campanha de SMS, por linha. Registrar é o que faz a linha
   * aparecer na lista de provedores do Bitrix do cliente; remover é a **única** coisa
   * que a tira de lá.
   */
  router.post(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/sms-provider',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterSmsProviderAppController),
  )
  router.delete(
    '/apps/:appId/thinkzap-lines/:subscriptionItemId/sms-provider',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteSmsProviderAppController),
  )
  /**
   * O que **está** registrado no portal do cliente, cruzado com as linhas: é a única
   * superfície onde um sender órfão aparece, e ele é a causa de campanha que falha
   * inteira sem explicação. A remoção do órfão é pelo `CODE` cru, porque o item que o
   * geraria já não existe.
   */
  router.get(
    '/apps/:appId/sms-providers',
    portalAuthMiddleware,
    adaptControllerFactory(createListSmsProvidersAppController),
  )
  router.delete(
    '/apps/:appId/sms-providers/:code',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteSmsProviderByCodeAppController),
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
  /**
   * Ações na assinatura. Ativar e inativar só escrevem o status na SPA 1142 — o ciclo
   * da SPA assina ou desassina as linhas. As três são recusadas onde os efeitos de
   * provider estão desligados.
   */
  router.post(
    '/apps/:appId/subscriptions/:subscriptionId/activate',
    portalAuthMiddleware,
    adaptControllerFactory(createActivateSubscriptionController),
  )
  router.post(
    '/apps/:appId/subscriptions/:subscriptionId/deactivate',
    portalAuthMiddleware,
    adaptControllerFactory(createDeactivateSubscriptionController),
  )
  router.post(
    '/apps/:appId/subscriptions/:subscriptionId/subscribe-lines',
    portalAuthMiddleware,
    adaptControllerFactory(createSubscribeSubscriptionLinesController),
  )

  /**
   * Resumo da home do backoffice: clientes e assinaturas da SPA 1142 por status.
   * Só leitura, com cache curto da contagem.
   */
  router.get(
    '/dashboard/summary',
    portalAuthMiddleware,
    adaptControllerFactory(createGetDashboardSummaryController),
  )

  /**
   * Histórico da varredura de expiração de assinaturas (SPA 1142) e o "Rodar
   * agora" do backoffice. O disparo respeita o mesmo lock e a mesma flag do cron.
   */
  router.get(
    '/subscription-expiration/runs',
    portalAuthMiddleware,
    adaptControllerFactory(createListSubscriptionExpirationRunsController),
  )
  router.get(
    '/subscription-expiration/runs/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetSubscriptionExpirationRunController),
  )
  router.post(
    '/subscription-expiration/runs',
    portalAuthMiddleware,
    adaptControllerFactory(createStartSubscriptionExpirationRunController),
  )

  /**
   * Histórico da sincronização Stripe → SPA 1142 e o "Rodar agora". O disparo usa o
   * mesmo lock e a mesma flag do cron (`STRIPE_SYNC_ENABLED`).
   */
  router.get(
    '/stripe-sync/runs',
    portalAuthMiddleware,
    adaptControllerFactory(createListStripeSyncRunsController),
  )
  router.get(
    '/stripe-sync/runs/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetStripeSyncRunController),
  )
  router.post(
    '/stripe-sync/runs',
    portalAuthMiddleware,
    adaptControllerFactory(createStartStripeSyncRunController),
  )

  /**
   * "Falhas de envio": intenções da fila de saída do thinkzap que não chegaram ao
   * contato, com reprocessamento. O lote vem antes de `/:id` para `reprocess` não
   * ser lido como id.
   */
  router.get(
    '/thinkzap/outbox-failures',
    portalAuthMiddleware,
    adaptControllerFactory(createListOutboxFailuresController),
  )
  router.post(
    '/thinkzap/outbox-failures/reprocess',
    portalAuthMiddleware,
    adaptControllerFactory(createReprocessOutboxFailuresBatchController),
  )
  router.get(
    '/thinkzap/outbox-failures/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetOutboxFailureController),
  )
  router.post(
    '/thinkzap/outbox-failures/:id/reprocess',
    portalAuthMiddleware,
    adaptControllerFactory(createReprocessOutboxFailureController),
  )

  return router
}
