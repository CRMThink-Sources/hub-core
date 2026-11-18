import { prisma } from '@/config/prisma.js'
import {
  TemplateDefaultsScope,
  TemplateKey,
} from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import { VariableMappings } from '@/modules/thinkzap/domain/template-variable-mapping'

/** `core_thinkerszap_template_variable_mappings`: variáveis padrão por template. */
export class PrismaTemplateVariableMappingsRepository implements TemplateVariableMappingsRepository {
  async find(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
  ): Promise<VariableMappings | null> {
    const row = await prisma.thinkzapTemplateVariableMapping.findUnique({
      where: {
        uq_template_variable_mapping: uniqueKey(scope, key, entityTypeId),
      },
      select: { mappings: true },
    })
    return row ? (row.mappings as VariableMappings) : null
  }

  async upsert(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
    mappings: VariableMappings,
  ): Promise<void> {
    await prisma.thinkzapTemplateVariableMapping.upsert({
      where: {
        uq_template_variable_mapping: uniqueKey(scope, key, entityTypeId),
      },
      create: { ...uniqueKey(scope, key, entityTypeId), mappings },
      update: { mappings },
    })
  }

  async delete(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
  ): Promise<void> {
    await prisma.thinkzapTemplateVariableMapping.deleteMany({
      where: uniqueKey(scope, key, entityTypeId),
    })
  }
}

function uniqueKey(
  scope: TemplateDefaultsScope,
  key: TemplateKey,
  entityTypeId: number,
) {
  return {
    domainId: scope.domainId,
    subscriptionItemId: scope.subscriptionItemId,
    templateName: key.name,
    language: key.language,
    entityTypeId,
  }
}
