import { z } from 'zod'

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
    mappings: z.array(mappingSchema).min(1, 'Mapeie ao menos uma coluna'),
    excludedColumns: z.array(z.number().int().nonnegative()),
  })
  .superRefine((config, ctx) => {
    const excluded = new Set(config.excludedColumns)

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
      })
    }

    // Coluna excluída não pode estar mapeada.
    for (const mapping of config.mappings) {
      if (excluded.has(mapping.columnIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mappings'],
          message: `Coluna ${mapping.columnIndex} está mapeada e excluída ao mesmo tempo`,
        })
      }
    }

    // Coluna excluída não pode ser o responsável.
    if (config.responsible && excluded.has(config.responsible.columnIndex)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['responsible'],
        message: 'A coluna do responsável está excluída',
      })
    }
  })

const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('hours'),
    everyHours: z.number().int().min(1).max(23),
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
