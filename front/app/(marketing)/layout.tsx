import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

/**
 * Layout das páginas públicas de marketing. Server component e sem nenhum
 * provider do app: nada aqui depende de sessão, token ou BX24.
 *
 * Usa `theme-thinkzap` para herdar os tokens de cor da marca (`--primary` etc.)
 * em vez de repetir cor fixa. Quando entrar LP de outro app, o tema passa a vir
 * do layout da própria LP.
 *
 * Sem `lang` aqui: o layout não conhece `?lang=`, então cada página declara o
 * idioma do próprio conteúdo.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`theme-thinkzap ${montserrat.variable} min-h-screen overflow-x-hidden bg-background text-foreground`}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      {children}
    </div>
  )
}
