import { resolveBitrixTokenExpiresAt } from '@/shared/application/resolve-bitrix-token-expires-at'
import axios from 'axios'
import { getBitrixAxiosDefaults } from '@/shared/infra/clients/bitrix-axios-config'
import {
  RefreshTokenGateway,
  RefreshTokenResult,
} from '@/shared/domain/gateways/refresh-token.gateway'

interface BitrixOAuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export class BitrixOAuthClient implements RefreshTokenGateway {
  private static readonly OAUTH_URL = 'https://oauth.bitrix.info/oauth/token'

  async refresh(params: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }): Promise<RefreshTokenResult> {
    try {
      const { data } = await axios.get<BitrixOAuthResponse>(
        BitrixOAuthClient.OAUTH_URL,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: params.clientId,
            client_secret: params.clientSecret,
            refresh_token: params.refreshToken,
          },
          ...getBitrixAxiosDefaults(),
        },
      )

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: resolveBitrixTokenExpiresAt(data.expires_in),
      }
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix OAuth error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to refresh Bitrix24 token'
      throw new Error((error as Error).message)
    }
  }
}
