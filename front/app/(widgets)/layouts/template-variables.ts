/**
 * Placeholder de variável de template: `{{1}}`, `{{nome}}`, com ou sem espaços
 * internos.
 *
 * **A mesma expressão vive em `api/.../helpers/resolve-template-body.ts`**, que
 * resolve o corpo para o histórico e para a notificação. Se as duas divergirem, o
 * operador vê um preview e o CRM guarda outro texto.
 *
 * De 2 a 4 chaves de cada lado, e não exatamente 2: corpo vindo da propriedade de um
 * robô de Bizproc chega com um par a mais (`{{{1}}}`). Casando só o par interno, a
 * substituição deixava as externas no texto (`Ola {Joao}`).
 */
const PLACEHOLDER = /\{{2,4}\s*([A-Za-z0-9_]+)\s*\}{2,4}/g

/**
 * Chaves das variáveis do corpo, **na ordem de aparição** e sem repetição.
 *
 * A ordem de aparição é o que faz template `POSITIONAL` (`{{1}}`) e `NAMED`
 * (`{{nome}}`) colapsarem no mesmo tratamento: o provider consome os parâmetros
 * por posição nos dois casos.
 *
 * Dedupe porque `Olá {{nome}}, tudo bem {{nome}}?` é **um** campo para o operador
 * preencher, não dois.
 */
export function extractTemplateVariables(body: string): string[] {
  const keys: string[] = []

  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1]
    if (key && !keys.includes(key)) keys.push(key)
  }

  return keys
}

/**
 * Preview do texto final. Variável ainda não preenchida mantém o placeholder — o
 * operador vê o que falta em vez de um buraco no meio da frase.
 */
export function resolveTemplatePreview(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(PLACEHOLDER, (match, key: string) => {
    const value = values[key]
    return value === undefined || value === '' ? match : value
  })
}

/** Valores na ordem que o envio espera — a mesma de `extractTemplateVariables`. */
export function orderedTemplateParameters(
  body: string,
  values: Record<string, string>,
): string[] {
  return extractTemplateVariables(body).map(key => values[key] ?? '')
}

/** Todas as variáveis preenchidas (só espaço não conta). */
export function hasAllTemplateVariables(
  body: string,
  values: Record<string, string>,
): boolean {
  return extractTemplateVariables(body).every(
    key => (values[key] ?? '').trim().length > 0,
  )
}
