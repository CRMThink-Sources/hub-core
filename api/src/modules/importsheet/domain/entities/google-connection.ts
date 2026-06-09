/** Tokens retornados pelo Google no exchange/refresh do OAuth. */
export type GoogleTokens = {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  scope?: string
}

export type GoogleUserInfo = {
  sub: string
  email?: string
}

export type ImportSheetAuthToken = {
  id: string
  appId: string
  provider: string
  googleSub: string | null
  email: string | null
  scope: string | null
  refreshToken: string
  accessToken: string | null
  accessTokenExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type GoogleConnection = {
  connected: boolean
  email: string | null
}
