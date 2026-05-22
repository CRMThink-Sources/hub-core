import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import {
  ZApiGroupMetadata,
  ZApiGroupParticipant,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'

function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function normalizeParticipant(
  raw: Record<string, unknown>,
): ZApiGroupParticipant {
  return {
    phone: String(raw.phone ?? ''),
    isAdmin: parseBool(raw.isAdmin),
    isSuperAdmin: parseBool(raw.isSuperAdmin),
    short: raw.short != null ? String(raw.short) : undefined,
    name: raw.name != null ? String(raw.name) : undefined,
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

export async function enrichGroupMetadata(
  metadata: ZApiGroupMetadata,
  zApiClient: ZApiClient,
  instanceId: string,
  zApiToken: string,
): Promise<ZApiGroupMetadata> {
  const participants = normalizeParticipants(metadata.participants)

  const [photoUrl, participantsWithPhotos] = await Promise.all([
    zApiClient.getProfilePicture(instanceId, zApiToken, metadata.phone),
    enrichParticipantPhotos(zApiClient, instanceId, zApiToken, participants),
  ])

  return {
    ...metadata,
    adminOnlyMessage: parseBool(metadata.adminOnlyMessage),
    adminOnlySettings: parseBool(metadata.adminOnlySettings),
    requireAdminApproval: parseBool(metadata.requireAdminApproval),
    isGroupAnnouncement: parseBool(metadata.isGroupAnnouncement),
    participants: participantsWithPhotos,
    photoUrl,
  }
}
