import axios from 'axios'

type AsaasListResponse<T> = {
  data: T[]
  hasMore: boolean
  totalCount: number
}

export class AsaasClient {
  private readonly baseUrl: string

  constructor(private readonly apiKey: string) {
    this.baseUrl =
      process.env.ASAAS_API_URL ?? 'https://sandbox.asaas.com/api/v3'
  }

  async list<T>(
    path: string,
    params: Record<string, unknown> = {},
    maxRows = 1000,
  ): Promise<T[]> {
    const all: T[] = []
    let offset = 0
    const limit = Math.min(maxRows, 100)

    while (all.length < maxRows) {
      const response = await axios.get<AsaasListResponse<T>>(
        `${this.baseUrl}${path}`,
        {
          headers: { access_token: this.apiKey },
          params: { limit, offset, ...params },
        },
      )

      const rows = response.data.data ?? []
      all.push(...rows)

      if (!response.data.hasMore || rows.length === 0) break
      offset += limit
    }

    return all.slice(0, maxRows)
  }
}
