import type {
  TemplateCategory,
  TemplateComponent,
} from './ports/whatsapp-template-provider.port'

/**
 * Tipo de cabeçalho de um template, como o catálogo de envio precisa.
 *
 * `UNSUPPORTED` é o cabeçalho que o ThinkZap não sabe preencher no envio (vídeo,
 * documento, localização, texto com variável): o template sai do catálogo de envio.
 */
export type TemplateHeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'UNSUPPORTED'

/**
 * Cabeçalho de imagem no formato **neutro** de criação: a URL pública de exemplo.
 * O adapter do provider traduz para o formato dele (na HubMessage,
 * `example.header_handle`) — trocar link por upload muda só o adapter.
 */
export type TemplateImageHeaderComponent = {
  type: 'HEADER'
  format: 'IMAGE'
  example: { imageUrl: string }
}

/**
 * Domínios do CDN da Meta. Link deles, copiado de um template existente, a Meta
 * recusa como amostra (`2388215 invalid media sample`).
 */
export const META_CDN_DOMAINS = ['whatsapp.net', 'fbcdn.net', 'fbsbx.com']

const HEADER_VARIABLE = /\{\{/

/** Lê o cabeçalho de um template do catálogo (vindo ao vivo da Meta). */
export function templateHeaderOf(
  components: TemplateComponent[],
): TemplateHeaderType {
  const header = components.find(c => c.type === 'HEADER')
  if (!header) return 'NONE'

  // Cabeçalho de texto pode vir sem `format` em template antigo.
  const format = typeof header.format === 'string' ? header.format : 'TEXT'
  switch (format.toUpperCase()) {
    case 'TEXT': {
      const text = typeof header.text === 'string' ? header.text : ''
      return HEADER_VARIABLE.test(text) ? 'UNSUPPORTED' : 'TEXT'
    }
    case 'IMAGE':
      return 'IMAGE'
    default:
      return 'UNSUPPORTED'
  }
}

/** URL `https` válida. */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

/** Host igual a um domínio do CDN da Meta ou subdomínio dele. */
export function isMetaCdnUrl(value: string): boolean {
  let host: string
  try {
    host = new URL(value.trim()).hostname.toLowerCase()
  } catch {
    return false
  }
  return META_CDN_DOMAINS.some(
    domain => host === domain || host.endsWith(`.${domain}`),
  )
}

export type TemplateHeaderViolation = {
  code:
    | 'header_not_allowed'
    | 'too_many_headers'
    | 'unsupported_format'
    | 'example_required'
    | 'example_not_https'
    | 'example_meta_cdn'
}

/**
 * Valida o cabeçalho de um template novo. Só cabeçalho de imagem é criado pelo
 * ThinkZap, e nunca em Autenticação. Devolve todas as violações; vazio é válido.
 */
export function validateTemplateHeader(
  components: TemplateComponent[],
  category: TemplateCategory,
): TemplateHeaderViolation[] {
  const headers = components.filter(c => c.type === 'HEADER')
  if (headers.length === 0) return []
  if (category === 'AUTHENTICATION') return [{ code: 'header_not_allowed' }]
  if (headers.length > 1) return [{ code: 'too_many_headers' }]

  const [header] = headers
  if (header?.format !== 'IMAGE') return [{ code: 'unsupported_format' }]

  const example = (header.example ?? {}) as Record<string, unknown>
  const imageUrl =
    typeof example.imageUrl === 'string' ? example.imageUrl.trim() : ''
  if (!imageUrl) return [{ code: 'example_required' }]
  if (!isHttpsUrl(imageUrl)) return [{ code: 'example_not_https' }]
  if (isMetaCdnUrl(imageUrl)) return [{ code: 'example_meta_cdn' }]
  return []
}

/** URL de exemplo do cabeçalho de imagem de um template novo, se houver. */
export function headerImageExampleOf(
  components: TemplateComponent[],
): string | undefined {
  const header = components.find(
    c => c.type === 'HEADER' && c.format === 'IMAGE',
  )
  const example = (header?.example ?? {}) as Record<string, unknown>
  return typeof example.imageUrl === 'string'
    ? example.imageUrl.trim()
    : undefined
}
