import type {
  WidgetTemplate,
  WidgetTemplateButton,
} from '@/app/hooks/use-widget-templates'

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

/** Botões que pedem valor no envio (link com variável e copiar código). */
export function dynamicButtons(
  buttons: WidgetTemplateButton[] | undefined,
): WidgetTemplateButton[] {
  return (buttons ?? []).filter(button => button.dynamic)
}

/** Todo botão dinâmico com valor (só espaço não conta). Chave: `index` do botão. */
export function hasAllButtonValues(
  buttons: WidgetTemplateButton[] | undefined,
  values: Record<number, string>,
): boolean {
  return dynamicButtons(buttons).every(
    button => (values[button.index] ?? '').trim().length > 0,
  )
}

/** URL `https` válida — a única que a Meta baixa como imagem de cabeçalho. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

/** O template exige a imagem do cabeçalho no envio. */
export function needsHeaderImage(
  template: Pick<WidgetTemplate, 'header'> | undefined,
): boolean {
  return template?.header?.type === 'IMAGE'
}

/**
 * A imagem do cabeçalho está ok para enviar: template sem imagem não pede nada;
 * com imagem, exige URL `https`.
 */
export function hasRequiredHeaderImage(
  template: Pick<WidgetTemplate, 'header'> | undefined,
  imageUrl: string,
): boolean {
  return !needsHeaderImage(template) || isHttpsUrl(imageUrl)
}

/** Teto da Meta para imagem de cabeçalho — o mesmo da API. */
export const WIDGET_HEADER_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const WIDGET_HEADER_IMAGE_TYPES = ['image/jpeg', 'image/png']

/**
 * Motivo para recusar o arquivo escolhido antes de subir, ou `null` se serve. O
 * tipo aqui é o que o navegador informa; a API confere de novo pelo conteúdo.
 */
export function widgetHeaderImageFileError(file: {
  type: string
  size: number
}): string | null {
  if (!WIDGET_HEADER_IMAGE_TYPES.includes(file.type)) {
    return 'A imagem precisa ser JPEG ou PNG.'
  }
  if (file.size > WIDGET_HEADER_IMAGE_MAX_BYTES) {
    return 'A imagem passa de 5 MB.'
  }
  return null
}

/**
 * Pode enviar o template: variáveis, botões e — se o template pede imagem — uma URL
 * `https` pronta. Com arquivo, a URL só existe depois do upload, então upload em
 * andamento ou com falha bloqueia o envio.
 */
export function canSendWidgetTemplate(input: {
  template: Pick<WidgetTemplate, 'body' | 'buttons' | 'header'>
  values: Record<string, string>
  buttonValues: Record<number, string>
  headerImageUrl: string
  headerImageUploading: boolean
}): boolean {
  return (
    !input.headerImageUploading &&
    hasAllTemplateVariables(input.template.body, input.values) &&
    hasAllButtonValues(input.template.buttons, input.buttonValues) &&
    hasRequiredHeaderImage(input.template, input.headerImageUrl)
  )
}

/** O `buttonParameters` do envio: um item por botão dinâmico, amarrado ao `index`. */
export function templateButtonParameters(
  buttons: WidgetTemplateButton[] | undefined,
  values: Record<number, string>,
): { index: number; subType: 'URL' | 'COPY_CODE'; value: string }[] {
  return dynamicButtons(buttons).map(button => ({
    index: button.index,
    subType: button.type === 'COPY_CODE' ? 'COPY_CODE' : 'URL',
    value: (values[button.index] ?? '').trim(),
  }))
}
