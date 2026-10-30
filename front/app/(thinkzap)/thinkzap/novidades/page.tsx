'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveThinkzapClient } from '../_lib/thinkzap-client'
import {
  getThinkzapNovidades,
  novidadesLocaleFor,
} from '../_lib/get-thinkzap-novidades'
import {
  NovidadesView,
  type NovidadesState,
} from '../_components/novidades/novidades-view'

/**
 * Aba Novidades: melhorias já disponíveis e as que vêm em breve, no idioma do
 * app. Trocar o idioma (`hub_locale`, via i18next) refaz a busca; os cards da
 * língua anterior ficam na tela até os novos chegarem, sem piscar o carregamento.
 */
export default function ThinkzapNovidadesPage() {
  const { i18n } = useTranslation('thinkzap/novidades/page')
  const locale = novidadesLocaleFor(i18n.resolvedLanguage ?? i18n.language)
  const [state, setState] = useState<NovidadesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setState({ status: 'error', message: resolved.message })
      return
    }

    setState(prev => (prev.status === 'ready' ? prev : { status: 'loading' }))

    getThinkzapNovidades(resolved.client, locale)
      .then(items => {
        if (!cancelled) setState({ status: 'ready', items })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [locale, attempt])

  return (
    <NovidadesView
      state={state}
      locale={locale}
      onRetry={() => {
        setState({ status: 'loading' })
        setAttempt(value => value + 1)
      }}
    />
  )
}
