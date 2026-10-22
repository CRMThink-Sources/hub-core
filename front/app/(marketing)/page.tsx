import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getHomeContent, homePath, resolveHomeLocale } from './_home/content'
import {
  HomeApps,
  HomeFinalCta,
  HomeFooter,
  HomeHeader,
  HomeHero,
  HomeWhy,
} from './_home/sections'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// og:image exige URL absoluta e não há env com o domínio: sem a base do host o Next cai em localhost.
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const requestHeaders = await headers()
  const first = (name: string) =>
    requestHeaders.get(name)?.split(',')[0].trim() || null
  const host = first('x-forwarded-host') ?? first('host')
  const proto = first('x-forwarded-proto') ?? 'https'

  const locale = resolveHomeLocale((await searchParams).lang)
  const { metadata } = getHomeContent(locale)

  return {
    ...(host && URL.canParse(`${proto}://${host}`)
      ? { metadataBase: new URL(`${proto}://${host}`) }
      : {}),
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: homePath(locale),
      languages: {
        'pt-BR': homePath('pt'),
        en: homePath('en'),
        es: homePath('es'),
      },
    },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: 'website',
      locale: metadata.ogLocale,
    },
  }
}

/**
 * A raiz do domínio é a vitrine do Think Hub: o domínio serve vários apps, então
 * a página apresenta todos e leva cada um para a LP própria em `/lp/*`.
 */
export default async function HomePage({ searchParams }: Props) {
  const locale = resolveHomeLocale((await searchParams).lang)
  const content = getHomeContent(locale)

  return (
    <div
      lang={content.htmlLang}
      className="theme-thinkhub min-h-screen bg-background text-foreground"
    >
      <HomeHeader content={content} />
      <main>
        <HomeHero content={content} />
        <HomeApps content={content} />
        <HomeWhy content={content} />
        <HomeFinalCta content={content} />
      </main>
      <HomeFooter content={content} />
    </div>
  )
}
