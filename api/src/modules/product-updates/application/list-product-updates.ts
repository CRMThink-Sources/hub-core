import type { ProductUpdateSituation } from '../domain/entities/product-update'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateListItem,
  toProductUpdateListItem,
} from './product-update-view'

export type ListProductUpdatesInput = {
  /** Sem filtro = todas. */
  situation?: ProductUpdateSituation
}

export type ListProductUpdatesOutput = {
  items: ProductUpdateListItem[]
  total: number
}

/**
 * Lista do backoffice. A situação é derivada, então o filtro é aplicado depois da
 * leitura — a lista é pequena (algumas centenas no máximo) e não pagina.
 */
export class ListProductUpdates {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(
    input: ListProductUpdatesInput = {},
  ): Promise<ListProductUpdatesOutput> {
    const items = (await this.repository.list())
      .map(toProductUpdateListItem)
      .filter(item => !input.situation || item.situation === input.situation)

    return { items, total: items.length }
  }
}
