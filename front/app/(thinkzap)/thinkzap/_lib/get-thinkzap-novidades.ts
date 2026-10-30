import type { ThinkzapHttpClient } from '@/infra/client/axios-thinkzap'

export type ThinkzapNovidadesLocale = 'pt' | 'en' | 'es'

export type ThinkzapNovidade = {
  id: string
  title: string
  description: string
  imageUrl: string | null
  status: 'available' | 'soon'
  /** ISO; só vem em `available`. */
  availableAt?: string
}

/** Idioma do i18next (`pt`, `en-US`...) para o `locale` aceito pela rota. */
export function novidadesLocaleFor(
  language: string | undefined,
): ThinkzapNovidadesLocale {
  const base = language?.split('-')[0]
  return base === 'en' || base === 'es' ? base : 'pt'
}

/**
 * `GET /thinkzap/novidades` — novidades publicadas no idioma pedido, já
 * ordenadas: `available` (mais recente primeiro) e depois `soon`.
 */
export async function getThinkzapNovidades(
  client: ThinkzapHttpClient,
  locale: ThinkzapNovidadesLocale,
): Promise<ThinkzapNovidade[]> {
  const result = await client.get<{ items: ThinkzapNovidade[] }>(
    '/thinkzap/novidades',
    { params: { locale } },
  )
  return result.items
}
