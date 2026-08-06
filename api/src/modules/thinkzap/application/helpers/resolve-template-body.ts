/**
 * Placeholder de variável de template: `{{1}}`, `{{nome}}`, com ou sem espaços
 * internos. Mesma expressão usada no front para gerar os campos — se as duas
 * divergirem, o preview mostra um texto e o histórico guarda outro.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

/**
 * Substitui os placeholders do corpo pelos valores informados, **por ordem de
 * aparição**.
 *
 * Nomes repetidos recebem o mesmo valor: o front oferece um campo por nome
 * distinto, então `Olá {{nome}}, tudo bem {{nome}}?` consome um parâmetro só. É a
 * ordem das chaves **distintas** que indexa os valores — não a de cada ocorrência.
 *
 * Existe para o registro e para a notificação: o que vai ao provider é o par
 * (template, parâmetros), e o que o histórico precisa mostrar é o texto que o
 * contato leu. Reconstruir isso depois, a partir do template cru, exigiria
 * consultar o catálogo do provider a cada leitura de histórico.
 *
 * Parâmetro ausente para um placeholder deixa o placeholder **como está**, em vez
 * de virar string vazia: o texto fica visivelmente incompleto em vez de
 * silenciosamente errado. O front não permite chegar aqui assim, e o provider
 * recusaria o envio de qualquer modo — este é o comportamento de última linha.
 */
export function resolveTemplateBody(
  body: string,
  parameters: readonly string[],
): string {
  const order: string[] = []

  body.replace(PLACEHOLDER, (match, key: string) => {
    if (!order.includes(key)) order.push(key)
    return match
  })

  return body.replace(PLACEHOLDER, (match, key: string) => {
    const index = order.indexOf(key)
    const value = parameters[index]
    return value === undefined ? match : value
  })
}
