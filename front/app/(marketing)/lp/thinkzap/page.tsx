import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { envConfig } from '@/shared/infra/env-config'
import { Faq } from './_components/faq'
import { Features } from './_components/features'
import { FinalCta, LpFooter } from './_components/final-cta'
import { Hero, LpHeader } from './_components/hero'
import { HowItWorks } from './_components/how-it-works'
import { resolveThinkzapCtas } from './_components/resolve-ctas'

const TITLE = 'ThinkZap — WhatsApp integrado ao Bitrix24'
const DESCRIPTION =
  'Conecte o WhatsApp Web e a API oficial do WhatsApp ao Bitrix24: várias linhas, botões interativos, templates, robôs de automação e histórico no CRM.'

/**
 * `og:image` precisa de URL absoluta e o front não tem env com o próprio domínio:
 * a base sai do host da request (o proxy repassa `x-forwarded-*`). Sem isso o Next
 * cai em `localhost` e o preview do link quebra.
 */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const first = (name: string) =>
    requestHeaders.get(name)?.split(',')[0].trim() || null
  const host = first('x-forwarded-host') ?? first('host')
  const proto = first('x-forwarded-proto') ?? 'https'

  return {
    ...(host && URL.canParse(`${proto}://${host}`)
      ? { metadataBase: new URL(`${proto}://${host}`) }
      : {}),
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      type: 'website',
      locale: 'pt_BR',
      images: [{ url: '/images/thinkzap/logo.png', width: 584, height: 270 }],
    },
  }
}

/**
 * LP pública do ThinkZap. Sem sessão, BX24 ou API — as envs dos CTAs são
 * `NEXT_PUBLIC_*` e já chegam inlinadas no build.
 */
export default function ThinkzapLandingPage() {
  const ctas = resolveThinkzapCtas({
    marketUrl: envConfig.thinkzapMarketUrl,
    salesWhatsapp: envConfig.thinkzapSalesWhatsapp,
  })

  return (
    <>
      <LpHeader marketUrl={ctas.marketUrl} />
      <main>
        <Hero {...ctas} />
        <Features />
        <HowItWorks {...ctas} />
        <Faq />
        <FinalCta {...ctas} />
      </main>
      <LpFooter />
    </>
  )
}
