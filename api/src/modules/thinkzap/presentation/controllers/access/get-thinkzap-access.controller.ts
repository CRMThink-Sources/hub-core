import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import type { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import type { GetAllowedDepartmentsForUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/get-allowed-departments-for-user.repository'
import {
  checkThinkzapAccess,
  DENIED_THINKZAP_ACCESS,
} from '@/modules/thinkzap/application/check-thinkzap-access'

/**
 * Permissões do usuário do token no thinkzap.
 *
 * Duas decisões que parecem detalhe e não são:
 *
 * 1. **Negado é `200`, não `403`.** O front usa este payload para esconder
 *    links do aside e renderizar o painel de acesso negado. Com `403` ele não
 *    distinguiria "sem permissão" de "falha de leitura", e trataria as duas do
 *    mesmo jeito — provavelmente liberando a tela. Por isso a rota é registrada
 *    *antes* do `thinkzapAccessMiddleware`, que responde `403` nesse caso.
 * 2. **Departamentos entram na conta.** O cálculo que alimentava
 *    `session.thinkzapAccess` chamava `checkThinkzapAccess` sem o repositório de
 *    departamentos, então quem só tinha permissão herdada era exibido como sem
 *    acesso — mas passava nos guards de escrita, que usam o caminho completo.
 *    Aqui as duas leituras concordam.
 */
export class GetThinkzapAccessController extends Controller {
  constructor(
    private readonly getInstalledApp: GetInstalledAppRepository,
    private readonly getAllowedUser: GetAllowedUserRepository,
    private readonly getAllowedDepartments: GetAllowedDepartmentsForUserRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const { appId, domainId, bitrixUserId } = req

    // O `authMiddleware` já garante os três; a checagem é só para estreitar o
    // tipo sem `!`.
    if (!appId || !domainId || !bitrixUserId) {
      return this.unauthorized(new Error('Invalid or expired token'))
    }

    const installedApp = await this.getInstalledApp.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!installedApp) {
      return this.notFound(new Error('App not found'))
    }

    // Erro de leitura propaga: `200` com payload negado mentiria dizendo que o
    // usuário não tem acesso.
    const access = await checkThinkzapAccess(
      this.getAllowedUser,
      {
        installedAppId: installedApp.id,
        bitrixUserId,
        isBitrixAdmin: Boolean(req.isBitrixAdmin),
        bitrixDepartmentIds: req.bitrixDepartmentIds ?? [],
      },
      this.getAllowedDepartments,
    )

    return this.ok(access ?? DENIED_THINKZAP_ACCESS)
  }
}
