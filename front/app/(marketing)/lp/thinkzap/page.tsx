import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { envConfig } from '@/shared/infra/env-config'
import { getLpContent, lpPath, resolveLpLocale } from './_components/content'
import { Faq } from './_components/faq'
import { Features } from './_components/features'
import { FinalCta, LpFooter } from './_components/final-cta'
import { Hero, LpHeader } from './_components/hero'
import { HowItWorks } from './_components/how-it-works'
import { resolveThinkzapCtas } from './_components/resolve-ctas'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `og:image` precisa de URL absoluta e o front não tem env com o próprio domínio:
 * a base sai do host da request (o proxy repassa `x-forwarded-*`). Sem isso o Next
 * cai em `localhost` e o preview do link quebra.
 */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const requestHeaders = await headers()
  const first = (name: string) =>
    requestHeaders.get(name)?.split(',')[0].trim() || null
  const host = first('x-forwarded-host') ?? first('host')
  const proto = first('x-forwarded-proto') ?? 'https'

  const locale = resolveLpLocale((await searchParams).lang)
  const { metadata } = getLpContent(locale)

  return {
    ...(host && URL.canParse(`${proto}://${host}`)
      ? { metadataBase: new URL(`${proto}://${host}`) }
      : {}),
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: lpPath(locale),
      languages: { 'pt-BR': lpPath('pt'), en: lpPath('en') },
    },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: 'website',
      locale: metadata.ogLocale,
      images: [{ url: '/images/thinkzap/logo.png', width: 584, height: 270 }],
    },
  }
}

/**
 * LP pública do ThinkZap. Sem sessão, BX24 ou API — as envs dos CTAs são
 * `NEXT_PUBLIC_*` e já chegam inlinadas no build. O idioma vem de `?lang=en`
 * (padrão português) e a página já sai do servidor nele.
 */
export default async function ThinkzapLandingPage({ searchParams }: Props) {
  const locale = resolveLpLocale((await searchParams).lang)
  const content = getLpContent(locale)
  const ctas = resolveThinkzapCtas({
    marketUrl: envConfig.thinkzapMarketUrl,
    salesWhatsapp: envConfig.thinkzapSalesWhatsapp,
    whatsappMessage: content.whatsappMessage,
  })

  return (
    <div lang={content.htmlLang}>
      <LpHeader marketUrl={ctas.marketUrl} content={content} />
      <main>
        <Hero {...ctas} content={content} />
        <Features copy={content.features} />
        <HowItWorks {...ctas} content={content} />
        <Faq copy={content.faq} />
        <FinalCta {...ctas} content={content} />
      </main>
      <LpFooter content={content} />
    </div>
  )
}
