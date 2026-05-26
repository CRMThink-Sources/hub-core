export interface ExistsAllowedUserRepository {
  exists(appId: string, bitrixUserId: string): Promise<boolean>
}
