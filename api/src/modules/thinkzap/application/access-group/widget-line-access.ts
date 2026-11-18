import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'
import type { AccessGroupRepository } from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'
import {
  isLineAllowed,
  resolveLineAccess,
  type LineAccess,
} from '@/modules/thinkzap/domain/resolve-line-access'

type UserScope = {
  /** Código do app no token (`req.appId`). */
  appCode: string
  domainId: string
  bitrixUserId: string
}

/**
 * Linhas que os grupos de acesso liberam ao usuário do widget.
 *
 * Sempre lê o banco (sem o cache do contexto da aplicação): alterar um grupo precisa
 * valer na próxima abertura do widget, e o servidor é quem recusa o envio.
 *
 * Instalação não encontrada = sem grupos = sem restrição: não há grupo possível sem
 * instalação, e o envio falha adiante com o erro próprio dele.
 */
export class WidgetLineAccess {
  constructor(
    private readonly getInstalledApp: Pick<
      GetInstalledAppRepository,
      'getByAppCodeAndDomainId'
    >,
    private readonly groups: Pick<
      AccessGroupRepository,
      'hasAny' | 'listLineIdsForUser'
    >,
  ) {}

  async resolve(scope: UserScope): Promise<LineAccess> {
    const installedApp = await this.getInstalledApp.getByAppCodeAndDomainId(
      scope.appCode,
      scope.domainId,
    )
    if (!installedApp) return { restricted: false, allowedLineIds: [] }

    const hasGroups = await this.groups.hasAny(installedApp.id)
    if (!hasGroups) return resolveLineAccess({ hasGroups, userLineIds: [] })

    const userLineIds = await this.groups.listLineIdsForUser(
      installedApp.id,
      scope.bitrixUserId,
    )
    return resolveLineAccess({ hasGroups, userLineIds })
  }

  /** @throws LineNotAllowedError quando os grupos do usuário não liberam a linha. */
  async assertCanUse(
    scope: UserScope & { subscriptionItemId: string },
  ): Promise<void> {
    const access = await this.resolve(scope)
    if (!isLineAllowed(access, scope.subscriptionItemId)) {
      throw new LineNotAllowedError(scope.subscriptionItemId)
    }
  }
}
