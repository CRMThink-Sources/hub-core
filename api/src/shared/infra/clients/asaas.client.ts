import axios from 'axios'

type AsaasListResponse<T> = {
  data: T[]
  hasMore: boolean
  totalCount: number
}

export class AsaasClient {
  private readonly baseUrl: string

  constructor(private readonly apiKey: string) {
    this.baseUrl = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'
  }

  private async fetchPage<T>(
    path: string,
    params: Record<string, unknown>,
    limit: number,
    offset: number,
  ): Promise<AsaasListResponse<T>> {
    const response = await axios.get<AsaasListResponse<T>>(
      `${this.baseUrl}${path}`,
      {
        headers: { access_token: this.apiKey },
        params: { limit, offset, ...params },
        timeout: 15000,
      },
    )
    return response.data
  }

  async list<T>(
    path: string,
    params: Record<string, unknown> = {},
    maxRows = 1000,
  ): Promise<T[]> {
    const pageSize = 100

    // Busca a primeira página para saber o total
    const first = await this.fetchPage<T>(path, params, pageSize, 0)
    const rows: T[] = [...first.data]

    if (!first.hasMore || rows.length >= maxRows) {
      return rows.slice(0, maxRows)
    }

    const total = Math.min(first.totalCount, maxRows)
    const remainingOffsets: number[] = []
    for (let offset = pageSize; offset < total; offset += pageSize) {
      remainingOffsets.push(offset)
    }

    // Busca as páginas restantes em paralelo (lotes de 5 para não sobrecarregar)
    const BATCH = 5
    for (let i = 0; i < remainingOffsets.length; i += BATCH) {
      const batch = remainingOffsets.slice(i, i + BATCH)
      const pages = await Promise.all(
        batch.map(offset => this.fetchPage<T>(path, params, pageSize, offset)),
      )
      for (const page of pages) {
        rows.push(...page.data)
      }
    }

    return rows.slice(0, maxRows)
  }
}
