import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { prisma } from '@/config/prisma.js'
import { toDomain } from '@/shared/infra/mappers/prisma-domaion.mapper'
import { Domain } from '@/shared/domain/entities/domain'
import { CreateDomainRepository } from '@/shared/domain/repositories/domain/create-domain.repository'
import {
  UpsertDomainParams,
  UpsertDomainRepository,
} from '@/shared/domain/repositories/domain/upsert-domain.repository'
import { MemberIdAlreadyLinkedError } from '@/shared/domain/errors/member-id-already-linked.error'
import { randomUUID } from 'crypto'

/**
 * P2002 é "unique constraint failed"; `meta.target` diz qual índice. Só o de
 * `member_id` vira erro de domínio — o de `name` não acontece, porque é a chave
 * do próprio upsert.
 */
function isMemberIdUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { code, meta } = error as { code?: string; meta?: { target?: unknown } }
  if (code !== 'P2002') return false

  const target = meta?.target
  const fields = Array.isArray(target) ? target : [target]

  return fields.some(
    field => typeof field === 'string' && field.includes('member'),
  )
}

export class PrismaDomainRepository
  implements GetDomainRepository, CreateDomainRepository, UpsertDomainRepository
{
  async getDomainById(id: string): Promise<Domain | null> {
    const domain = await prisma.domain.findUnique({
      where: { id: id },
    })
    if (!domain) {
      return null
    }
    return toDomain(domain)
  }
  async getDomain(name: string): Promise<Domain | null> {
    const domain = await prisma.domain.findUnique({
      where: { name: name },
    })
    if (!domain) {
      return null
    }

    return toDomain(domain)
  }

  async upsertDomain(params: UpsertDomainParams): Promise<Domain> {
    try {
      const domain = await prisma.domain.upsert({
        where: { name: params.name },
        create: {
          id: randomUUID(),
          name: params.name,
          memberId: params.memberId,
        },
        update: { memberId: params.memberId },
      })

      return toDomain(domain)
    } catch (error) {
      if (!isMemberIdUniqueViolation(error)) throw error

      // Quem já detém o `member_id` entra na mensagem: sem isso o suporte só vê
      // "unique constraint" e não sabe qual portal está no caminho.
      const owner = await prisma.domain.findUnique({
        where: { memberId: params.memberId },
      })

      throw new MemberIdAlreadyLinkedError(
        params.memberId,
        owner?.name ?? 'desconhecido',
      )
    }
  }

  async createDomain(
    data: Omit<Domain, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Domain> {
    const newDomain = await prisma.domain.create({
      data: {
        id: randomUUID(),
        name: data.name,
        memberId: data.memberId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    return toDomain(newDomain)
  }
}
