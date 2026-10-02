import { getLpContent, tutorialsOf, type TutorialSlug } from './content'

const PREFIX = '#tutorial-'

/**
 * Slugs e chaves de variante são iguais nos dois idiomas (o teste de paridade
 * garante), então as âncoras saem da estrutura em português.
 */
const TUTORIALS = tutorialsOf(getLpContent('pt'))

/** Aba e variante; `variant` vazio é a trilha padrão (a primeira). */
export type TutorialLocation = { slug: TutorialSlug; variant: string }

export const DEFAULT_TUTORIAL: TutorialSlug = 'instalacao'

export const tutorialHash = (slug: TutorialSlug, variant = '') =>
  `${PREFIX}${slug}${variant ? `-${variant}` : ''}`

/** Todas as âncoras de tutorial: uma por aba e uma por variante. */
export const allTutorialHashes = () =>
  TUTORIALS.flatMap(tutorial => [
    tutorialHash(tutorial.slug),
    ...(tutorial.variants ?? []).map(variant =>
      tutorialHash(tutorial.slug, variant.key),
    ),
  ])

/** O hash aponta para um tutorial (conhecido ou não)? */
export const isTutorialHash = (hash: string) =>
  normalize(hash).startsWith(PREFIX)

/**
 * Aba e variante de um hash `#tutorial-<slug>` ou `#tutorial-<slug>-<variante>`.
 * Hash vazio, de outra seção ou desconhecido cai no primeiro tutorial — link
 * velho ou digitado errado ainda abre a seção num estado válido. Variante
 * desconhecida de uma aba conhecida cai na aba, na trilha padrão.
 */
export function resolveTutorialHash(hash: string): TutorialLocation {
  const value = normalize(hash)
  const fallback = { slug: DEFAULT_TUTORIAL, variant: '' }
  if (!value.startsWith(PREFIX)) return fallback
  const rest = value.slice(PREFIX.length)

  const exact = TUTORIALS.find(tutorial => tutorial.slug === rest)
  if (exact) return { slug: exact.slug, variant: '' }

  for (const tutorial of TUTORIALS) {
    if (!rest.startsWith(`${tutorial.slug}-`)) continue
    const key = rest.slice(tutorial.slug.length + 1)
    const known = tutorial.variants?.some(variant => variant.key === key)
    return { slug: tutorial.slug, variant: known ? key : '' }
  }
  return fallback
}

const normalize = (hash: string) => {
  const trimmed = hash.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}
