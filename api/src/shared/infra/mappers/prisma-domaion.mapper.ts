import { Domain as PrismaDomain } from '@/prisma/client'
import { Domain } from '@/shared/domain/entities/domain'

export const toDomain = (domain: PrismaDomain): Domain => {
  return {
    id: domain.id,
    name: domain.name,
    memberId: domain.memberId,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  }
}
