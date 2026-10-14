import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { envConfig } from '@/shared/infra/env-config'
import { Faq } from '../_shared/faq'
import { FinalCta, LpFooter } from '../_shared/final-cta'
import { resolveLpCtas } from '../_shared/resolve-ctas'
import { getLpContent, lpPath, resolveLpLocale } from './_components/content'
import { Features } from './_components/features'
import { Hero, LpHeader } from './_components/hero'
import { HowItWorks } from './_components/how-it-works'

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
      languages: {
        'pt-BR': lpPath('pt'),
        en: lpPath('en'),
        es: lpPath('es'),
      },
    },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: 'website',
      locale: metadata.ogLocale,
      images: [
        { url: '/images/importsheet/logo.png', width: 584, height: 270 },
      ],
    },
  }
}

export default async function ImportsheetLandingPage({ searchParams }: Props) {
  const locale = resolveLpLocale((await searchParams).lang)
  const content = getLpContent(locale)
  const ctas = resolveLpCtas({
    marketUrl: envConfig.importsheetMarketUrl,
    salesWhatsapp: envConfig.importsheetSalesWhatsapp,
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
