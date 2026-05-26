import type { ThinkzapUserPermissions } from '../thinkzap-permissions'

export type AllowedUser = {
  id: string
  appId: string
  bitrixUserId: string
  displayName: string | null
  email: string | null
  permissions: ThinkzapUserPermissions
  createdAt: Date
}
