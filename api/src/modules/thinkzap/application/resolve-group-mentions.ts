import type IORedis from 'ioredis'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { getGroupParticipantsForMentions } from '@/modules/thinkzap/infra/cache/group-metadata-mention-cache'
import { apiLogger } from '@/shared/infra/logger'

/** Existência barata, sem estado (não usa `g`) — só decide se vale chamar o cache/Z-API. */
const MENTION_EXISTS = /@\d{5,}/
/** Extração com grupo de captura — usada só dentro de `String.replace`, que reseta `lastIndex`. */
const MENTION_REPLACE = /@(\d{5,})/g

export type ResolveGroupMentionsInput = {
  instanceId: string
  zApiToken: string | null
  groupId: string
}

export type ResolveGroupMentions = (
  text: string,
  input: ResolveGroupMentionsInput,
) => Promise<string>

/**
 * Troca `@<lid>` pelo telefone do participante correspondente do grupo.
 *
 * Casamento é string-a-string entre os dígitos da menção e `participant.lid`
 * sem o sufixo `@lid` — nunca via `normalizePhoneNumber` (lid não é telefone
 * normalizável; ver o comentário histórico em
 * `process-z-api-inbound-message.use-case.ts` sobre esse mesmo erro).
 *
 * Menção sem participante casado (saiu do grupo, metadata sem aquele lid)
 * fica como está. Qualquer falha (cache, Z-API, parsing) devolve o texto
 * original — resolução de menção nunca é motivo para a mensagem não chegar.
 */
export function createResolveGroupMentions(deps: {
  redis: IORedis
  zApiClient: ZApiClient
}): ResolveGroupMentions {
  return async (text, { instanceId, zApiToken, groupId }) => {
    if (!text || !MENTION_EXISTS.test(text)) return text
    if (!zApiToken) return text

    try {
      const participants = await getGroupParticipantsForMentions(
        deps.redis,
        deps.zApiClient,
        instanceId,
        zApiToken,
        groupId,
      )
      if (!participants) return text

      const lidToPhone = new Map<string, string>()
      for (const participant of participants) {
        if (!participant.lid) continue
        const digits = participant.lid.split('@')[0]
        if (digits) lidToPhone.set(digits, participant.phone)
      }

      return text.replace(MENTION_REPLACE, (token, digits: string) => {
        const phone = lidToPhone.get(digits)
        return phone ? `[b]@${phone}[/b]` : token
      })
    } catch (error) {
      apiLogger.warn(
        { app: 'thinkzap', instanceId, groupId, error },
        'Group mention resolution failed — sending text unresolved',
      )
      return text
    }
  }
}
