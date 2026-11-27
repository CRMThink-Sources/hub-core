import axios from 'axios'

import type { ThinkzapHttpClient } from '@/infra/client/axios-thinkzap'
import type { SendListApiQuery } from './send-filters'
import type { SendStatus } from './send-status'

export type SendKind = 'text' | 'template' | 'buttons' | 'attachment'
export type SendOrigin = 'widget' | 'robot'

/** Datas sempre como string ISO 8601 (o fio não tem `Date`). */
export type SendListItem = {
  id: string
  createdAt: string
  line: { id: string; name: string }
  destination: string
  kind: SendKind
  origin: SendOrigin
  /** Robô sem usuário: `{ id: null, name: null }`. `name` é nulo se o Bitrix não resolveu. */
  sender: { id: string | null; name: string | null }
  status: SendStatus
  /** Frase pronta (pode vir em minúsculas: use `capitalizeFirst`); nula quando não falhou. */
  failureReason: string | null
  /** Alguma parte sem confirmação: mostrar aviso para conferir antes de reenviar. */
  hasUnconfirmed: boolean
}

export type SendListResponse = {
  items: SendListItem[]
  total: number
  page: number
  limit: number
  /** Janela de retenção do histórico, em dias (90). */
  retentionDays: number
  /** Opções do filtro de linha. */
  lines: { id: string; name: string }[]
  /** Opções do filtro de remetente (só administrador recebe lista). */
  senders: { id: string; name: string | null }[]
}

export type SendDetailPart = {
  kind: SendKind
  fileName: string | null
  status: SendStatus
  failureReason: string | null
}

export type SendDetail = SendListItem & {
  text: string
  template: { name: string; language: string | null } | null
  timestamps: {
    sentAt: string | null
    deliveredAt: string | null
    readAt: string | null
    rejectedAt: string | null
  }
  /** Código da Meta e motivo traduzido; nulo quando o envio não falhou. */
  failure: { code: string | null; reason: string } | null
  parts: SendDetailPart[]
  /** `url` é relativa ao portal Bitrix: use `crmRecordHref`. */
  crmRecord: { entity: string; entityId: string; url: string } | null
}

/**
 * Detalhe: `not-found` cobre toda negação da API (envio de outro operador,
 * inexistente, fora dos 90 dias) com o mesmo 404 — a tela mostra uma
 * mensagem só, sem distinguir os casos.
 */
export type SendDetailResult =
  | { kind: 'found'; detail: SendDetail }
  | { kind: 'not-found' }

/** `GET /thinkzap/messages/sends` — lista paginada, já recortada pelo papel. */
export async function listSends(
  client: ThinkzapHttpClient,
  query: SendListApiQuery,
): Promise<SendListResponse> {
  return client.get<SendListResponse>('/thinkzap/messages/sends', {
    params: query,
  })
}

/**
 * `GET /thinkzap/messages/sends/:id`. Só o 404 vira resultado; qualquer outro
 * erro (401, 5xx, rede) propaga para a tela mostrar o estado de erro.
 */
export async function getSendDetail(
  client: ThinkzapHttpClient,
  id: string,
): Promise<SendDetailResult> {
  try {
    const detail = await client.get<SendDetail>(
      `/thinkzap/messages/sends/${encodeURIComponent(id)}`,
    )
    return { kind: 'found', detail }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return { kind: 'not-found' }
    }
    throw e
  }
}
