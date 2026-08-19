/**
 * A ponte com o slider de configuração do robô.
 *
 * Tudo que fala `BX24` fica aqui para o resto da tela continuar testável sem
 * `window` — o `placement.info()` e o `callMethod` são callback-based, e espalhá-los
 * pelo componente faria cada campo carregar um `Promise` improvisado.
 */

/** Campo do documento, como `bizproc.document.fields` devolve. */
export type DocumentField = {
  id: string
  title: string
  type: string
  multiple: boolean
}

export type PlacementContext = {
  /** `['crm', 'CCrmDocumentDeal', 'DEAL']` — o que identifica o tipo de documento. */
  documentType: string[]
  /** Valores já gravados nas propriedades do robô. */
  storedProperties: Record<string, unknown>
}

/**
 * Lê o contexto do placement.
 *
 * O Bitrix não é consistente sobre onde põe os valores atuais entre versões: já
 * apareceram em `current_values`, em `properties` e soltos no próprio `options`, às
 * vezes como JSON em string. A leitura é tolerante às três formas em vez de assumir
 * uma — errar aqui abriria a tela em branco sobre uma automação já configurada, e o
 * usuário reconfiguraria tudo sem saber que perdeu o que tinha.
 */
export function readPlacementContext(): PlacementContext | null {
  const info = window.BX24?.placement?.info?.()
  if (!info) return null

  const options = (info.options ?? {}) as Record<string, unknown>

  return {
    documentType: parseDocumentType(options.document_type),
    storedProperties: parseStored(options),
  }
}

function parseDocumentType(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item))

  if (typeof value === 'string' && value) {
    const parsed = tryParseJson(value)
    if (Array.isArray(parsed)) return parsed.map(item => String(item))
  }

  return []
}

function parseStored(
  options: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of ['current_values', 'properties', 'CURRENT_VALUES']) {
    const candidate = options[key]
    const parsed =
      typeof candidate === 'string' ? tryParseJson(candidate) : candidate

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  }

  return options
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * Grava uma propriedade na configuração do robô.
 *
 * Não há rota REST para escrever a configuração de uma instância de automação: o
 * único caminho é este comando do placement, e a persistência acontece quando o
 * usuário salva o robô no slider.
 */
export function setPropertyValue(
  properties: Record<string, string | string[]>,
): void {
  window.BX24?.placement?.call?.('setPropertyValue', properties)
}

/**
 * Campos do tipo de documento onde a automação está configurada.
 *
 * Lidos por `bizproc.document.fields`, um método REST documentado, em vez de um
 * comando de seleção de campo do placement: o método existe igual em toda versão do
 * Bitrix que roda robôs, enquanto os comandos do placement variam entre versões — e
 * um seletor que some no portal do cliente deixaria a tela sem a metade que o
 * formulário nativo faz de graça.
 */
export function fetchDocumentFields(
  documentType: string[],
): Promise<DocumentField[]> {
  return new Promise(resolve => {
    const callMethod = window.BX24?.callMethod
    if (!callMethod || documentType.length === 0) {
      resolve([])
      return
    }

    callMethod(
      'bizproc.document.fields',
      { document_type: documentType },
      result => {
        const payload = result

        if (payload.error?.()) {
          resolve([])
          return
        }

        resolve(toDocumentFields(payload.data?.()))
      },
    )
  })
}

/**
 * `bizproc.document.fields` devolve um mapa `{ ID: { Name, Type, Multiple } }`. As
 * chaves entram como `id` porque é o `id` que compõe a expressão gravada.
 */
export function toDocumentFields(data: unknown): DocumentField[] {
  if (!data || typeof data !== 'object') return []

  return Object.entries(data as Record<string, unknown>)
    .map(([id, raw]) => {
      const field = (raw ?? {}) as Record<string, unknown>

      return {
        id,
        title: typeof field.Name === 'string' ? field.Name : id,
        type: typeof field.Type === 'string' ? field.Type : 'string',
        multiple: field.Multiple === true || field.Multiple === 'Y',
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}
