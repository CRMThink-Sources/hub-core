export interface RemoveAllowedUserRepository {
  remove(appId: string, bitrixUserId: string): Promise<void>
}
