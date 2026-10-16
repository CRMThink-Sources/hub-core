import type { TemplateButtonParameter } from '@/modules/thinkzap/domain/ports/template-message-sender.port'
import type { TemplateButtonSummary } from '@/modules/thinkzap/domain/template-buttons'
import type { RobotTemplateIdentity } from './resolve-robot-template-body'

/** O que a listagem de templates da linha devolve, do que aqui interessa. */
export type TemplateButtonsLookup = (input: {
  subscriptionItemId: string
  domainId: string
  appCode: string
}) => Promise<
  { name: string; language: string; buttons: TemplateButtonSummary[] }[]
>

export type ResolveRobotButtonParametersInput = RobotTemplateIdentity & {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Valores gravados pela tela, na ordem dos botões dinâmicos do template. */
  values: string[]
}

/** Algum botão dinâmico ficou sem valor, ou o template não está no catálogo. */
export type MissingButtonValues = { missing: true }

/**
 * Amarra os valores do robô aos botões dinâmicos do template.
 *
 * O Bitrix guarda só a ordem dos valores; o `index` que a Meta exige é a posição do
 * botão entre **todos** os botões, e só o catálogo sabe qual é. Por isso a consulta
 * acontece aqui, e só quando há valor: robô sem valores (configurado antes dos
 * botões, ou com template sem botão dinâmico) não custa chamada remota nem manda
 * botão — se o template exigia um, a recusa vem da Meta, como antes.
 *
 * Valor a mais é ignorado (template trocado por outro com menos botões); valor a
 * menos ou vazio recusa — mandar link sem o final ou cupom sem código seria pior que
 * não mandar. Falha do catálogo propaga: sem ela não há como saber o `index`.
 */
export async function resolveRobotButtonParameters(
  input: ResolveRobotButtonParametersInput,
  lookup: TemplateButtonsLookup,
): Promise<TemplateButtonParameter[] | MissingButtonValues> {
  if (!input.values.some(value => value.trim())) return []

  const templates = await lookup({
    subscriptionItemId: input.subscriptionItemId,
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const template = templates.find(
    candidate =>
      candidate.name === input.name && candidate.language === input.language,
  )
  if (!template) return { missing: true }

  const dynamic = template.buttons.filter(button => button.dynamic)
  const parameters: TemplateButtonParameter[] = []

  for (const [position, button] of dynamic.entries()) {
    const value = input.values[position]?.trim()
    if (!value) return { missing: true }

    parameters.push({
      index: button.index,
      subType: button.type === 'COPY_CODE' ? 'COPY_CODE' : 'URL',
      value,
    })
  }

  return parameters
}
