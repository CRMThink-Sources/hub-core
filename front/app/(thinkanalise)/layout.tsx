'use client'

import { Montserrat } from 'next/font/google'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ThinkAnaliseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={montSerrat.variable}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      {children}
    </div>
  )
}
