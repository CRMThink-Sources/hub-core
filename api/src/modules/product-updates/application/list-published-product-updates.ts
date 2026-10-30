import type { ProductUpdate } from '../domain/entities/product-update'
import {
  PRODUCT_UPDATE_LOCALES,
  ProductUpdateContent,
  ProductUpdateLocale,
  ProductUpdateLocalizedText,
} from '../domain/entities/product-update-content'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import type { ProductUpdateImageUrlResolver } from './product-update-view'

/**
 * Item da aba Novidades do ThinkZap. Só o snapshot publicado, no idioma pedido —
 * nada da versão em edição, da tarefa do Bitrix ou de quem publicou.
 *
 * "Aguardando revisão" sai como `soon`: para o cliente ainda é "Em breve".
 */
export type PublishedProductUpdateItem = {
  id: string
  title: string
  description: string
  imageUrl: string | null
  status: 'soon' | 'available'
  /** Só em `available`. */
  availableAt?: Date
}

export type ListPublishedProductUpdatesOutput = {
  /** `available` primeiro (`availableAt` desc), depois `soon` (`publishedAt` desc). */
  items: PublishedProductUpdateItem[]
}

const FALLBACK_LOCALE: ProductUpdateLocale = 'pt'

export function resolveProductUpdateLocale(
  locale: unknown,
): ProductUpdateLocale {
  return (PRODUCT_UPDATE_LOCALES as readonly unknown[]).includes(locale)
    ? (locale as ProductUpdateLocale)
    : FALLBACK_LOCALE
}

/**
 * Publicar exige os três idiomas, então o fallback para `pt` é só defensivo
 * (registro antigo ou escrito por fora).
 */
function textIn(
  content: ProductUpdateContent,
  locale: ProductUpdateLocale,
): ProductUpdateLocalizedText {
  const text = content[locale]
  if (text.title.trim() && text.description.trim()) return text
  return content[FALLBACK_LOCALE]
}

const timeOf = (date: Date | null) => date?.getTime() ?? 0

type WithSnapshot = ProductUpdate & { publishedContent: ProductUpdateContent }

/** Publicada sem snapshot não deveria existir; se existir, não há o que mostrar. */
const hasSnapshot = (update: ProductUpdate): update is WithSnapshot =>
  update.publishedContent !== null

/**
 * Leitura do cliente (D10): mesma lista para todos, sem paginação nem cache — é
 * pequena. Ordenação em memória porque a chave depende da situação.
 */
export class ListPublishedProductUpdates {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {}

  async execute(locale?: unknown): Promise<ListPublishedProductUpdatesOutput> {
    const lang = resolveProductUpdateLocale(locale)
    const published = (await this.repository.listPublished()).filter(
      hasSnapshot,
    )

    const available = published
      .filter(update => update.availableAt !== null)
      .sort((a, b) => timeOf(b.availableAt) - timeOf(a.availableAt))
    const soon = published
      .filter(update => update.availableAt === null)
      .sort((a, b) => timeOf(b.publishedAt) - timeOf(a.publishedAt))

    const items = [...available, ...soon].map(
      (update): PublishedProductUpdateItem => {
        const { title, description } = textIn(update.publishedContent, lang)
        const item: PublishedProductUpdateItem = {
          id: update.id,
          title,
          description,
          imageUrl: this.imageUrl(update.publishedContent.imageKey),
          status: update.availableAt ? 'available' : 'soon',
        }
        if (update.availableAt) item.availableAt = update.availableAt
        return item
      },
    )

    return { items }
  }
}
