import {
  SessionAuthContext,
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { checkThinkzapAccess } from '@/modules/thinkzap/application/check-thinkzap-access'
import { PrismaAllowedUserRepository } from './persistence/repositories/prisma-allowed-user.repository'
import { PrismaAllowedDepartmentRepository } from './persistence/repositories/prisma-allowed-department.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { listLinesForWidget } from '@/modules/thinkzap/application/list-lines-for-widget'

export class ThinkzapSessionHandler implements SessionHandler {
  appCode = 'crmthink.thinkzap'

  handlers: SessionHanderPerformer[] = [
    {
      /**
       * Lista as linhas da instalação para o widget do CRM.
       *
       * A origem é o **item de assinatura**, não `Connector`. Linha nascida direto
       * na SPA não tem row naquela tabela, então `listConnectors` devolvia lista
       * vazia e o widget não oferecia linha nenhuma — sem erro, sem log.
       *
       * O `id` de cada entrada é o id do item, mesma chave que a tela de ajustes e
       * o envio pelo widget usam. Antes era o id do conector.
       */
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const installedApp = await new PrismaInstalledAppRepository().getById(
          params.appId,
        )
        if (!installedApp) return { key: 'connectors', data: [] } as T

        const lines = await listLinesForWidget({
          appId: params.appId,
          domainId: installedApp.domainId,
          appCode: installedApp.appCodeId,
          bitrix: await makeBitrixClientByAppId(params.appId),
          getAplicationContext: makeGetAplicationContext(),
        })

        return { key: 'connectors', data: lines } as T
      },
    },
    {
      /**
       * Gate de finanças resolvido aqui dentro, não no controller de sessão: ele
       * não conhece app nenhuma. O acesso vem do contexto de autenticação da
       * request, pelo mesmo caminho completo (usuário + departamentos) que os
       * guards de escrita usam.
       */
      perform: async <T>(params: SessionAuthContext): Promise<T> => {
        const access = await checkThinkzapAccess(
          new PrismaAllowedUserRepository(),
          {
            installedAppId: params.appId,
            bitrixUserId: params.bitrixUserId,
            isBitrixAdmin: params.isBitrixAdmin,
            bitrixDepartmentIds: params.bitrixDepartmentIds,
          },
          new PrismaAllowedDepartmentRepository(),
        )

        if (!access?.canAccessFinance) {
          return { key: 'subscription', data: null } as T
        }
        const subscriptionRepository = new PrismaBillingSubscriptionRepository()
        const subscription = await subscriptionRepository.getByAppId(
          params.appId,
        )
        console.log('subscription', subscription)
        return {
          key: 'subscription',
          data: subscription
            ? {
                status: subscription.status,
                connectorQuantity: subscription.connectorQuantity,
                trialEndsAt: subscription.trialEndsAt,
              }
            : null,
        } as T
      },
    },
  ]
}
