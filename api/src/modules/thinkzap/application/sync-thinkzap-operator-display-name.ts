import { SyncOperatorDisplayNamePort } from '@/modules/auth/domain/ports/sync-operator-display-name.port'
import { UpdateAllowedUserDisplayNameRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/update-allowed-user-display-name.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Espelha no cadastro de usuários permitidos do thinkzap o nome que o login
 * resolveu.
 *
 * É o que torna útil a segunda origem do nome do operador no envio: sem isto,
 * `displayName` fica `null` para todo usuário adicionado sem nome, e o fallback
 * consulta uma coluna vazia justamente quando o `user.get` do app foi recusado.
 *
 * Não cria row nem toca permissões — ver
 * `UpdateAllowedUserDisplayNameRepository`.
 */
export class SyncThinkzapOperatorDisplayName implements SyncOperatorDisplayNamePort {
  constructor(
    private readonly getInstalledApp: GetInstalledAppRepository,
    private readonly allowedUsers: UpdateAllowedUserDisplayNameRepository,
  ) {}

  async sync(input: {
    appCodeId: string
    domainId: string
    bitrixUserId: string
    displayName: string
  }): Promise<void> {
    const installedApp = await this.getInstalledApp.getByAppCodeAndDomainId(
      input.appCodeId,
      input.domainId,
    )

    // Login de outro app, ou instalação que não existe: não há cadastro do
    // thinkzap para atualizar, e isso não é erro.
    if (!installedApp) return

    const updated = await this.allowedUsers.updateDisplayName(
      installedApp.id,
      input.bitrixUserId,
      input.displayName,
    )

    if (updated === 0) return

    apiLogger.debug(
      {
        app: 'thinkzap',
        installedAppId: installedApp.id,
        bitrixUserId: input.bitrixUserId,
      },
      'Nome de exibição do operador atualizado no cadastro de usuários permitidos',
    )
  }
}
