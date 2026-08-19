import { apiLogger } from '@/shared/infra/logger'

export type RobotTemplateIdentity = {
  name: string
  language: string
}

/** O que a listagem de templates da linha devolve, do que aqui interessa. */
export type TemplateBodyLookup = (input: {
  subscriptionItemId: string
  domainId: string
  appCode: string
}) => Promise<{ name: string; language: string; body: string }[]>

/**
 * Devolve os placeholders à forma canônica de duas chaves.
 *
 * O corpo que chega pela propriedade do robô vem com um par de chaves a mais —
 * `{{{1}}}` no lugar de `{{1}}`. A tela grava dois (confirmado no `current_values` do
 * portal), então o excesso entra no transporte do Bizproc até o handler.
 *
 * Normalizar na entrada e não só na substituição importa porque este corpo é
 * **persistido** na row do outbox e lido depois pelo histórico, pela conversa do canal
 * aberto e pelo aviso de falha. Guardar o corpo torto deixaria a marca do bug no
 * registro mesmo com a substituição já corrigida.
 */
function normalizePlaceholders(body: string): string {
  return body.replace(/\{{2,4}\s*([A-Za-z0-9_]+)\s*\}{2,4}/g, '{{$1}}')
}

export type ResolveRobotTemplateBodyInput = RobotTemplateIdentity & {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Corpo gravado pela tela de configuração. Vazio cai no fallback. */
  configuredBody: string
}

/**
 * O corpo do template de uma configuração de robô.
 *
 * Três vias, em ordem de custo:
 *
 * 1. **A configuração.** A tela grava o corpo junto das demais propriedades, e é isso
 *    que faz o disparo não custar uma chamada remota. Numa automação que roda em lote,
 *    consultar o catálogo por execução poria uma falha possível no caminho crítico de
 *    cada uma.
 * 2. **A listagem da linha**, por nome e idioma. Cobre a configuração feita antes de a
 *    tela existir, e a que foi salva pelo formulário nativo — ali não há de onde vir o
 *    corpo.
 * 3. **O nome do template.** Último recurso, e ainda assim o envio segue: o provider
 *    recebe o par (template, parâmetros), não o corpo. Quem fica pobre é o registro —
 *    histórico e timeline mostram o nome em vez do texto — e isso é melhor que recusar
 *    um envio que funcionaria.
 *
 * A defasagem da via 1 é aceita: template editado na Meta depois da configuração faz o
 * texto **registrado** envelhecer, não o enviado. Mesma classe de defasagem que o
 * widget já tem entre o clique e a entrega.
 */
export async function resolveRobotTemplateBody(
  input: ResolveRobotTemplateBodyInput,
  lookup: TemplateBodyLookup,
): Promise<string> {
  const configured = input.configuredBody.trim()
  if (configured) return normalizePlaceholders(input.configuredBody)

  try {
    const templates = await lookup({
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const match = templates.find(
      template =>
        template.name === input.name && template.language === input.language,
    )

    if (match?.body) return match.body
  } catch (error) {
    /**
     * Falha de catálogo não recusa o envio: o corpo é para o registro, e o provider
     * não depende dele. Fica o log para explicar o histórico pobre depois.
     */
    apiLogger.warn(
      {
        app: 'thinkzap',
        subscriptionItemId: input.subscriptionItemId,
        templateName: input.name,
        err: error,
      },
      'não foi possível ler o corpo do template para o registro do robô',
    )
  }

  return input.name
}
