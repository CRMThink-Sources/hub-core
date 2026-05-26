import { AllowedUser } from '../../entities/allowed-user'
import { ThinkzapUserPermissions } from '../../thinkzap-permissions'

export interface AddAllowedUserRepository {
  add(input: {
    appId: string
    bitrixUserId: string
    displayName?: string | null
    email?: string | null
    permissions?: ThinkzapUserPermissions
  }): Promise<AllowedUser>
}
