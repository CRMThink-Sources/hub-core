import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { thinkzapError } from '../../errors/catalog'

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
      throw thinkzapError('thinkzap.message.invalid_phone')
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
    throw thinkzapError('thinkzap.message.invalid_phone')
  }

  return normalizedPhones
}
