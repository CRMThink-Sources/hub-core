/**
 * O texto da pergunta parece já trazer a lista de opções digitada à mão?
 *
 * O motor numera as opções e as anexa à pergunta (`askText`), então digitá-las também no
 * texto manda a lista duas vezes ao cliente:
 *
 * ```
 * No que posso ajudar?
 * 1 - Financeiro     ← digitado no texto
 * 2 - Suporte
 *
 * 1 · Financeiro     ← gerado pelo motor
 * 2 · Suporte
 * ```
 *
 * Duas linhas em sequência abrindo com numeração, e não uma: "1 hora de espera" no meio de
 * uma frase não é lista, e avisar ali seria alarme falso. Separadores cobertos são os que
 * o operador digita — `1 - x`, `1) x`, `1. x`, `1 · x`, `1: x` — e a numeração não precisa
 * ser sequencial: quem digitou `1` e `3` também duplicou.
 */
export function questionHasInlineOptions(texto: string): boolean {
  const numeradas = texto
    .split('\n')
    .map(linha => linha.trim())
    .filter(linha => /^\d{1,2}\s*[-—–).:·]\s*\S/.test(linha))

  return numeradas.length >= 2
}
