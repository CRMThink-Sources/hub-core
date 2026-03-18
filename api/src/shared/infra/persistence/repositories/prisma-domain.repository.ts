import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { prisma } from '@/config/prisma.js'
import { toDomain } from '@/shared/infra/mappers/prisma-domaion.mapper'
import { Domain } from '@/shared/domain/entities/domain'
import { CreateDomainRepository } from '@/shared/domain/repositories/domain/create-domain.repository'
import { randomUUID } from 'crypto'

export class PrismaDomainRepository
  implements GetDomainRepository, CreateDomainRepository
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
