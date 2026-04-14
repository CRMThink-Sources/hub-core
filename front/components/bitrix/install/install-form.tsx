'use client'

import { type ReactNode } from 'react'
import { InstallLayout, InstallCard } from './install-layout'

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

const BUTTON_CLASS =
  'cursor-pointer w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:shadow-none'

interface InstallFormProps {
  email: string
  onEmailChange: (value: string) => void
  termsSection: ReactNode
  errorMessage: string | null
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  submitLabel?: string
  submittingLabel?: string
}

export function InstallForm({
  email,
  onEmailChange,
  termsSection,
  errorMessage,
  isSubmitting,
  onSubmit,
  submitLabel = 'Concluir instalação',
  submittingLabel = 'Concluindo...',
}: InstallFormProps) {
  return (
    <InstallLayout>
      <InstallCard>
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-10 text-white">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"
            aria-hidden
          >
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Instalação do aplicativo
          </h1>
          <p className="mt-2 text-center text-sm text-indigo-100">
            Preencha os dados e aceite os termos para concluir.
          </p>
        </div>
        <div className="p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="install-email"
                className="block text-sm font-semibold text-slate-700"
              >
                E-mail de instalação
              </label>
              <input
                id="install-email"
                type="email"
                value={email}
                onChange={e => onEmailChange(e.target.value)}
                placeholder="seu@empresa.com"
                className={INPUT_CLASS}
                required
                disabled={isSubmitting}
              />
            </div>

            {termsSection}

            {errorMessage && (
              <div
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={BUTTON_CLASS}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  {submittingLabel}
                </span>
              ) : (
                submitLabel
              )}
            </button>
          </form>
        </div>
      </InstallCard>
    </InstallLayout>
  )
}
