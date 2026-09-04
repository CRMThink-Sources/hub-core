/**
 * Texto do campo → lista de sinônimos da opção.
 *
 * `undefined` quando não sobra nada: o campo é opcional no schema, e gravar `[]` faria
 * todo fluxo salvo carregar uma lista vazia por opção. Vírgula é o separador porque é o
 * que o operador digita naturalmente; item vazio (`"a,,b"`) sai fora em vez de virar um
 * sinônimo que casaria resposta em branco.
 *
 * Acento e caixa ficam como digitados — normalizar é do motor (`normalizeAnswer`), e
 * guardar já normalizado esconderia do operador o que ele escreveu.
 */
export function parseAliases(texto: string): string[] | undefined {
  const itens = texto
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)

  return itens.length > 0 ? itens : undefined
}
