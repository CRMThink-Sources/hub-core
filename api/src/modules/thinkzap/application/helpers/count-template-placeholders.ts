/**
 * Mesmo padrão de `resolveTemplateBody` — as duas expressões têm de casar, senão a
 * contagem recusaria um corpo que a substituição aceitaria.
 */
const PLACEHOLDER = /\{{2,4}\s*([A-Za-z0-9_]+)\s*\}{2,4}/g

/**
 * Quantos parâmetros um corpo de template consome.
 *
 * Conta placeholders **distintos**, não ocorrências: `Olá {{nome}}, tudo bem
 * {{nome}}?` consome um parâmetro só, exatamente como `resolveTemplateBody` substitui.
 * Contar ocorrências faria a campanha ser recusada por "esperava 2, recebeu 1" num
 * corpo que o envio aceitaria.
 */
export function countTemplatePlaceholders(body: string): number {
  const distinct = new Set<string>()

  body.replace(PLACEHOLDER, (match, key: string) => {
    distinct.add(key)
    return match
  })

  return distinct.size
}
