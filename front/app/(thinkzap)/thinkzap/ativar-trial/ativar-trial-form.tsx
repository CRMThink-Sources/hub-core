'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { envConfig } from '@/shared/infra/env-config'
import { useTranslation } from 'react-i18next'

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60'

const BUTTON_CLASS =
  'cursor-pointer w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:shadow-none'

export function AtivarTrialForm() {
  const { t } = useTranslation('thinkzap/ativar-trial')
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setErro(resolved.message)
      return
    }

    setSubmitting(true)
    try {
      const data = await resolved.client.post<{ clientSecret?: string | null }>(
        '/thinkzap/subscription/activate-trial',
        {
          name: nome.trim(),
          email: email.trim(),
          phone: telefone.trim(),
          company: empresa.trim(),
        },
      )

      router.push(`/thinkzap/conexoes`)
    } catch (e: unknown) {
      setErro(thinkzapApiErrorMessage(e, t('erroIniciarTrial')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
      <form
        onSubmit={e => {
          void handleSubmit(e)
        }}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="trial-nome"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('campos.nome')}
          </label>
          <input
            id="trial-nome"
            name="nome"
            type="text"
            autoComplete="name"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder={t('campos.nomePlaceholder')}
            className={INPUT_CLASS}
            required
            minLength={2}
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="trial-email"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('campos.email')}
          </label>
          <input
            id="trial-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('campos.emailPlaceholder')}
            className={INPUT_CLASS}
            required
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="trial-telefone"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('campos.telefone')}
          </label>
          <input
            id="trial-telefone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder={t('campos.telefonePlaceholder')}
            className={INPUT_CLASS}
            required
            minLength={8}
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="trial-empresa"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('campos.empresa')}
          </label>
          <input
            id="trial-empresa"
            name="empresa"
            type="text"
            autoComplete="organization"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            placeholder={t('campos.empresaPlaceholder')}
            className={INPUT_CLASS}
            required
            minLength={2}
            disabled={submitting}
          />
        </div>

        {erro && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {erro}
          </div>
        )}

        <button type="submit" disabled={submitting} className={BUTTON_CLASS}>
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden
              />
              {t('redirecionando')}
            </span>
          ) : (
            t('continuar')
          )}
        </button>
      </form>
    </div>
  )
}
