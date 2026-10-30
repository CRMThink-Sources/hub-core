import { z } from 'zod'
import { InvalidProductUpdateContentError } from '../errors/product-update.errors'

export const PRODUCT_UPDATE_LOCALES = ['pt', 'en', 'es'] as const
export type ProductUpdateLocale = (typeof PRODUCT_UPDATE_LOCALES)[number]

export const PRODUCT_UPDATE_TITLE_MAX = 200
export const PRODUCT_UPDATE_DESCRIPTION_MAX = 5000

/**
 * Texto de um idioma. Texto puro, sempre com trim: é isso que faz "espaço a mais"
 * não contar como alteração pendente. Vazio é válido — rascunho pode estar
 * incompleto; quem exige os três idiomas é a publicação (`missingLocales`).
 */
const localizedTextSchema = z.object({
  title: z.string().trim().max(PRODUCT_UPDATE_TITLE_MAX).default(''),
  description: z
    .string()
    .trim()
    .max(PRODUCT_UPDATE_DESCRIPTION_MAX)
    .default(''),
})

const EMPTY_TEXT = { title: '', description: '' }

/** Os três idiomas, sem a imagem: o que o formulário de edição salva. */
export const productUpdateTextsSchema = z.object({
  pt: localizedTextSchema.default(EMPTY_TEXT),
  en: localizedTextSchema.default(EMPTY_TEXT),
  es: localizedTextSchema.default(EMPTY_TEXT),
})

/**
 * Formato das colunas JSON `content` e `publishedContent`. O banco não tem schema
 * para elas: este é o único ponto de parse, na escrita (casos de uso) e na leitura
 * (repositório).
 */
export const productUpdateContentSchema = productUpdateTextsSchema.extend({
  /** Chave do objeto no R2 (`product-updates/<uuid>.<ext>`); a URL sai na leitura. */
  imageKey: z.string().trim().min(1).nullable().default(null),
})

export type ProductUpdateLocalizedText = z.infer<typeof localizedTextSchema>
export type ProductUpdateTexts = z.infer<typeof productUpdateTextsSchema>
export type ProductUpdateContent = z.infer<typeof productUpdateContentSchema>

export function emptyProductUpdateContent(): ProductUpdateContent {
  return {
    pt: { ...EMPTY_TEXT },
    en: { ...EMPTY_TEXT },
    es: { ...EMPTY_TEXT },
    imageKey: null,
  }
}

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  throw new InvalidProductUpdateContentError(
    parsed.error.issues.map(issue =>
      issue.path.length
        ? `${issue.path.join('.')}: ${issue.message}`
        : issue.message,
    ),
  )
}

/** Lança `InvalidProductUpdateContentError` (`422`). */
export function parseProductUpdateTexts(raw: unknown): ProductUpdateTexts {
  return parseWith(productUpdateTextsSchema, raw)
}

/** Lança `InvalidProductUpdateContentError` (`422`). */
export function parseProductUpdateContent(raw: unknown): ProductUpdateContent {
  return parseWith(productUpdateContentSchema, raw)
}

/** Idiomas sem título ou sem descrição, na ordem pt, en, es. */
export function missingLocales(
  content: ProductUpdateContent,
): ProductUpdateLocale[] {
  return PRODUCT_UPDATE_LOCALES.filter(locale => {
    const text = content[locale]
    return !text.title.trim() || !text.description.trim()
  })
}

/**
 * Comparação profunda normalizada (trim nos textos). Conteúdo gravado já passou
 * pelo schema, mas o trim aqui garante que um registro antigo ou escrito por fora
 * não acuse diferença fantasma.
 */
export function sameProductUpdateContent(
  a: ProductUpdateContent,
  b: ProductUpdateContent,
): boolean {
  return (
    (a.imageKey ?? null) === (b.imageKey ?? null) &&
    PRODUCT_UPDATE_LOCALES.every(
      locale =>
        a[locale].title.trim() === b[locale].title.trim() &&
        a[locale].description.trim() === b[locale].description.trim(),
    )
  )
}

export function cloneProductUpdateContent(
  content: ProductUpdateContent,
): ProductUpdateContent {
  return {
    pt: { ...content.pt },
    en: { ...content.en },
    es: { ...content.es },
    imageKey: content.imageKey,
  }
}
