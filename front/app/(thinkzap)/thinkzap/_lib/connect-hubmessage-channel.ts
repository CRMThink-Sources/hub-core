import HubMessage from '@hubmessage/connect'
import { envConfig } from '@/shared/infra/env-config'
import { resolveThinkzapClient } from './thinkzap-client'

export type ConnectHubMessageParams = {
  /** Id do item de assinatura — a linha, do ponto de vista do cliente. */
  itemId: string
  /**
   * Canal na HubMessage. Entra por parâmetro, e não é resolvido pelo backend antes
   * de tudo, porque o SDK e a checagem de allowlist precisam dele **antes** de
   * qualquer requisição nossa. O front já o tem: é o `providerRef` da linha.
   */
  channelId: string
}

/**
 * Desfechos possíveis da conexão. O SDK resolve `{ success: false }` tanto em
 * cancelamento quanto em origem não autorizada, então os casos são distinguidos
 * antes de acioná-lo (ver `isOriginAllowed`).
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

type SdkInfo = { allowOrigins?: string[] }

/** Corpo de `POST /thinkzap/lines/:itemId/connect-channel`. */
type ConnectChannelResponse = {
  connected: boolean
  wabaId: string
  wabaRecorded: boolean
}

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '')

/**
 * O SDK consulta essa mesma rota e aborta silenciosamente quando a origem da
 * página não está na allowlist do canal. Consultamos antes para poder informar
 * o motivo real ao usuário.
 */
async function isOriginAllowed(
  channelId: string,
  publicKey: string,
): Promise<boolean> {
  const response = await fetch(
    `${envConfig.hubMessageApiUrl}/instances/${channelId}/sdk-info`,
    { headers: { Authorization: publicKey } },
  )

  if (!response.ok) return true

  const info = (await response.json()) as SdkInfo
  const allowed = (info.allowOrigins ?? []).map(normalizeOrigin)
  if (allowed.length === 0) return true

  return allowed.includes(normalizeOrigin(window.location.origin))
}

/**
 * Fluxo de conexão do WhatsApp Oficial (HubMessage) no iframe Bitrix:
 * 1. SDK `@hubmessage/connect` abre a autenticação Meta e retorna wabaId/phoneId/code
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

  if (!(await isOriginAllowed(params.channelId, publicKey))) {
    return { outcome: 'origin-not-allowed', origin: window.location.origin }
  }

  const client = HubMessage.newClient({ publicKey })
  const response = await client.connect({ channelId: params.channelId })

  if (!response.success) {
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
