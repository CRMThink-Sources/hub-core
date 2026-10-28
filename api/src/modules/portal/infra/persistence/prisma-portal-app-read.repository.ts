import { prisma } from '@/config/prisma.js'
import type { PortalAppDetail } from '../../domain/entities/portal-domain'
import type { PortalAppReadRepository } from '../../domain/repositories/portal-app-read.repository'

export class PrismaPortalAppReadRepository implements PortalAppReadRepository {
  async findById(appId: string): Promise<PortalAppDetail | null> {
    const row = await prisma.app.findUnique({
      where: { id: appId },
      include: {
        appCode: { select: { id: true, code: true, name: true } },
        domain: { select: { id: true, name: true, memberId: true } },
      },
    })

    if (!row) return null

    return {
      id: row.id,
      appCodeId: row.appCode.id,
      appCode: row.appCode.code,
      appName: row.appCode.name,
      title: row.appCode.name,
      spaId: row.spaId,
      mirror: row.spaId === null ? 'no-mirror' : 'unknown',
      status: row.status,
      email: row.email,
      installedAt: row.installedAt.toISOString(),
      locale: row.locale,
      domain: row.domain,
    }
  }
}
