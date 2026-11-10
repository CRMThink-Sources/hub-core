import axios from 'axios'
import Omnizapi from '@omnizapi/connect'
import { envConfig } from '@/shared/infra/env-config'
import { resolveThinkzapClient } from './thinkzap-client'

export type ConnectHubMessageParams = {
  /** Id do item de assinatura — a linha, do ponto de vista do cliente. */
  itemId: string
  /**
   * Canal na HubMessage. Entra por parâmetro, e não é resolvido pelo backend antes
   * de tudo, porque o SDK precisa dele **antes** de qualquer requisição nossa. O
   * front já o tem: é o `providerRef` da linha.
   */
  channelId: string
}

/**
 * Desfechos possíveis da conexão. O SDK resolve `{ success: false }` tanto em
 * cancelamento quanto em origem não autorizada, então os casos são distinguidos
 * antes de acioná-lo (ver `isOriginAllowed`) e, no retorno, pelo `reason`.
 */
export type ConnectHubMessageResult =
  | {
      outcome: 'connected'
      /**
       * `false` quando o número conectou e a WABA não chegou ao item da linha. A
       * tela precisa dizer isso: os templates recusam até ela existir.
       */
      wabaRecorded: boolean
    }
  | { outcome: 'cancelled' }
  | { outcome: 'missing-config' }
  | { outcome: 'origin-not-allowed'; origin: string }
  | { outcome: 'incomplete' }

/** Corpo de `POST /thinkzap/lines/:itemId/connect-channel`. */
type ConnectChannelResponse = {
  connected: boolean
  wabaId: string
  wabaRecorded: boolean
}

/** Corpo de `GET /thinkzap/lines/:itemId/connect-origin-check`. */
type ConnectOriginCheckResponse = { allowed: boolean }

/**
 * O SDK aborta silenciosamente quando a origem da página não está na allowlist do
 * canal. Perguntamos antes, **ao nosso servidor**, para poder informar o motivo real
 * ao usuário: é ele quem consulta `sdk-info`, porque a rede de alguns clientes
 * alcança o hub-core mas não a Omni.
 *
 * A checagem só orienta a mensagem, nunca bloqueia por conta própria: falha de rede
 * ou 5xx da nossa rota libera o fluxo e deixa o SDK decidir. Já 4xx (sessão
 * expirada, linha bloqueada, linha de outro provider) sobe, como subiria no
 * `connect-channel` logo depois.
 */
export async function isOriginAllowed(
  itemId: string,
  origin: string,
): Promise<boolean> {
  const resolved = resolveThinkzapClient()
  if (!resolved.ok) {
    throw new Error(resolved.message)
  }

  try {
    const result = await resolved.client.get<ConnectOriginCheckResponse>(
      `/thinkzap/lines/${encodeURIComponent(itemId)}/connect-origin-check`,
      { params: { origin } },
    )
    return result?.allowed !== false
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined

    if (status !== undefined && status >= 400 && status < 500) throw error

    return true
  }
}

/**
 * Fluxo de conexão do WhatsApp Oficial (HubMessage) no iframe Bitrix:
 * 1. SDK `@omnizapi/connect` abre a autenticação Meta e retorna wabaId/phoneId/code
 * 2. Envia os dados ao backend, que finaliza via `POST /v1/channels/{id}/connect`
 *    e grava a WABA no item da linha
 *
 * Cada cliente autentica a própria conta Meta (WABA própria por canal).
 *
 * A rota é endereçada pelo item de assinatura: o canal sai do `metadata` dele no
 * servidor, e o `channelId` daqui serve só ao SDK.
 */
export async function connectHubMessageChannel(
  params: ConnectHubMessageParams,
): Promise<ConnectHubMessageResult> {
  const publicKey = envConfig.hubMessagePublicKey
  if (!publicKey) {
    return { outcome: 'missing-config' }
  }

  const origin = window.location.origin
  if (!(await isOriginAllowed(params.itemId, origin))) {
    return { outcome: 'origin-not-allowed', origin }
  }

  const client = Omnizapi.newClient({ publicKey })
  const response = await client.connect({ channelId: params.channelId })

  if (!response.success) {
    // A versão atual do SDK diz o motivo; a origem recusada não é cancelamento.
    if (response.reason === 'origin_not_allowed') {
      return { outcome: 'origin-not-allowed', origin }
    }
    return { outcome: 'cancelled' }
  }

  if (!response.wabaId || !response.phoneId || !response.code) {
    return { outcome: 'incomplete' }
  }

  const resolved = resolveThinkzapClient()
  if (!resolved.ok) {
    throw new Error(resolved.message)
  }

  const result = await resolved.client.post<ConnectChannelResponse>(
    `/thinkzap/lines/${encodeURIComponent(params.itemId)}/connect-channel`,
    {
      wabaId: response.wabaId,
      phoneId: response.phoneId,
      code: response.code,
    },
  )

  return { outcome: 'connected', wabaRecorded: result?.wabaRecorded !== false }
}
