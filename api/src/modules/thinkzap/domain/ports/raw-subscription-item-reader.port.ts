/**
 * Leitura **crua** de um item da SPA de itens de assinatura (1146).
 *
 * Existe por um motivo estreito: o item criado à mão no CRM declara
 * `ufCrm93Provider` e não tem credencial nenhuma, e esse é exatamente o shape que
 * `mapBitrixSpaSubscriptionItemToSubscriptionItem` **recusa** — `resolveMetadata`
 * trata provider declarado sem credencial como incoerência, de propósito, porque em
 * toda outra leitura ele é.
 *
 * No fluxo de provisionamento de linha criada à mão ele é a entrada esperada. Ler o
 * item pelo repositório de domínio ali faria o caso normal chegar como
 * `InvalidBitrixSubscriptionItemError`, e o caso de uso teria que decidir o que fazer
 * a partir da mensagem de um erro de validação.
 *
 * A tolerância fica **confinada** a esta porta. O mapper continua estrito para todo
 * mundo, e é o que garante que um item incoerente não circule pelo runtime.
 */

/** Os quatro campos de credencial da SPA, já colapsados: vazio é ausente. */
export type RawSubscriptionItemCredentials = {
  zApiInstanceId?: string
  zApiInstanceToken?: string
  hubmessageChannelId?: string
  wabaId?: string
}

export type RawSubscriptionItem = {
  id: string
  /**
   * `ufCrm93Provider` cru, com caixa e espaços normalizados e **sem default**:
   * string vazia significa campo não preenchido, nunca `NONE`. Quem decide o que
   * fazer com valor vazio ou desconhecido é o caso de uso — a porta não interpreta.
   */
  provider: string
  credentials: RawSubscriptionItemCredentials
  /** `parentId1142`. `null` quando o campo vem vazio: item sem assinatura pai. */
  subscriptionId: string | null
  /**
   * `ufCrm93Status` traduzido, ou `null` quando o id do enum é desconhecido ou o campo
   * vem vazio.
   *
   * `null`, e não um default: o mapper estrito trata id desconhecido como erro de
   * configuração, e assumir `'active'` aqui faria item cancelado parecer ativo enquanto
   * assumir `'cancelled'` desassinaria recurso de cliente pagante. Quem lê decide — e a
   * decisão de todos os fluxos atuais é não fazer nada.
   */
  status: 'active' | 'cancelled' | null
}

export interface RawSubscriptionItemReader {
  /** `null` quando o item não existe mais — apagado entre o evento e a leitura. */
  getRawSubscriptionItem(itemId: string): Promise<RawSubscriptionItem | null>
}
