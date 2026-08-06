import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import {
  ZApiGroupMetadata,
  ZApiGroupParticipant,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'

function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function coerceString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

function coerceOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return undefined
}

function normalizeParticipant(
  raw: Record<string, unknown>,
): ZApiGroupParticipant {
  return {
    phone: coerceString(raw.phone),
    isAdmin: parseBool(raw.isAdmin),
    isSuperAdmin: parseBool(raw.isSuperAdmin),
    short: coerceOptionalString(raw.short),
    name: coerceOptionalString(raw.name),
    imgUrl: null,
  }
}

function normalizeParticipants(raw: unknown): ZApiGroupParticipant[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === 'object',
    )
    .map(normalizeParticipant)
    .filter(p => p.phone.length > 0)
}

async function enrichParticipantPhotos(
  zApiClient: ZApiClient,
  instanceId: string,
  zApiToken: string,
  participants: ZApiGroupParticipant[],
): Promise<ZApiGroupParticipant[]> {
  const batchSize = 5
  const enriched: ZApiGroupParticipant[] = []

  for (let i = 0; i < participants.length; i += batchSize) {
    const batch = participants.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async participant => {
        const imgUrl = await zApiClient.getProfilePicture(
          instanceId,
          zApiToken,
          participant.phone,
        )
        return { ...participant, imgUrl }
      }),
    )
    enriched.push(...batchResults)
  }

  return enriched
}

/**
 * @param groupId Id pedido pelo chamador. É o fallback de `phone`: a resposta da
 * Z-API nem sempre traz o campo, e sem ele a busca da foto ia com `undefined` na
 * URL e o front quebrava ao montar as iniciais do avatar.
 */
export async function enrichGroupMetadata(
  metadata: ZApiGroupMetadata,
  zApiClient: ZApiClient,
  instanceId: string,
  zApiToken: string,
  groupId: string,
): Promise<ZApiGroupMetadata> {
  const participants = normalizeParticipants(metadata.participants)

  /**
   * `subject` e `phone` são tipados como `string` mas vêm de JSON de provider:
   * o tipo é promessa, não garantia. Coagir aqui é o que impede um campo ausente
   * de virar `undefined` no payload e derrubar o render lá na frente.
   */
  const phone = coerceString(metadata.phone) || groupId
  const subject = coerceString(metadata.subject)

  const [photoUrl, participantsWithPhotos] = await Promise.all([
    zApiClient.getProfilePicture(instanceId, zApiToken, phone),
    enrichParticipantPhotos(zApiClient, instanceId, zApiToken, participants),
  ])

  return {
    ...metadata,
    phone,
    subject,
    description: coerceString(metadata.description),
    adminOnlyMessage: parseBool(metadata.adminOnlyMessage),
    adminOnlySettings: parseBool(metadata.adminOnlySettings),
    requireAdminApproval: parseBool(metadata.requireAdminApproval),
    isGroupAnnouncement: parseBool(metadata.isGroupAnnouncement),
    participants: participantsWithPhotos,
    photoUrl,
  }
}
