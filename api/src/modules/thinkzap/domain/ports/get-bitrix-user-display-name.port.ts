export interface GetBitrixUserDisplayNamePort {
  getDisplayName(userId: string): Promise<string | null>
}
