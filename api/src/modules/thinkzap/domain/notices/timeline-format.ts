/**
 * Peças de BBCode nativo do Bitrix para os comentários que o servidor publica na
 * timeline do CRM.
 *
 * **Dado do usuário não é marcação.** Mensagem, nome e telefone entram pelos helpers
 * abaixo, que passam o valor por `escapeBbcode`. Sem isso, um operador que digite
 * `[/quote]` ou `[url]` quebraria o layout do comentário (ou injetaria um link).
 * Títulos e rótulos são texto nosso e entram sem escape.
 */

/** Zero-width space: invisível, mas desfaz o `[tag]` sem alterar o que se lê. */
const ZERO_WIDTH_SPACE = '​'

/** Impede que o valor seja lido como BBCode: todo `[` ganha um zero-width depois. */
export function escapeBbcode(value: string): string {
  return value.replace(/\[/g, `[${ZERO_WIDTH_SPACE}`)
}

/** Título do comentário, em negrito. `title` é texto do sistema. */
export function bbTitle(title: string): string {
  return `[B]${title}[/B]`
}

/** Linha `Rótulo: valor`, com o rótulo em negrito e o valor escapado. */
export function bbField(label: string, value: string): string {
  return `[B]${label}:[/B] ${escapeBbcode(value)}`
}

/**
 * A mensagem sob o rótulo, em linha própria: o texto fica solto, sem bloco de
 * citação, que no Bitrix ganha recuo e barra lateral e pesa mais que o conteúdo.
 * Vazia não gera a linha.
 */
export function bbMessage(label: string, text: string): string | undefined {
  return text.trim() === ''
    ? undefined
    : `[B]${label}:[/B]\n${escapeBbcode(text)}`
}

/** Junta as linhas, descartando as ausentes. */
export function bbLines(lines: (string | undefined)[]): string {
  return lines.filter((line): line is string => line !== undefined).join('\n')
}
