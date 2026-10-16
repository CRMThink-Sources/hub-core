import { prisma } from '@/config/prisma.js'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
  parseNoticeLocale,
} from '@/modules/thinkzap/domain/daily-limit-notices'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import { apiLogger } from '@/shared/infra/logger'

export class PrismaInstallationLocaleRepository implements InstallationLocaleRepository {
  async byAppId(appId: string): Promise<NoticeLocale> {
    return this.read({ appId }, () =>
      prisma.app.findUnique({ where: { id: appId }, select: { locale: true } }),
    )
  }

  async byInstallation(
    domainId: string,
    appCodeId: string,
  ): Promise<NoticeLocale> {
    return this.read({ domainId, appCodeId }, () =>
      prisma.app.findUnique({
        where: { domainId_appCodeId: { domainId, appCodeId } },
        select: { locale: true },
      }),
    )
  }

  async save(
    domainId: string,
    appCodeId: string,
    locale: NoticeLocale,
  ): Promise<boolean> {
    const { count } = await prisma.app.updateMany({
      where: { domainId, appCodeId },
      data: { locale },
    })
    return count > 0
  }

  private async read(
    logContext: Record<string, string>,
    query: () => Promise<{ locale: string | null } | null>,
  ): Promise<NoticeLocale> {
    try {
      return parseNoticeLocale((await query())?.locale)
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', ...logContext, err },
        'Idioma da instalação não pôde ser lido — aviso sai em português',
      )
      return DEFAULT_NOTICE_LOCALE
    }
  }
}
