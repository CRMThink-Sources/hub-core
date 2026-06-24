import { z } from 'zod'

const empresaSchema = z.object({
  name: z.string(),
  token: z.string(),
  ambiente: z.enum(['prod', 'sandbox']),
  pasta: z.string(),
  lembrete: z.string(),
})

const fieldsSchema = z.object({
  tokens: z.array(empresaSchema),
  lembrete: z.string().optional(),
})

const verifySettingsSchema = z.object({
  selfie_enabled: z.boolean(),
  facial_biometrics_enabled: z.boolean(),
  handwritten_enabled: z.boolean(),
  official_document_enabled: z.boolean(),
  rubrica: z.boolean(),
})

const contactSettingsSchema = z.object({
  documentation: z.string().nullable(),
  has_document: z.string().nullable(),
  part: z.object({ name: z.string(), code: z.string() }),
})

// groups e dealSettings ainda têm shape instável (flow vs types) — permissivo.
const groupsSchema = z.array(z.object({}).passthrough())
const dealSettingsSchema = z.object({}).passthrough()

export const settingsPatchSchema = z
  .object({
    fields: fieldsSchema,
    verifySettings: verifySettingsSchema,
    contactSettings: contactSettingsSchema,
    dealSettings: dealSettingsSchema,
    groups: groupsSchema,
  })
  .partial()
  .refine(p => Object.keys(p).length > 0, {
    message: 'Nenhum campo válido para atualizar',
  })

export type SettingsPatch = z.infer<typeof settingsPatchSchema>
