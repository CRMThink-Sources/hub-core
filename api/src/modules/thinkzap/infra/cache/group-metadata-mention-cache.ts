import type IORedis from 'ioredis'
import z from 'zod'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

const GROUP_METADATA_MENTION_TTL_SECONDS = 60

const mentionParticipantSchema = z.object({
  phone: z.string(),
  lid: z.string().optional(),
})

const mentionParticipantsSchema = z.array(mentionParticipantSchema)

export type GroupMentionParticipant = z.infer<typeof mentionParticipantSchema>

function groupMetadataMentionKey(instanceId: string, groupId: string): string {
  return `thinkzap:group-metadata:v1:${instanceId}:${groupId}`
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Nunca propaga falha (Redis/Z-API): retorna null para não bloquear a entrega da mensagem.
export async function getGroupParticipantsForMentions(
  redis: IORedis,
  zApiClient: ZApiClient,
  instanceId: string,
  zApiToken: string,
  groupId: string,
): Promise<GroupMentionParticipant[] | null> {
  const key = groupMetadataMentionKey(instanceId, groupId)

  try {
    const cached = await redis.get(key)
    if (cached) {
      const parsed = mentionParticipantsSchema.safeParse(safeJsonParse(cached))
      if (parsed.success) return parsed.data
    }
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', key, error },
      'Group metadata mention cache read failed — falling back to Z-API',
    )
  }

  let participants: GroupMentionParticipant[]
  try {
    const metadata = await zApiClient.getGroupMetadata(
      instanceId,
      zApiToken,
      groupId,
    )
    participants = metadata.participants.map(p => ({
      phone: p.phone,
      lid: p.lid,
    }))
  } catch (error) {
    logThinkzapError(
      apiLogger,
      'thinkzap.zapi.group_op_failed',
      { app: 'thinkzap', instanceId, groupId, err: error },
      { msg: 'Group metadata fetch for mention resolution failed' },
    )
    return null
  }

  try {
    await redis.set(
      key,
      JSON.stringify(participants),
      'EX',
      GROUP_METADATA_MENTION_TTL_SECONDS,
    )
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', key, error },
      'Group metadata mention cache write failed — ignoring',
    )
  }

  return participants
}
