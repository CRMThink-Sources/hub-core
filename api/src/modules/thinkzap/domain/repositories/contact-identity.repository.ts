/**
 * Uma linha do mapa `lid ↔ telefone` de um contato numa instância Z-API.
 *
 * `phone` nulo é estado permanente e correto, não pendência: contato que nunca expôs o
 * número não tem telefone a descobrir, porque `lid` → telefone é impossível.
 */
export type ContactIdentityRecord = {
  instanceId: string
  lid: string
  phone: string | null
  /**
   * Identidade que este contato já usa numa sessão de canal aberto criada antes da
   * mudança para LID. Preenchida só pelo backfill; presente = o `chat.id` dele não muda.
   */
  legacyPhoneIdentity: string | null
}

/**
 * O mapa de identidade de contato.
 *
 * **É cache, não oráculo.** Ele devolve o que aprendeu — de um evento que trouxe
 * telefone e LID juntos, ou de uma consulta a `phone-exists`. Não deriva nada, e em
 * particular não converte LID em telefone: o WhatsApp não permite essa direção.
 */
export interface ContactIdentityRepository {
  findByLid(
    instanceId: string,
    lid: string,
  ): Promise<ContactIdentityRecord | null>

  findByPhone(
    instanceId: string,
    phone: string,
  ): Promise<ContactIdentityRecord | null>

  /**
   * Grava o par aprendido.
   *
   * **Nunca escreve `legacyPhoneIdentity`.** Essa coluna é do backfill, e só dele: se o
   * runtime pudesse preenchê-la, um contato novo seria promovido a legado e ficaria
   * preso numa identidade de telefone que nunca teve sessão nenhuma.
   *
   * `phone` ausente não apaga um telefone já conhecido — um evento lid-only depois de
   * um evento com número não pode fazer o mapa esquecer o que sabia.
   */
  upsertPair(input: {
    instanceId: string
    lid: string
    phone?: string | null
  }): Promise<void>
}
