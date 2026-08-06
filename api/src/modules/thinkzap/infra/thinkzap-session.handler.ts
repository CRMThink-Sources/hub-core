import {
  SessionAuthContext,
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { checkThinkzapAccess } from '@/modules/thinkzap/application/check-thinkzap-access'
import { PrismaAllowedUserRepository } from './persistence/repositories/prisma-allowed-user.repository'
import { PrismaAllowedDepartmentRepository } from './persistence/repositories/prisma-allowed-department.repository'

export class ThinkzapSessionHandler implements SessionHandler {
  appCode = 'crmthink.thinkzap'

  /**
   * A chave `connectors` saiu daqui.
   *
   * O widget de conversa era o único consumidor e passou a ler as linhas de
   * `GET /api/application/me` — mesma fonte da tela de conexões. Produzir a chave
   * custava, **por linha**, `getInstance` + `getPhoneData` na Z-API,
   * `getConnectionStatus` na HubMessage e `getOpenChannel` no Bitrix, para
   * alimentar um sufixo de texto no `<option>`. Ver spec `widget-line-listing`.
   *
   * `listLinesForWidget` continua viva para `GET /thinkzap/connector/list`.
   */
  handlers: SessionHanderPerformer[] = [
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
