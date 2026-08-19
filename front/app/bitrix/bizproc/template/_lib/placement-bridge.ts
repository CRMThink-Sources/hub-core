/**
 * A ponte com o slider de configuração do robô.
 *
 * Tudo que fala `BX24` fica aqui para o resto da tela continuar testável sem
 * `window` — o `placement.info()` e o `callMethod` são callback-based, e espalhá-los
 * pelo componente faria cada campo carregar um `Promise` improvisado.
 */

import {
  resolveFieldsQuery,
  toDocumentFields,
  type DocumentField,
} from './document-fields'

export type { DocumentField } from './document-fields'

export type PlacementContext = {
  /** `['crm', 'CCrmDocumentDeal', 'DEAL']` — o que identifica o tipo de documento. */
  documentType: string[]
  /** Valores já gravados nas propriedades do robô. */
  storedProperties: Record<string, unknown>
  /**
   * Campos do documento que o próprio placement entrega em `document_fields`.
   *
   * É a fonte preferida: são os campos **do bizproc**, com o id que a expressão usa e o
   * nome que o portal mostra, sem depender de escopo de CRM nem de traduzir o tipo de
   * documento em método REST. Vazio em portal que não manda a chave — daí a reserva.
   */
  documentFields: DocumentField[]
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
    documentFields: toDocumentFields(parseMaybeJson(options.document_fields)),
  }
}

/** `document_fields` chega como objeto ou como JSON em string, igual aos outros. */
function parseMaybeJson(value: unknown): unknown {
  return typeof value === 'string' ? tryParseJson(value) : value
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
 * Não existe método REST que descreva os campos de um tipo de documento de bizproc —
 * `bizproc.document.fields` responde `ERROR_METHOD_NOT_FOUND`. Quem responde é a
 * entidade, e `resolveFieldsQuery` traduz o `document_type` no método de campos dela.
 *
 * Tipo de documento que não sabemos consultar resolve para lista vazia em vez de erro:
 * o robô é registrado sem `FILTER` e aparece também fora do CRM, e lá a tela segue
 * utilizável no modo literal.
 */
export function fetchDocumentFields(
  documentType: string[],
): Promise<DocumentField[]> {
  return new Promise(resolve => {
    const callMethod = window.BX24?.callMethod
    const query = resolveFieldsQuery(documentType)

    if (!callMethod || !query) {
      resolve([])
      return
    }

    callMethod(query.method, query.params, result => {
      const payload = result

      if (payload.error?.()) {
        resolve([])
        return
      }

      resolve(toDocumentFields(payload.data?.()))
    })
  })
}
