import axios from 'axios'
import { env } from '@/config/env'

type OmieFault = { faultstring?: string; faultcode?: string }

// Paginação varia por endpoint (confirmado na doc oficial):
// padrao = pagina/registros_por_pagina; nPagina = nPagina/nRegPorPagina (mf, estoque);
// nPaginaRegs = nPagina/nRegsPorPagina (PesquisarPedCompra)
export type OmiePageStyle = 'padrao' | 'nPagina' | 'nPaginaRegs'

function extractFault(err: unknown): OmieFault | null {
  if (!axios.isAxiosError(err)) return null
  const data = err.response?.data as OmieFault | undefined
  if (data && typeof data === 'object' && typeof data.faultstring === 'string')
    return data
  return null
}

// check.controller só traduz Error('Invalid credentials') ou axios status <500 para badRequest.
// Auth inválida na OMIE: HTTP 403 + faultstring "A chave de acesso não está preenchida ou não é válida."
// (faultcode "SOAP-ENV:Server" — verificado em chamada real)
// OMIE devolve erro (faultcode Client-XXX) em vez de lista vazia quando não há registros
const OMIE_EMPTY_RESULT = 'OMIE_EMPTY_RESULT'

function normalizeOmieError(err: unknown): Error {
  const fault = extractFault(err)
  const status = axios.isAxiosError(err) ? err.response?.status : undefined
  if (
    status === 401 ||
    status === 403 ||
    (fault?.faultstring &&
      /chave de acesso|app_key|app_secret/i.test(fault.faultstring))
  ) {
    return new Error('Invalid credentials')
  }
  if (!fault?.faultstring) {
    return err instanceof Error ? err : new Error(String(err))
  }
  if (/n[ãa]o existem? registros|nenhum registro/i.test(fault.faultstring)) {
    return new Error(OMIE_EMPTY_RESULT)
  }
  if (
    fault.faultcode?.includes('8020') ||
    /consumo indevido|bloqueado/i.test(fault.faultstring)
  ) {
    return new Error(
      `Omie bloqueou o aplicativo por consumo: ${fault.faultstring}`,
    )
  }
  return new Error(
    `Omie API error (${fault.faultcode ?? 'unknown'}): ${fault.faultstring}`,
  )
}

export class OmieClient {
  constructor(
    private readonly appKey: string,
    private readonly appSecret: string,
  ) {}

  private async call<T>(
    resource: string,
    call: string,
    param: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await axios.post<T>(
        `${env.omie.apiUrl}/${resource}/`,
        {
          call,
          app_key: this.appKey,
          app_secret: this.appSecret,
          param: [param],
        },
        { timeout: 30000 },
      )
      return response.data
    } catch (err) {
      throw normalizeOmieError(err)
    }
  }

  async check(): Promise<void> {
    try {
      await this.call('geral/categorias', 'ListarCategorias', {
        pagina: 1,
        registros_por_pagina: 1,
      })
    } catch (err) {
      // conta sem categorias = credencial válida
      if (err instanceof Error && err.message === OMIE_EMPTY_RESULT) return
      throw err
    }
  }

  async list<T>(
    resource: string,
    call: string,
    listKey: string,
    params: Record<string, unknown> = {},
    maxRows = 1000,
    pageStyle: OmiePageStyle = 'padrao',
  ): Promise<T[]> {
    const pageSize = Math.min(500, maxRows)
    const rows: T[] = []
    let page = 1
    let totalPages = 1

    // Sequencial de propósito: OMIE suspende apps por consumo — nada de páginas em paralelo
    do {
      const pageParams =
        pageStyle === 'padrao'
          ? { pagina: page, registros_por_pagina: pageSize, ...params }
          : pageStyle === 'nPagina'
            ? { nPagina: page, nRegPorPagina: pageSize, ...params }
            : { nPagina: page, nRegsPorPagina: pageSize, ...params }

      let data: Record<string, unknown>
      try {
        data = await this.call<Record<string, unknown>>(
          resource,
          call,
          pageParams,
        )
      } catch (err) {
        // "não existem registros" = lista vazia, não erro (quirk OMIE)
        if (err instanceof Error && err.message === OMIE_EMPTY_RESULT) break
        throw err
      }

      const pageRows = (data[listKey] as T[] | undefined) ?? []
      rows.push(...pageRows)
      if (pageRows.length === 0) break

      totalPages =
        Number(
          pageStyle === 'padrao' ? data.total_de_paginas : data.nTotPaginas,
        ) || 1
      page++
    } while (page <= totalPages && rows.length < maxRows)

    return rows.slice(0, maxRows)
  }
}

// Data corrente no formato OMIE (dd/mm/aaaa)
export function omieToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function parseOmieCredentials(apiKey: string): {
  appKey: string
  appSecret: string
} {
  // api_key malformada (não-JSON ou campos faltando) = credencial inválida,
  // não erro de servidor — callbacks são públicos e o body vem do Bitrix
  try {
    const parsed = JSON.parse(apiKey) as {
      app_key?: string
      app_secret?: string
    }
    if (!parsed?.app_key || !parsed?.app_secret) {
      throw new Error('missing fields')
    }
    return { appKey: parsed.app_key, appSecret: parsed.app_secret }
  } catch {
    throw new Error('Invalid credentials')
  }
}
