import type {
  TemplateCategory,
  TemplateComponent,
} from '@/app/hooks/use-connector-templates'
import { isHttpsUrl } from '@/app/(widgets)/layouts/template-variables'

/**
 * Espelho de `api/src/modules/thinkzap/domain/template-header.ts` — mesmas regras
 * e mesmos códigos de violação. A API ainda baixa a imagem e confere tamanho e
 * tipo; isso não acontece aqui (o front não baixa a imagem).
 */
export type TemplateHeaderChoice = 'NONE' | 'IMAGE'

export type TemplateHeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'UNSUPPORTED'

const META_CDN_DOMAINS = ['whatsapp.net', 'fbcdn.net', 'fbsbx.com']

/** Lê o cabeçalho de um template do catálogo, como `templateHeaderOf` da API. */
export function templateHeaderOf(
  components: TemplateComponent[],
): TemplateHeaderType {
  const header = components.find(c => c.type === 'HEADER')
  if (!header) return 'NONE'

  const format = typeof header.format === 'string' ? header.format : 'TEXT'
  switch (format.toUpperCase()) {
    case 'TEXT': {
      const text = typeof header.text === 'string' ? header.text : ''
      return text.includes('{{') ? 'UNSUPPORTED' : 'TEXT'
    }
    case 'IMAGE':
      return 'IMAGE'
    default:
      return 'UNSUPPORTED'
  }
}

export type TemplateHeaderViolationCode =
  | 'header_not_allowed'
  | 'example_required'
  | 'example_not_https'
  | 'example_meta_cdn'
  | 'file_required'
  | 'file_too_large'
  | 'file_invalid_type'

/** De onde vem a imagem de exemplo: arquivo enviado (upload) ou link público. */
export type TemplateHeaderSource = 'FILE' | 'LINK'

/** Teto da Meta para imagem de cabeçalho — o mesmo da API. */
export const HEADER_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const HEADER_IMAGE_TYPES = ['image/jpeg', 'image/png']

/** Cabeçalho só existe fora de Autenticação. */
export function headerAllowed(category: TemplateCategory): boolean {
  return category !== 'AUTHENTICATION'
}

/** Valida o cabeçalho escolhido no formulário; `null` é válido. */
export function validateTemplateHeader(
  choice: TemplateHeaderChoice,
  imageUrl: string,
  category: TemplateCategory,
): TemplateHeaderViolationCode | null {
  if (choice === 'NONE') return null
  if (!headerAllowed(category)) return 'header_not_allowed'

  const url = imageUrl.trim()
  if (!url) return 'example_required'
  if (!isHttpsUrl(url)) return 'example_not_https'
  if (isMetaCdnUrl(url)) return 'example_meta_cdn'
  return null
}

/**
 * Valida o arquivo escolhido como imagem de exemplo; `null` é válido. O tipo aqui
 * é o que o navegador informa — a API confere de novo pelo conteúdo do arquivo.
 */
export function validateTemplateHeaderFile(
  choice: TemplateHeaderChoice,
  file: { type: string; size: number } | null,
  category: TemplateCategory,
): TemplateHeaderViolationCode | null {
  if (choice === 'NONE') return null
  if (!headerAllowed(category)) return 'header_not_allowed'
  if (!file) return 'file_required'
  if (!HEADER_IMAGE_TYPES.includes(file.type)) return 'file_invalid_type'
  if (file.size > HEADER_IMAGE_MAX_BYTES) return 'file_too_large'
  return null
}

function isMetaCdnUrl(value: string): boolean {
  let host: string
  try {
    host = new URL(value).hostname.toLowerCase()
  } catch {
    return false
  }
  return META_CDN_DOMAINS.some(
    domain => host === domain || host.endsWith(`.${domain}`),
  )
}

/**
 * Componente neutro de cabeçalho de imagem, como a API de criação espera. Com
 * arquivo, o componente vai sem `example`: a imagem segue à parte, no multipart.
 */
export function buildHeaderComponent(
  choice: TemplateHeaderChoice,
  source: TemplateHeaderSource,
  imageUrl: string,
): TemplateComponent | null {
  if (choice !== 'IMAGE') return null
  if (source === 'FILE') return { type: 'HEADER', format: 'IMAGE' }
  return {
    type: 'HEADER',
    format: 'IMAGE',
    example: { imageUrl: imageUrl.trim() },
  }
}
