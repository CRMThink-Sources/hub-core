/**
 * Os valores das variáveis de um template, lidos do corpo da campanha.
 *
 * Com um sender **por template**, o corpo deixa de declarar qual template é — isso já
 * está no `CODE` — e passa a carregar só os valores. O cliente monta com placeholders
 * do CRM que o Bitrix resolve antes de chamar o handler:
 *
 * ```
 * #LEAD.TITLE#;#LEAD.ID#
 * ```
 *
 * **Duas formas aceitas, e a ordem entre elas importa.** Quebra de linha vem primeiro:
 * um valor por linha é imune a `;` dentro do valor, e valor de campo de CRM contém
 * ponto e vírgula com facilidade — um título de lead basta. O `;` só é usado quando o
 * corpo tem uma linha só, que é o formato do exemplo acima.
 *
 * A consequência é a que se quer: quem escreve em várias linhas nunca é mordido por um
 * `;` no meio de um valor, e quem escreve numa linha só continua funcionando.
 */
export function parseSmsTemplateValues(body: string): string[] {
  const lines = body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0) return []

  /**
   * Mais de uma linha: cada linha é um valor, `;` incluso. Dividir aqui também por
   * ponto e vírgula quebraria o valor que legitimamente tem um.
   */
  if (lines.length > 1) return lines

  const single = lines[0] as string

  if (!single.includes(';')) return [single]

  return single
    .split(';')
    .map(value => value.trim())
    .filter(value => value.length > 0)
}
