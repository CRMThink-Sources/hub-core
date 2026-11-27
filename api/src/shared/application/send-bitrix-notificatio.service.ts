import {
  PublishedComment,
  SendNotification,
  SendNotificationInput,
  TimelineCommentPublisher,
} from '../data/contracts/send-notification'
import { bitrixRefusedUntil } from '../infra/bitrix-limits/limit-errors'
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

type CommentResponse = {
  result?: number | string
  error?: string
  error_description?: string
} | null

/**
 * Só o código exato: `ERROR_METHOD_NOT_FOUND` e `OWNER_NOT_FOUND` contêm o mesmo
 * texto e não dizem que o comentário sumiu. O `BitrixClient` lança com o corpo da
 * resposta serializado na mensagem.
 */
const COMMENT_GONE_PATTERN = /"error"\s*:\s*"NOT_FOUND"/

function isCommentGone(error: unknown): boolean {
  return error instanceof Error && COMMENT_GONE_PATTERN.test(error.message)
}

/**
 * Pausa por limite ou recusa por intensidade: o Bitrix não executou o método, então
 * nada foi gravado e publicar de novo depois não duplica.
 */
function nothingWritten(error: unknown): boolean {
  return bitrixRefusedUntil(error, Date.now()) !== null
}

/** `null` = o Bitrix não devolveu um id utilizável. */
function publishedComment(
  response: CommentResponse | undefined,
  asAuthor: boolean,
): PublishedComment | null {
  const id = response?.result
  return id ? { commentId: String(id), asAuthor } : null
}

