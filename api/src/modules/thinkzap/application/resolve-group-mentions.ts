import type IORedis from 'ioredis'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { getGroupParticipantsForMentions } from '@/modules/thinkzap/infra/cache/group-metadata-mention-cache'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

// Sem flag `g` de propósito: `test` com `g` guarda `lastIndex` entre chamadas.
const MENTION_EXISTS = /@\d{5,}/
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

// Casa lid por string, nunca via `normalizePhoneNumber` (lid não é telefone).
// Qualquer falha devolve o texto original: menção nunca impede a entrega.
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
      logThinkzapError(
        apiLogger,
        'thinkzap.zapi.group_op_failed',
        { app: 'thinkzap', instanceId, groupId, err: error },
        { msg: 'Group mention resolution failed — sending text unresolved' },
      )
      return text
    }
  }
}
