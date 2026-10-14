import type { Tutorial } from './content'

const PREFIX = '#tutorial-'

// O header da LP aponta para `#tutoriais`.
export const TUTORIALS_SECTION_ID = 'tutoriais'

/** `variant` vazio é a trilha padrão (a primeira). */
export type TutorialLocation<Slug extends string = string> = {
  slug: Slug
  variant: string
}

export const tutorialHash = (slug: string, variant = '') =>
  `${PREFIX}${slug}${variant ? `-${variant}` : ''}`

export const isTutorialHash = (hash: string) =>
  normalize(hash).startsWith(PREFIX)

// Slugs e variantes são iguais nos idiomas, então qualquer idioma serve para montar.
export function createTutorialHash<Slug extends string>(
  tutorials: Tutorial<string, Slug>[],
  defaultSlug: Slug = tutorials[0].slug,
) {
  const allTutorialHashes = () =>
    tutorials.flatMap(tutorial => [
      tutorialHash(tutorial.slug),
      ...(tutorial.variants ?? []).map(variant =>
        tutorialHash(tutorial.slug, variant.key),
      ),
    ])

  // Hash desconhecido cai no tutorial padrão: link velho ou digitado errado ainda abre num estado válido.
  function resolveTutorialHash(hash: string): TutorialLocation<Slug> {
    const value = normalize(hash)
    const fallback = { slug: defaultSlug, variant: '' }
    if (!value.startsWith(PREFIX)) return fallback
    const rest = value.slice(PREFIX.length)

    const exact = tutorials.find(tutorial => tutorial.slug === rest)
    if (exact) return { slug: exact.slug, variant: '' }

    for (const tutorial of tutorials) {
      if (!rest.startsWith(`${tutorial.slug}-`)) continue
      const key = rest.slice(tutorial.slug.length + 1)
      const known = tutorial.variants?.some(variant => variant.key === key)
      return { slug: tutorial.slug, variant: known ? key : '' }
    }
    return fallback
  }

  return {
    DEFAULT_TUTORIAL: defaultSlug,
    tutorialHash: tutorialHash as (slug: Slug, variant?: string) => string,
    isTutorialHash,
    allTutorialHashes,
    resolveTutorialHash,
  }
}

const normalize = (hash: string) => {
  const trimmed = hash.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}
