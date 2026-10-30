import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'
import { PortalUserNotFoundError } from '../domain/errors/portal-auth.errors'

export type UpdatePortalUserBitrixIdInput = {
  id: string
  /** `null` remove o vínculo. */
  bitrixUserId: number | null
}

export type UpdatePortalUserBitrixIdOutput = {
  id: string
  bitrixUserId: number | null
}

/**
 * Define, troca ou remove o ID do usuário do Bitrix24 da CRMThink num usuário do
 * backoffice. Só essa coluna muda; e-mail, nome, senha e situação ficam como estão.
 */
export class UpdatePortalUserBitrixId {
  constructor(private readonly portalUserRepository: PortalUserRepository) {}

  async execute(
    input: UpdatePortalUserBitrixIdInput,
  ): Promise<UpdatePortalUserBitrixIdOutput> {
    const user = await this.portalUserRepository.updateBitrixUserId(
      input.id,
      input.bitrixUserId,
    )
    if (!user) throw new PortalUserNotFoundError()

    return { id: user.id, bitrixUserId: user.bitrixUserId }
  }
}
