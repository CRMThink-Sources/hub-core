import {
  SessionAuthContext,
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { checkThinkzapAccess } from '@/modules/thinkzap/application/check-thinkzap-access'
import { PrismaAllowedUserRepository } from './persistence/repositories/prisma-allowed-user.repository'
import { PrismaAllowedDepartmentRepository } from './persistence/repositories/prisma-allowed-department.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
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
       * `subscription` continua na sessão, sempre `null`.
       *
       * A cobrança antiga saiu inteira e não há mais o que ler — `billing_subscriptions`
       * foi removida. A chave sobrevive porque o front deriva o estado de acesso dela;
       * removê-la do payload faria `undefined` significar "sessão velha" em vez de "sem
       * assinatura", e é `null` que o front já sabe tratar.
       *
       * O gate de finanças ainda é resolvido aqui, e não no controller de sessão: ele
       * não conhece app nenhuma. Quem substituir isto tem que devolver o estado real
       * da assinatura nesta mesma chave.
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

        void access
        return { key: 'subscription', data: null } as T
      },
    },
  ]
}
