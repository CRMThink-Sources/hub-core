'use client'

import Link from 'next/link'

type Props = {
  message: string
  ctaLabel: string
  href: string
}

export function ConexaoPendenteBanner({ message, ctaLabel, href }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-800"
    >
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M12 8v5M12 16.5h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm">{message}</span>
      </div>
      <Link
        href={href}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900
                 hover:bg-gray-100 hover:border-gray-900 transition-all whitespace-nowrap"
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
