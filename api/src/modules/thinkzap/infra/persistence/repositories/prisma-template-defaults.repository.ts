import { prisma } from '@/config/prisma.js'
import {
  TemplateDefaults,
  TemplateDefaultsRepository,
  TemplateDefaultsScope,
  TemplateKey,
} from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'

/** `core_thinkerszap_template_defaults`: imagem padrão do envio por template. */
export class PrismaTemplateDefaultsRepository implements TemplateDefaultsRepository {
  async find(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
  ): Promise<TemplateDefaults | null> {
    const row = await prisma.thinkzapTemplateDefault.findUnique({
      where: {
        uq_template_default: {
          domainId: scope.domainId,
          subscriptionItemId: scope.subscriptionItemId,
          templateName: key.name,
          language: key.language,
        },
      },
      select: { templateName: true, language: true, headerImageUrl: true },
    })
    return row ? toDefaults(row) : null
  }

  async findMany(scope: TemplateDefaultsScope): Promise<TemplateDefaults[]> {
    const rows = await prisma.thinkzapTemplateDefault.findMany({
      where: {
        domainId: scope.domainId,
        subscriptionItemId: scope.subscriptionItemId,
      },
      select: { templateName: true, language: true, headerImageUrl: true },
    })
    return rows.map(toDefaults)
  }

  async upsert(
    scope: TemplateDefaultsScope,
    defaults: TemplateDefaults,
  ): Promise<void> {
    await prisma.thinkzapTemplateDefault.upsert({
      where: {
        uq_template_default: {
          domainId: scope.domainId,
          subscriptionItemId: scope.subscriptionItemId,
          templateName: defaults.name,
          language: defaults.language,
        },
      },
      create: {
        domainId: scope.domainId,
        subscriptionItemId: scope.subscriptionItemId,
        templateName: defaults.name,
        language: defaults.language,
        headerImageUrl: defaults.headerImageUrl,
      },
      update: { headerImageUrl: defaults.headerImageUrl },
    })
  }
}

function toDefaults(row: {
  templateName: string
  language: string
  headerImageUrl: string
}): TemplateDefaults {
  return {
    name: row.templateName,
    language: row.language,
    headerImageUrl: row.headerImageUrl,
  }
}
