import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

// Sem `lang`: o layout não vê `?lang=`, então cada página declara o idioma.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${montserrat.variable} min-h-screen overflow-x-hidden`}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      {children}
    </div>
  )
}
