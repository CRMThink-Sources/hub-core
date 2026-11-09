import type { WidgetTemplate } from '@/app/hooks/use-widget-templates'

/**
 * Minúsculas, sem acento e com espaços colapsados — a base da busca de template.
 * `NFD` separa o acento da letra; o intervalo removido são as marcas combinantes.
 */
export const normalizeSearchText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Se o template casa com a busca: todas as palavras precisam aparecer, em qualquer
 * ordem, no conjunto nome + idioma + corpo. Busca vazia casa com tudo.
 */
export const templateMatchesQuery = (
  template: Pick<WidgetTemplate, 'name' | 'language' | 'body'>,
  query: string,
): boolean => {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalizeSearchText(
    `${template.name} ${template.language} ${template.body}`,
  )
  return terms.every(term => haystack.includes(term))
}

export const filterTemplates = <
  T extends Pick<WidgetTemplate, 'name' | 'language' | 'body'>,
>(
  templates: T[],
  query: string,
): T[] => templates.filter(template => templateMatchesQuery(template, query))

/** Trecho do corpo em uma linha, para a descrição do item da lista. */
export const templateSnippet = (body: string, max = 80): string => {
  const oneLine = body.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max).trimEnd()}…` : oneLine
}
