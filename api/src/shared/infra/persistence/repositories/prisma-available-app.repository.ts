import { prisma } from '@/config/prisma.js'
import { AvailableApp } from '@/shared/domain/entities/available-app'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { toAvailableApp } from '@/shared/infra/mappers/prisma-available-app.mapper'

export class PrismaAvailableAppRepository implements GetAvailableAppRepository {
  async getById(id: string): Promise<AvailableApp> {
    const availableApp = await prisma.appCode.findFirstOrThrow({
      where: { id },
      include: {
        plans: true,
      },
    })
    if (!availableApp) {
      throw new Error('Available app not found')
    }

    return toAvailableApp(availableApp)
  }

  async getAvailableApp(appCode: string): Promise<AvailableApp> {
    const raw = await prisma.appCode.findFirstOrThrow({
      where: {
        code: appCode,
      },
      include: {
        plans: true,
      },
    })

    return toAvailableApp(raw)
  }
}
