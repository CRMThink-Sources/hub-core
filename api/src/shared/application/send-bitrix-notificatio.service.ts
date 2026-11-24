import {
  SendNotification,
  SendNotificationInput,
} from '../data/contracts/send-notification'
import { BitrixClient } from '../infra/clients/bitrix.client'
import { apiLogger } from '../infra/logger'

/** Tamanho do ícone na linha do título, em px. */
const BRAND_ICON_SIZE = 16

/** Ícone no começo do comentário. Sem URL (front sem endereço público), sai sem ícone. */
function withBrandIcon(message: string, iconUrl: string | undefined): string {
  if (!iconUrl) return message
  return `[IMG WIDTH=${BRAND_ICON_SIZE} HEIGHT=${BRAND_ICON_SIZE}]${iconUrl}[/IMG] ${message}`
}

/**
 * Cliente do Bitrix que age como o usuário (token OAuth dele), ou `null` quando ele
 * nunca autorizou o app. Pode lançar (ex.: renovação do token falhou).
 */
export type TimelineAuthorResolver = (
  bitrixUserId: string,
) => Promise<Pick<BitrixClient, 'callMethod'> | null>

/**
 * Recusa explícita do Bitrix ao token do usuário: acesso negado na entidade, token
 * inválido ou expirado. Só nesses casos vale tentar com a credencial da instalação.
 *
 * Erro de rede ou timeout **não** entra: a chamada pode ter gravado o comentário, e
 * `crm.timeline.comment.add` não é idempotente — repetir duplicaria o comentário.
 */
const REFUSAL_PATTERN =
  /Bitrix error: (?:401|403)\b|ACCESS_DENIED|expired_token|invalid_token|NO_AUTH_FOUND|INVALID_CREDENTIALS|insufficient_scope/i

export function isAuthorRefusal(error: unknown): boolean {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  return REFUSAL_PATTERN.test(text)
}

type CommentResponse = { error?: string; error_description?: string } | null

export class BitrixLivefeedNotificationService implements SendNotification {
  constructor(
    private readonly bitrixClient: BitrixClient,
    private readonly resolveAuthor?: TimelineAuthorResolver,
    /** Ícone da marca no começo de todo comentário deste serviço. Ausente, sem ícone. */
    private readonly brandIconUrl?: string,
  ) {}

  async execute(input: SendNotificationInput): Promise<void> {
    const { contextId, entity, message, authorBitrixUserId } = input

    const entityId = Number(contextId)
    if (!entityId || isNaN(entityId)) {
      console.warn(
        '[BitrixLivefeedNotificationService] Invalid entityId:',
        contextId,
      )
      return
    }

    const fieldsFor = (comment: string) => ({
      fields: {
        ENTITY_ID: entityId,
        ENTITY_TYPE: entity.toUpperCase(),
        COMMENT: withBrandIcon(comment, this.brandIconUrl),
      },
    })

    const asAuthor = await this.publishAsAuthor(
      authorBitrixUserId,
      fieldsFor(message),
    )
    if (asAuthor === 'published') return
    if (asAuthor === 'failed') return

    try {
      await this.bitrixClient.callMethod(
        'crm.timeline.comment.add',
        fieldsFor(await this.withSender(message, input)),
      )
      apiLogger.info(
        { entity, entityId, authorMode: 'installation' },
        'Comentário de timeline publicado com a credencial da instalação',
      )
    } catch (error) {
      console.error(
        '[BitrixLivefeedNotificationService] Failed to add timeline comment:',
        error,
      )
    }
  }

  /**
   * `published`: o comentário já está na timeline, em nome do autor.
   * `failed`: falha ambígua; não repete (poderia duplicar).
   * `fallback`: não deu para publicar como o autor, e é seguro tentar com a instalação.
   */
  private async publishAsAuthor(
    authorBitrixUserId: string | undefined,
    params: Record<string, unknown>,
  ): Promise<'published' | 'failed' | 'fallback'> {
    if (!authorBitrixUserId || !this.resolveAuthor) return 'fallback'

    let client: Pick<BitrixClient, 'callMethod'> | null
    try {
      client = await this.resolveAuthor(authorBitrixUserId)
    } catch (error) {
      apiLogger.warn(
        { authorBitrixUserId, err: error },
        'Token do remetente indisponível: comentário segue com a credencial da instalação',
      )
      return 'fallback'
    }
    if (!client) return 'fallback'

    try {
      const response = await client.callMethod<CommentResponse>(
        'crm.timeline.comment.add',
        params,
      )
      if (response?.error) {
        const reason = `${response.error} ${response.error_description ?? ''}`
        if (isAuthorRefusal(reason)) return this.refused(authorBitrixUserId)
        apiLogger.warn(
          { authorBitrixUserId, reason },
          'Bitrix recusou o comentário do remetente por motivo ambíguo; não será repetido',
        )
        return 'failed'
      }
      apiLogger.info(
        { authorBitrixUserId, authorMode: 'operator' },
        'Comentário de timeline publicado em nome do remetente',
      )
      return 'published'
    } catch (error) {
      if (isAuthorRefusal(error)) return this.refused(authorBitrixUserId)
      console.error(
        '[BitrixLivefeedNotificationService] Failed to add timeline comment:',
        error,
      )
      return 'failed'
    }
  }

  private refused(authorBitrixUserId: string): 'fallback' {
    apiLogger.warn(
      { authorBitrixUserId },
      'Bitrix recusou o token do remetente: comentário segue com a credencial da instalação',
    )
    return 'fallback'
  }

  /** Nomeia o remetente no texto, já que o autor exibido será quem instalou o app. */
  private async withSender(
    message: string,
    input: SendNotificationInput,
  ): Promise<string> {
    const { authorBitrixUserId, senderLine } = input
    if (!authorBitrixUserId || !senderLine) return message

    try {
      const response = await this.bitrixClient.callMethod<{
        result?: { NAME?: string; LAST_NAME?: string }[]
      }>('user.get', { ID: authorBitrixUserId })
      const user = response.result?.[0]
      const name = [user?.NAME, user?.LAST_NAME].filter(Boolean).join(' ')
      return name ? `${message}\n${senderLine(name)}` : message
    } catch {
      return message
    }
  }
}
