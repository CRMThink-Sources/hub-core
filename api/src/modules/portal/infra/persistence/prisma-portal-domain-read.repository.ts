import { prisma } from '@/config/prisma.js'
import type { PortalDomainDetail } from '../../domain/entities/portal-domain'
import type { PortalDomainReadRepository } from '../../domain/repositories/portal-domain-read.repository'

const domainInclude = {
  apps: {
    include: {
      appCode: { select: { code: true, name: true } },
    },
    orderBy: { installedAt: 'desc' as const },
  },
} as const

type DomainRow = {
  id: string
  name: string
  memberId: string
  createdAt: Date
  updatedAt: Date
  apps: Array<{
    id: string
    email: string
    status: string
    installedAt: Date
    appCode: { code: string; name: string }
  }>
}

function toPortalDomainDetail(row: DomainRow): PortalDomainDetail {
  return {
    id: row.id,
    name: row.name,
    memberId: row.memberId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    apps: row.apps.map(app => ({
      id: app.id,
      appCode: app.appCode.code,
      appName: app.appCode.name,
      status: app.status,
      email: app.email,
      installedAt: app.installedAt.toISOString(),
    })),
  }
}

export class PrismaPortalDomainReadRepository
  implements PortalDomainReadRepository
{
  async listAll(): Promise<PortalDomainDetail[]> {
    const rows = await prisma.domain.findMany({
      orderBy: { createdAt: 'desc' },
      include: domainInclude,
    })

    return rows.map(toPortalDomainDetail)
  }

  async findById(id: string): Promise<PortalDomainDetail | null> {
    const row = await prisma.domain.findUnique({
      where: { id },
      include: domainInclude,
    })

    if (!row) {
      return null
    }

    return toPortalDomainDetail(row)
  }
}