export class BitrixLivefeedNotificationService
  implements SendNotification, TimelineCommentPublisher
{
  constructor(
    private readonly bitrixClient: BitrixClient,
    private readonly resolveAuthor?: TimelineAuthorResolver,
    /** Ícone da marca no começo de todo comentário deste serviço. Ausente, sem ícone. */
    private readonly brandIconUrl?: string,
  ) {}

  /**
   * Publicação sem retorno, de quem não acompanha o comentário. Engole também a
   * recusa por limite, como sempre fez: esses chamadores não têm como reagendar.
   */
  async execute(input: SendNotificationInput): Promise<void> {
    try {
      await this.publish(input)
    } catch (error) {
      apiLogger.warn(
        { entity: input.entity, contextId: input.contextId, err: error },
        'Bitrix recusou o comentário de timeline por limite; não será repetido',
      )
    }
  }

  /**
   * Lança só quando o Bitrix com certeza não gravou (pausa ou recusa por limite), para
   * quem chamou adiar e publicar de novo. Falha ambígua continua `null`.
   */
  async publish(
    input: SendNotificationInput,
  ): Promise<PublishedComment | null> {
    const { contextId, entity, message, authorBitrixUserId } = input

    const entityId = Number(contextId)
    if (!entityId || isNaN(entityId)) {
      console.warn(
        '[BitrixLivefeedNotificationService] Invalid entityId:',
        contextId,
      )
      return null
    }

    const fieldsFor = (comment: string) => ({
      fields: {
        ENTITY_ID: entityId,
        ENTITY_TYPE: entity.toUpperCase(),
        COMMENT: this.decorate(comment),
      },
    })

    const asAuthor = await this.publishAsAuthor(
      authorBitrixUserId,
      fieldsFor(message),
    )
    if (asAuthor !== 'fallback') return asAuthor

    try {
      const response = await this.bitrixClient.callMethod<CommentResponse>(
        'crm.timeline.comment.add',
        fieldsFor(await this.withSender(message, input)),
      )
      if (response?.error) {
        apiLogger.warn(
          { entity, entityId, reason: response.error },
          'Bitrix recusou o comentário de timeline da instalação',
        )
        return null
      }
      apiLogger.info(
        { entity, entityId, authorMode: 'installation' },
        'Comentário de timeline publicado com a credencial da instalação',
      )
      return publishedComment(response, false)
    } catch (error) {
      if (nothingWritten(error)) throw error
      console.error(
        '[BitrixLivefeedNotificationService] Failed to add timeline comment:',
        error,
      )
      return null
    }
  }

  async update(
    input: SendNotificationInput & PublishedComment,
  ): Promise<boolean> {
    const { commentId, asAuthor, authorBitrixUserId, message } = input
    const paramsFor = (comment: string) => ({
      id: Number(commentId),
      fields: { COMMENT: this.decorate(comment) },
    })

    if (asAuthor) {
      const outcome = await this.updateAsAuthor(
        authorBitrixUserId,
        paramsFor(message),
      )
      if (outcome !== 'fallback') return outcome === 'updated'
    }

    // Editar é idempotente: o que não for "não existe" sobe para quem chamou tentar
    // de novo.
    let response: CommentResponse
    try {
      response = await this.bitrixClient.callMethod<CommentResponse>(
        'crm.timeline.comment.update',
        // Na edição, sem o nome o texto perderia o "Enviado por" de vez: a falha
        // sobe e o job tenta de novo, já que editar é idempotente.
        paramsFor(await this.withSender(message, input, { strict: true })),
      )
    } catch (error) {
      if (isCommentGone(error)) return false
      throw error
    }
    if (response?.error === 'NOT_FOUND') return false
    if (response?.error) {
      throw new Error(
        `Bitrix crm.timeline.comment.update: ${response.error} ${response.error_description ?? ''}`,
      )
    }
    return true
  }

  /**
   * `updated`: editado em nome do autor. `gone`: o comentário não existe mais.
   * `fallback`: o autor não pode editar, e vale tentar com a instalação.
   * Qualquer outra falha lança.
   */
  private async updateAsAuthor(
    authorBitrixUserId: string | undefined,
    params: Record<string, unknown>,
  ): Promise<'updated' | 'gone' | 'fallback'> {
    if (!authorBitrixUserId) return 'fallback'
    const client = await this.authorClient(authorBitrixUserId)
    if (!client) return 'fallback'

    let response: CommentResponse
    try {
      response = await client.callMethod<CommentResponse>(
        'crm.timeline.comment.update',
        params,
      )
    } catch (error) {
      if (isCommentGone(error)) return 'gone'
      if (isAuthorRefusal(error)) return this.refused(authorBitrixUserId)
      throw error
    }
    if (!response?.error) return 'updated'
    if (response.error === 'NOT_FOUND') return 'gone'

    const reason = `${response.error} ${response.error_description ?? ''}`
    if (isAuthorRefusal(reason)) return this.refused(authorBitrixUserId)
    throw new Error(`Bitrix crm.timeline.comment.update: ${reason}`)
  }

  private decorate(comment: string): string {
    return withBrandIcon(comment, this.brandIconUrl)
  }

  /** `null` = sem token utilizável do remetente. */
  private async authorClient(
    authorBitrixUserId: string,
  ): Promise<Pick<BitrixClient, 'callMethod'> | null> {
    if (!this.resolveAuthor) return null
    try {
      return await this.resolveAuthor(authorBitrixUserId)
    } catch (error) {
      apiLogger.warn(
        { authorBitrixUserId, err: error },
        'Token do remetente indisponível: comentário segue com a credencial da instalação',
      )
      return null
    }
  }

  /**
   * `PublishedComment`: o comentário já está na timeline, em nome do autor.
   * `null`: falha ambígua (ou resposta sem id); não repete (poderia duplicar).
   * `fallback`: não deu para publicar como o autor, e é seguro tentar com a instalação.
   */
  private async publishAsAuthor(
    authorBitrixUserId: string | undefined,
    params: Record<string, unknown>,
  ): Promise<PublishedComment | null | 'fallback'> {
    if (!authorBitrixUserId) return 'fallback'
    const client = await this.authorClient(authorBitrixUserId)
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
        return null
      }
      apiLogger.info(
        { authorBitrixUserId, authorMode: 'operator' },
        'Comentário de timeline publicado em nome do remetente',
      )
      return publishedComment(response, true)
    } catch (error) {
      if (isAuthorRefusal(error)) return this.refused(authorBitrixUserId)
      // A instalação divide o balde do portal e a pausa do método: tentar por ela
      // agora só bateria no mesmo limite.
      if (nothingWritten(error)) throw error
      console.error(
        '[BitrixLivefeedNotificationService] Failed to add timeline comment:',
        error,
      )
      return null
    }
  }

  private refused(authorBitrixUserId: string): 'fallback' {
    apiLogger.warn(
      { authorBitrixUserId },
      'Bitrix recusou o token do remetente: comentário segue com a credencial da instalação',
    )
    return 'fallback'
  }

  /**
   * Nomeia o remetente no texto, já que o autor exibido será quem instalou o app.
   * `strict`: a falha ao buscar o nome sobe em vez de sair o texto sem a linha.
   */
  private async withSender(
    message: string,
    input: SendNotificationInput,
    { strict = false }: { strict?: boolean } = {},
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
    } catch (error) {
      if (strict) throw error
      return message
    }
  }
}
