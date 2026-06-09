import { GoogleTokens, GoogleUserInfo } from '../entities/google-connection'

export type BuildAuthUrlParams = {
  state: string
}

export interface GoogleOAuthGateway {
  buildAuthUrl(params: BuildAuthUrlParams): string
  exchangeCode(code: string): Promise<GoogleTokens>
  refresh(refreshToken: string): Promise<GoogleTokens>
  getUserInfo(accessToken: string): Promise<GoogleUserInfo>
}
