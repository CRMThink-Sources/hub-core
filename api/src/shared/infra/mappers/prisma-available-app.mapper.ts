import { AppCode as PrismaAppCode } from '../../../../prisma/generated/prisma/client'
import { AvailableApp } from '@/shared/domain/entities/available-app'

/**
 * Sem `plans`: vinha de `billing_plans`, que saiu com a cobrança antiga. Nenhum
 * consumidor lia o campo — o mapper o montava e o `include` do repositório o
 * carregava por hábito, e nem `AvailableApp` o declarava.
 */
export const toAvailableApp = (raw: PrismaAppCode): AvailableApp => {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name ?? 'Sem nome',
    secret: raw.secret,
    description: raw.description ?? 'Sem descrição',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}
