import { z } from 'zod'
import type { ImportsheetErrorCode } from '../../errors/catalog'

const responsibleSchema = z.object({
  columnIndex: z.number().int().nonnegative(),
  matchBy: z.enum(['id', 'email', 'phone']),
})

const mappingSchema = z.object({
  columnIndex: z.number().int().nonnegative(),
  columnLabel: z.string(),
  fieldName: z.string().min(1),
  isIdentifier: z.boolean(),
  target: z.enum(['main', 'contact', 'company']).default('main'),
})

const configSchema = z
  .object({
    source: z.object({
      spreadsheetId: z.string().min(1),
      spreadsheetName: z.string(),
      tab: z.object({
        sheetId: z.number().int(),
        title: z.string(),
      }),
    }),
    target: z.object({
      entityCode: z.enum([
        'LEAD',
        'DEAL',
        'CONTACT',
        'COMPANY',
        'SPA',
        'TASK',
        'FEED',
      ]),
      entityTypeId: z.number().int().nullable(),
      categoryId: z.number().int().nullable(),
    }),
    responsible: responsibleSchema.nullable(),
    options: z.object({
      createContact: z.boolean(),
      createCompany: z.boolean(),
    }),
    mappings: z.array(mappingSchema),
    excludedColumns: z.array(z.number().int().nonnegative()),
  })
  .superRefine((config, ctx) => {
    const excluded = new Set(config.excludedColumns)

    if (config.mappings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mappings'],
        message: 'Mapeie ao menos uma coluna',
        params: { errorCode: 'importsheet.import.mapping_empty' },
      })
    }

    // CRM/SPA exigem entityTypeId — sem ele o worker cai em `?? 0` e a chamada
    // Bitrix (crm.item.*) vai com entityTypeId=0, inválida.
    const crmEntities = new Set(['LEAD', 'DEAL', 'CONTACT', 'COMPANY', 'SPA'])
    if (
      crmEntities.has(config.target.entityCode) &&
      config.target.entityTypeId === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target', 'entityTypeId'],
        message: `entityTypeId é obrigatório para ${config.target.entityCode}`,
        params: { errorCode: 'importsheet.import.entity_type_required' },
      })
    }

    // Coluna excluída não pode estar mapeada.
    for (const mapping of config.mappings) {
      if (excluded.has(mapping.columnIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mappings'],
          message: `Coluna ${mapping.columnIndex} está mapeada e excluída ao mesmo tempo`,
          params: {
            errorCode: 'importsheet.import.column_mapped_and_excluded',
          },
        })
      }
    }

    // Campo (target+fieldName) ou coluna mapeados 2x → último ganha/duplica.
    const seenFields = new Set<string>()
    const seenColumns = new Set<number>()
    for (const mapping of config.mappings) {
      const fieldKey = `${mapping.target}:${mapping.fieldName}`
      if (seenFields.has(fieldKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mappings'],
          message: `Campo "${mapping.fieldName}" (${mapping.target}) está mapeado mais de uma vez`,
          params: { errorCode: 'importsheet.import.field_mapped_twice' },
        })
      }
      seenFields.add(fieldKey)

      if (seenColumns.has(mapping.columnIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mappings'],
          message: `Coluna ${mapping.columnIndex} está mapeada mais de uma vez`,
          params: { errorCode: 'importsheet.import.column_mapped_twice' },
        })
      }
      seenColumns.add(mapping.columnIndex)
    }

    // Coluna excluída não pode ser o responsável.
    if (config.responsible && excluded.has(config.responsible.columnIndex)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['responsible'],
        message: 'A coluna do responsável está excluída',
        params: { errorCode: 'importsheet.import.responsible_column_excluded' },
      })
    }
  })

const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('hours'),
    everyHours: z.number().int().min(1).max(24),
  }),
  z.object({
    mode: z.literal('days'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
])

export const importPayloadSchema = z.object({
  title: z.string().min(1).max(191),
  startRow: z.number().int().min(2),
  schedule: scheduleSchema,
  config: configSchema,
})

export type ImportPayload = z.infer<typeof importPayloadSchema>

// Extrai o errorCode taggado no 1º issue (params.errorCode) + a mensagem, pro
// controller logar o code no safeParse falho sem duplicar a validação.
export function importPayloadIssue(error: z.ZodError): {
  errorCode?: ImportsheetErrorCode
  message: string
} {
  const issue = error.issues[0]
  const params = (issue as { params?: { errorCode?: string } })?.params
  return {
    errorCode: params?.errorCode as ImportsheetErrorCode | undefined,
    message: issue?.message ?? 'Invalid payload',
  }
}
