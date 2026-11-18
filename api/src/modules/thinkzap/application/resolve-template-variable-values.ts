import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import {
  ENTITY_TYPE_ID_COMPANY,
  ENTITY_TYPE_ID_CONTACT,
  type VariableSource,
} from '@/modules/thinkzap/domain/template-variable-mapping'
import type { CrmFieldMeta } from './helpers/crm-field-catalog'
import {
  formatCrmFieldValue,
  isAmbiguousCrmValue,
} from './helpers/format-crm-field-value'
import {
  createCrmItemCache,
  readCompanyId,
  readContactIdsFromEntity,
  type CrmItemGetter,
} from './related-destinations.resolver'

export type ResolveTemplateVariableValuesInput = {
  domainId: string
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  name: string
  language: string
  entityTypeId: number
  entityId: string
}

type CrmItem = Record<string, unknown>

/**
 * Os valores iniciais das variáveis de um template para o registro em que o widget
 * está aberto, lidos dos campos que o administrador mapeou.
 *
 * **Nunca falha por causa do Bitrix.** O valor é só uma sugestão: se a leitura do
 * registro, do Contato ou da Empresa não der certo, as variáveis ficam em branco e
 * o operador preenche como sempre preencheu. Um erro aqui bloquearia o envio por um
 * ganho de conveniência.
 *
 * Só lê as fontes que o mapeamento usa, e só pede a descrição dos campos
 * (`crm.item.fields`) quando um valor é ambíguo — um número pode ser o código de
 * uma opção de lista. Sem mapeamento, não chama o Bitrix.
 *
 * Devolve só as variáveis que resolveram para texto; o widget ignora as chaves que
 * não existem mais no corpo do template.
 */
export class ResolveTemplateVariableValuesUseCase {
  constructor(
    private readonly bitrix: Pick<
      BitrixClient,
      'getCrmItem' | 'getCrmItemFields'
    >,
    private readonly mappingsRepository: TemplateVariableMappingsRepository,
  ) {}

  async execute(
    input: ResolveTemplateVariableValuesInput,
  ): Promise<{ values: Record<string, string> }> {
    const mappings = await this.mappingsRepository.find(
      {
        domainId: input.domainId,
        subscriptionItemId: input.subscriptionItemId,
      },
      { name: input.name, language: input.language },
      input.entityTypeId,
    )
    if (!mappings || Object.keys(mappings).length === 0) return { values: {} }

    try {
      return { values: await this.resolve(input, mappings) }
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.related_destinations_failed',
        { app: 'thinkzap', subQuery: 'template-variable-values', err },
        { level: 'error', msg: 'error resolving template variable values' },
      )
      return { values: {} }
    }
  }

  private async resolve(
    input: ResolveTemplateVariableValuesInput,
    mappings: Record<string, { source: VariableSource; fieldId: string }>,
  ): Promise<Record<string, string>> {
    const getCrmItem = createCrmItemCache(this.bitrix)
    const used = new Set(Object.values(mappings).map(ref => ref.source))

    const self = await getCrmItem(input.entityTypeId, input.entityId).then(
      response => response.result.item,
    )

    const items = new Map<VariableSource, { typeId: number; item: CrmItem }>([
      ['self', { typeId: input.entityTypeId, item: self }],
    ])
    await Promise.all(
      (['contact', 'company'] as const)
        .filter(source => used.has(source))
        .map(async source => {
          const related = await readRelated(getCrmItem, source, self)
          if (related) items.set(source, related)
        }),
    )

    const fieldsByType = new Map<
      number,
      Promise<Record<string, CrmFieldMeta>>
    >()
    const fieldsOf = (typeId: number) => {
      let fields = fieldsByType.get(typeId)
      if (!fields) {
        fields = this.bitrix
          .getCrmItemFields(typeId)
          .then(response => response.result.fields)
        fieldsByType.set(typeId, fields)
      }
      return fields
    }

    const values: Record<string, string> = {}
    for (const [variable, ref] of Object.entries(mappings)) {
      const found = items.get(ref.source)
      if (!found) continue

      const raw = found.item[ref.fieldId]
      let meta: CrmFieldMeta | undefined
      if (isAmbiguousCrmValue(raw)) {
        meta = await fieldsOf(found.typeId)
          .then(fields => fields[ref.fieldId])
          .catch(() => undefined)
      }

      const text = formatCrmFieldValue(raw, meta)
      if (text) values[variable] = text
    }
    return values
  }
}

/**
 * Contato principal ou Empresa vinculados ao registro. Falha ao ler um vínculo
 * deixa só as variáveis dele em branco — as da própria entidade seguem valendo.
 */
async function readRelated(
  getCrmItem: CrmItemGetter,
  source: 'contact' | 'company',
  self: CrmItem,
): Promise<{ typeId: number; item: CrmItem } | null> {
  const typeId =
    source === 'contact' ? ENTITY_TYPE_ID_CONTACT : ENTITY_TYPE_ID_COMPANY
  // `contactId` é o principal e `readContactIdsFromEntity` o coloca primeiro.
  const id =
    source === 'contact'
      ? (readContactIdsFromEntity(self)[0] ?? null)
      : readCompanyId(self)
  if (!id) return null

  try {
    const response = await getCrmItem(typeId, id)
    return { typeId, item: response.result.item }
  } catch (err) {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.related_destinations_failed',
      { app: 'thinkzap', subQuery: `template-variable-${source}`, err },
      { level: 'error', msg: 'error reading linked CRM record' },
    )
    return null
  }
}
