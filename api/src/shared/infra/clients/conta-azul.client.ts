import axios from 'axios'
import { env } from '@/config/env'

type TokenResponse = {
  access_token: string
  id_token?: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export type ContaAzulTokenResult = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  accountId: string | null
}

export class ContaAzulClient {
  private readonly baseUrl: string

  constructor(
    readonly accessToken: string,
    readonly accountId: string | null = null,
  ) {
    this.baseUrl = env.contaAzul.ApiUrl
  }

  private static basicAuthHeader(): string {
    const clientId = env.contaAzul.ClientId
    const clientSecret = env.contaAzul.ClientSecret
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  private static isLegacyTokenUrl(tokenUrl: string): boolean {
    return tokenUrl.includes('api.contaazul.com')
  }

  private static async postToken(
    tokenUrl: string,
    params: Record<string, string>,
  ): Promise<TokenResponse> {
    const legacy = ContaAzulClient.isLegacyTokenUrl(tokenUrl)
    if (legacy) {
      const response = await axios.post<TokenResponse>(
        tokenUrl,
        {
          client_id: env.contaAzul.ClientId,
          client_secret: env.contaAzul.ClientSecret,
          ...params,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      )
      return response.data
    }

    const response = await axios.post<TokenResponse>(
      tokenUrl,
      new URLSearchParams(params),
      {
        headers: {
          Authorization: ContaAzulClient.basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      },
    )
    return response.data
  }

  static async exchangeCode(code: string): Promise<ContaAzulTokenResult> {
    const tokenUrl = env.contaAzul.TokenUrl
    const redirectUri = `${env.apiUrl}/thinkanalise/oauth/conta-azul/callback`

    const data = await ContaAzulClient.postToken(tokenUrl, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      accountId: null,
    }
  }

  static async refresh(refreshToken: string): Promise<ContaAzulTokenResult> {
    const tokenUrl = env.contaAzul.TokenUrl

    const data = await ContaAzulClient.postToken(tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      accountId: null, // accountId não muda no refresh; já está salvo no banco
    }
  }

  private async fetchPage<T>(
    path: string,
    params: Record<string, unknown>,
    size: number,
    page: number,
  ): Promise<T[]> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    }
    if (this.accountId) {
      headers['X-Account-Id'] = this.accountId
    }

    const response = await axios.get<T[] | { items?: T[]; itens?: T[] }>(
      `${this.baseUrl}${path}`,
      {
        headers,
        params: { tamanho_pagina: size, pagina: page, ...params },
        timeout: 15000,
      },
    )
    const data = response.data
    if (Array.isArray(data)) return data
    return data.items ?? data.itens ?? []
  }

  async list<T>(
    path: string,
    params: Record<string, unknown> = {},
    maxRows = 1000,
  ): Promise<T[]> {
    const pageSize = 100
    const rows: T[] = []
    let page = 1

    while (rows.length < maxRows) {
      const data = await this.fetchPage<T>(path, params, pageSize, page)
      rows.push(...data)
      if (data.length < pageSize || rows.length >= maxRows) break
      page++
    }

    return rows.slice(0, maxRows)
  }
}
