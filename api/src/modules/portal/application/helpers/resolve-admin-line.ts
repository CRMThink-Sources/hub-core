import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  AppContextDeps,
  resolveAppContext,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { findConnectorLineInContext } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export class AdminAppNotFoundError extends Error {
  constructor(appId: string) {
    super(`Instalação "${appId}" não encontrada`)
    this.name = 'AdminAppNotFoundError'
  }
}

/**
 * A linha de uma instalação, resolvida pelo id do **item de assinatura** — a porta
 * única das ações de linha do portal admin.
 *
 * ```
 * appId ──core_apps──> (domainId, appCode) ──GetAplicationContext──> item da SPA
 * ```
 *
 * **A autorização sai da travessia.** O contexto é o da instalação de `appId`, então
 * um id de item de outro cliente simplesmente não está na árvore: trocar o id na URL
 * devolve `LineNotFoundError`, e nenhuma checagem de pertencimento precisa ser
 * repetida em cada rota. É o mesmo mecanismo que a superfície do tenant usa, com o
 * JWT no lugar do `appId`.
 *
 * **Não checa habilitação de propósito.** Suporte atua justamente na linha bloqueada:
 * renomear ou reassinar uma linha de trial vencido é operação legítima da ferramenta
 * interna. O entitlement continua sendo reportado na listagem, para a tela mostrar o
 * travamento, e continua barrando o **envio** de mensagem, que é onde a regra de
 * cobrança tem que morder.
 *
 * `Instance` e `Connector` não participam: tudo que descreve a linha — inclusive a
 * credencial do provider — vive no item.
 */
export async function resolveAdminLine(
  appId: string,
  subscriptionItemId: string,
  deps: AppContextDeps = defaultDeps(),
): Promise<SubscriptionItem> {
  const resolved = await resolveAppContext(appId, deps)

  if (!resolved) throw new AdminAppNotFoundError(appId)

  /**
   * `findConnectorLineInContext` recusa só `provider: 'NONE'`: item de cobrança sem
   * conector é assinatura sem linha, e não há o que operar nele. Z-API e HubMessage
   * passam os dois — quem só serve um provider recusa depois, nomeando qual.
   */
  return findConnectorLineInContext(resolved.context, subscriptionItemId)
}

const defaultDeps = (): AppContextDeps => ({
  getApp: new PrismaInstalledAppRepository(),
  getAplicationContext: makeGetAplicationContext(),
})
