import axios from 'axios'
import { env } from '@/config/env'
import {
  GoogleTokens,
  GoogleUserInfo,
} from '@/modules/importsheet/domain/entities/google-connection'
import {
  BuildAuthUrlParams,
  GoogleOAuthGateway,
} from '@/modules/importsheet/domain/gateways/google-oauth.gateway'

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(' ')

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
  id_token?: string
}

type UserInfoResponse = {
  sub: string
  email?: string
}

export class GoogleOAuthClient implements GoogleOAuthGateway {
  private get redirectUri(): string {
    return `${env.apiUrl}/importsheet/oauth/google/callback`
  }

  buildAuthUrl({ state }: BuildAuthUrlParams): string {
    const clientId = env.google.clientId
    if (!clientId) throw new Error('Google OAuth not configured (clientId)')

    const url = new URL(env.google.authUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('scope', GOOGLE_SCOPES)
    url.searchParams.set('state', state)
    // offline + consent garantem refresh_token mesmo em re-autorizações.
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    return url.toString()
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const data = await this.postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    })
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    }
  }

  async refresh(refreshToken: string): Promise<GoogleTokens> {
    const data = await this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    }
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await axios.get<UserInfoResponse>(env.google.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    })
    return { sub: response.data.sub, email: response.data.email }
  }

  private async postToken(
    params: Record<string, string>,
  ): Promise<TokenResponse> {
    const response = await axios.post<TokenResponse>(
      env.google.tokenUrl,
      new URLSearchParams({
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        ...params,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    )
    return response.data
  }
}
