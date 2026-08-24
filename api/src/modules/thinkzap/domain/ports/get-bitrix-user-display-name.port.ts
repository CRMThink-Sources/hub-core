/**
 * O nome do usuário e, quando ele não vem, **por que** não veio.
 *
 * `refusal` existe porque as duas ausências pedem ações diferentes: escopo
 * (`user`/`user_brief`) não concedido na instalação é ajuste na ficha do app, e
 * usuário fora do escopo do app é cadastro. Sem separar, o log diz só "nome não
 * resolvido" e o suporte não sabe onde mexer.
 */
export type BitrixUserDisplayNameLookup = {
  name: string | null
  /** Mensagem da recusa do Bitrix. Ausente quando a chamada respondeu. */
  refusal?: string
}

export interface GetBitrixUserDisplayNamePort {
  getDisplayName(userId: string): Promise<BitrixUserDisplayNameLookup>
}
