export type Credential = {
  id: string
  appId: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
  refreshFailedAttempts: number
  createdAt: Date
  updatedAt: Date
}
