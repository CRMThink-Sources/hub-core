import { env } from '@/config/env'
import { AplicationTitleReader } from '@/modules/application/domain/repositories/aplication.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Limite de itens que uma `crm.item.list` devolve. `BitrixClient` não expõe
 * `start`, então nada de paginar: o jeito de ler N ids é fatiar em lotes desse
 * tamanho e fazer uma chamada por lote.
 */
const BATCH_SIZE = 50

/**
 * Lê o `title` dos itens da SPA de aplicação (1060) em lote.
 *
 * Nunca lança: título é enfeite de leitura, e `core_apps` — que é a fonte de
 * verdade da instalação — já respondeu. Id sem título no `Map` devolvido é o
 * sinal para o repositório cair no nome do app.
 */
export class BitrixAplicationTitleReader implements AplicationTitleReader {
  constructor(private readonly bitrix: BitrixClient) {}

  async getTitlesBySpaIds(spaIds: string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>()
    if (spaIds.length === 0) return titles

    // Ids repetidos viriam de aplicações distintas apontando para o mesmo item,
    // o que a restrição única impede — mas deduplicar é barato e evita lote
    // maior que o necessário.
    const uniqueIds = [...new Set(spaIds)]

    for (let start = 0; start < uniqueIds.length; start += BATCH_SIZE) {
      const batch = uniqueIds.slice(start, start + BATCH_SIZE)
      await this.collectBatch(batch, titles)
    }

    return titles
  }

  private async collectBatch(
    batch: string[],
    titles: Map<string, string>,
  ): Promise<void> {
    let items: unknown[]

    try {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.aplicationEntityType,
        { '@id': batch },
        { select: ['id', 'title'] },
      )
      items = response.result?.items ?? []
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', spaIds: batch, error },
        'Leitura de títulos da SPA de aplicação falhou — usando fallback',
      )
      return
    }

    for (const item of items) {
      const { id, title } = item as { id?: unknown; title?: unknown }
      // O Bitrix devolve o id como número; qualquer outro tipo é resposta que o
      // `Map` não saberia indexar.
      if (typeof id !== 'string' && typeof id !== 'number') continue

      // Título ausente e título vazio são o mesmo caso: não entra no `Map`, e
      // quem consome cai no nome do app.
      if (typeof title !== 'string' || title.trim().length === 0) continue

      titles.set(String(id), title.trim())
    }
  }
}
