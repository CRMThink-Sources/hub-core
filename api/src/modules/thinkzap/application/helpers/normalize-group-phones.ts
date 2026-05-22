import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'

export function normalizeGroupPhones(
  phones: string[],
  instancePhone: string | null,
  options?: { minCount?: number },
): string[] {
  const normalizedInstancePhone = instancePhone
    ? normalizePhoneNumber(instancePhone)
    : null

  const normalizedPhones: string[] = []
  for (const raw of phones) {
    const normalized = normalizePhoneNumber(raw)
    if (!isValidZApiPhoneNumber(normalized)) {
      throw new Error(`Invalid phone number: ${raw}`)
    }
    if (normalizedInstancePhone && normalized === normalizedInstancePhone) {
      continue
    }
    if (!normalizedPhones.includes(normalized)) {
      normalizedPhones.push(normalized)
    }
  }

  const minCount = options?.minCount ?? 0
  if (normalizedPhones.length < minCount) {
    throw new Error('At least one valid participant phone is required')
  }

  return normalizedPhones
}
