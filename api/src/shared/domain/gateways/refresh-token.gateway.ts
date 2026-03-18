export interface RefreshTokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface RefreshTokenGateway {
  refresh(params: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }): Promise<RefreshTokenResult>
}
