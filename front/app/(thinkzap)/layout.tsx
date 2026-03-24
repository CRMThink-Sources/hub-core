'use client'

import { SessionProvider } from '@/providers/session-provider'
import { Montserrat } from 'next/font/google'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ThinkzapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div
        className={montSerrat.variable}
        style={{ fontFamily: 'var(--font-montserrat)' }}
      >
        {children}
      </div>
    </SessionProvider>
  )
}
