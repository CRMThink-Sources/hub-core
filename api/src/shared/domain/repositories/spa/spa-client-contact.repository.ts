import { SpaClientContact } from '@/shared/domain/entities/spa-client-contact'

/**
 * Leitura e escrita do contato **por id do item** da SPA 1060.
 *
 * Separado de `GetSpaRepository`/`UpdateSpaRepository`, que são keyed por
 * `(appId, domain)` e resolvem o item com uma listagem antes de escrever. Quem
 * lê ou grava contato já tem o id em mãos (`aplication.spaId`), então a listagem
 * seria uma chamada ao Bitrix para descobrir o que o chamador já sabe.
 *
 * Nenhuma das duas cria item: `GetOrCreateSpa` cria quando não encontra, e num
 * fluxo que já tem o id isso significaria um segundo item de cliente em silêncio
 * para uma instalação que já tem o seu.
 */
export interface GetSpaClientContactRepository {
  getContact(itemId: string): Promise<SpaClientContact>
}

export interface UpdateSpaClientContactRepository {
  updateContact(itemId: string, contact: SpaClientContact): Promise<void>
}
