import { ThinkzapUserPermissions } from '../../thinkzap-permissions'

export interface UpdateAllowedUserPermissionsRepository {
  updatePermissions(
    appId: string,
    bitrixUserId: string,
    permissions: ThinkzapUserPermissions,
  ): Promise<void>
}
