import { ThinkzapUserPermissions } from '../../thinkzap-permissions'

export interface UpdateAllowedDepartmentPermissionsRepository {
  updateDepartmentPermissions(
    appId: string,
    bitrixDepartmentId: string,
    permissions: ThinkzapUserPermissions,
  ): Promise<void>
}
