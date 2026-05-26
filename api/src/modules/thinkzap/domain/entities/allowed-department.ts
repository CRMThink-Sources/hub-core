import type { ThinkzapUserPermissions } from '../thinkzap-permissions'

export type AllowedDepartment = {
  id: string
  appId: string
  bitrixDepartmentId: string
  displayName: string | null
  permissions: ThinkzapUserPermissions
  createdAt: Date
}
