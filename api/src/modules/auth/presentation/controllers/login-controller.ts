import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { UpsertDomain } from '@/shared/application/upsert-domain'
import { GenerateTokenRepository } from '@/shared/data/contracts/generate-token'
import { resolveBitrixUserAtLogin } from '../../application/resolve-bitrix-user-at-login'
import { SyncOperatorDisplayNamePort } from '../../domain/ports/sync-operator-display-name.port'
import { apiLogger } from '@/shared/infra/logger'
import z from 'zod'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { UnknownAppError } from '@/shared/app-catalog/errors/unknown-app.error'

export class LoginController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly upsertDomain: UpsertDomain,
    private readonly generateToken: GenerateTokenRepository,
    /**
     * Opcional: instalação de app sem cadastro de operadores simplesmente não
     * recebe a porta, e o login segue idêntico.
     */
    private readonly syncOperatorDisplayName?: SyncOperatorDisplayNamePort,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string(),
        app_code: z.string(),
        member_id: z.string(),
        access_token: z.string().min(1),
        bitrix_user_id: z.string().optional(),
        is_bitrix_admin: z.boolean().optional(),
        bitrix_user_name: z.string().optional(),
        bitrix_user_email: z.string().optional(),
        bitrix_department_ids: z.array(z.string()).optional(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const {
      domain,
      app_code,
      member_id,
      access_token,
      bitrix_user_id,
      is_bitrix_admin,
      bitrix_user_name,
      bitrix_user_email,
      bitrix_department_ids,
    } = params.data
    /**
     * O catálogo é a única fonte de "qual app é esta". Antes de qualquer
     * escrita: code fora do catálogo não vira domínio nem token.
     */
    const catalogEntry = resolveByMarketplaceCode(app_code)
    if (!catalogEntry) {
      return this.notFound(new UnknownAppError(app_code))
    }
    const availableApp = await this.getAvailableAppRepository.getById(
      catalogEntry.appCodeId,
    )

    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const domainEntity = await this.upsertDomain.execute({
      name: domain,
      memberId: member_id,
    })

    let bitrixUser
    try {
      bitrixUser = await resolveBitrixUserAtLogin({
        domain,
        accessToken: access_token,
        bitrixUserIdFallback: bitrix_user_id,
        bitrixUserNameFallback: bitrix_user_name,
        bitrixUserEmailFallback: bitrix_user_email,
        isBitrixAdminFallback: is_bitrix_admin,
        bitrixDepartmentIdsFallback: bitrix_department_ids,
      })
    } catch (err) {
      return this.badRequest(
        err instanceof Error ? err : new Error('Failed to resolve Bitrix user'),
      )
    }

    /**
     * Depois do token estar garantido e **tolerante a falha**: o nome é um detalhe
     * de exibição numa mensagem futura, e derrubar o login por causa dele deixaria
     * o operador fora do app.
     */
    if (bitrixUser.displayName && this.syncOperatorDisplayName) {
      try {
        await this.syncOperatorDisplayName.sync({
          appCodeId: availableApp.id,
          domainId: domainEntity.id,
          bitrixUserId: bitrixUser.bitrixUserId,
          displayName: bitrixUser.displayName,
        })
      } catch (err) {
        apiLogger.warn(
          {
            domainId: domainEntity.id,
            bitrixUserId: bitrixUser.bitrixUserId,
            err,
          },
          'Nome de exibição do operador não foi gravado — login segue normalmente',
        )
      }
    }

    const { token } = this.generateToken.generateToken({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
      bitrixUserId: bitrixUser.bitrixUserId,
      isBitrixAdmin: bitrixUser.isBitrixAdmin,
      bitrixDepartmentIds: bitrixUser.bitrixDepartmentIds,
    })

    /**
     * A identidade da app sai junto do token para que o cliente não precise de
     * mapa nenhum: `slug` diz para onde abrir, `appCode` é a chave de storage
     * do token, e `requiresOperatorOAuth` substitui a condicional por nome de
     * app que existia no front. Ver spec `app-login-identity`.
     */
    return {
      result: {
        token,
        app: {
          appCode: catalogEntry.appCode,
          appCodeId: catalogEntry.appCodeId,
          slug: catalogEntry.slug,
          requiresOperatorOAuth: catalogEntry.requiresOperatorOAuth,
        },
      },
      status: 201,
    }
  }
}
