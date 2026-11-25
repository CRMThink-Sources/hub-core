import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { apiLogger } from '@/shared/infra/logger'
import { departmentAncestors } from '@/modules/thinkzap/domain/department-ancestors'
import { DepartmentsUnavailableError } from '@/modules/thinkzap/domain/errors/departments-unavailable.error'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'
import type { DepartmentDirectory } from '@/modules/thinkzap/domain/ports/department-directory.port'
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
  /** Lotação direta do usuário, do token. */
  bitrixDepartmentIds: string[]
}

type Evaluation = {
  access: LineAccess
  /**
   * A herança de subdepartamentos não pôde ser avaliada: `access` traz só o que vem
   * de pessoa e lotação direta, e pode estar faltando linha.
   */
  inheritanceUnknown: boolean
}

/**
 * Linhas que os grupos de acesso liberam ao usuário do widget.
 *
 * Sempre lê o banco (sem o cache do contexto da aplicação): alterar um grupo precisa
 * valer na próxima abertura do widget, e o servidor é quem recusa o envio. Só a
 * hierarquia de departamentos vem de cache, e só é consultada quando algum grupo da
 * instalação inclui subdepartamentos.
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
      'hasAny' | 'hasInheritingDepartments' | 'listLineIdsForUser'
    >,
    private readonly departments: DepartmentDirectory,
  ) {}

  /** @throws DepartmentsUnavailableError quando a lista ficaria incompleta. */
  async resolve(scope: UserScope): Promise<LineAccess> {
    const { access, inheritanceUnknown } = await this.evaluate(scope)
    if (inheritanceUnknown) throw new DepartmentsUnavailableError()
    return access
  }

  /**
   * @throws LineNotAllowedError quando os grupos do usuário não liberam a linha.
   * @throws DepartmentsUnavailableError quando a linha só poderia vir por herança e a
   *   hierarquia não pôde ser consultada.
   */
  async assertCanUse(
    scope: UserScope & { subscriptionItemId: string },
  ): Promise<void> {
    const { access, inheritanceUnknown } = await this.evaluate(scope)
    if (isLineAllowed(access, scope.subscriptionItemId)) return
    if (inheritanceUnknown) throw new DepartmentsUnavailableError()
    throw new LineNotAllowedError(scope.subscriptionItemId)
  }

  private async evaluate(scope: UserScope): Promise<Evaluation> {
    const installedApp = await this.getInstalledApp.getByAppCodeAndDomainId(
      scope.appCode,
      scope.domainId,
    )
    if (!installedApp) {
      return {
        access: { restricted: false, allowedLineIds: [] },
        inheritanceUnknown: false,
      }
    }

    const hasGroups = await this.groups.hasAny(installedApp.id)
    if (!hasGroups) {
      return {
        access: resolveLineAccess({ hasGroups, userLineIds: [] }),
        inheritanceUnknown: false,
      }
    }

    const ancestors = await this.ancestorsOf(
      installedApp.id,
      scope.bitrixDepartmentIds,
    )
    const userLineIds = await this.groups.listLineIdsForUser(installedApp.id, {
      bitrixUserId: scope.bitrixUserId,
      departmentIds: scope.bitrixDepartmentIds,
      ancestorDepartmentIds: ancestors ?? [],
    })
    return {
      access: resolveLineAccess({ hasGroups, userLineIds }),
      inheritanceUnknown: ancestors === null,
    }
  }

  /** `null` = há herança a avaliar e a hierarquia não pôde ser consultada. */
  private async ancestorsOf(
    installedAppId: string,
    departmentIds: string[],
  ): Promise<string[] | null> {
    if (departmentIds.length === 0) return []
    if (!(await this.groups.hasInheritingDepartments(installedAppId))) return []

    try {
      return departmentAncestors(
        departmentIds,
        await this.departments.list(installedAppId),
      )
    } catch (error) {
      apiLogger.warn(
        {
          appId: installedAppId,
          err: error instanceof Error ? error.message : String(error),
        },
        'Hierarquia de departamentos indisponível — herança não avaliada',
      )
      return null
    }
  }
}
