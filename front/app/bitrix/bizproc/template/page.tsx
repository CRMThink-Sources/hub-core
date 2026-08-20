'use client'

import { useEffect, useRef, useState } from 'react'
import {
  authenticateBitrixWithBackend,
  BX24Script,
  getBitrixAppInfoFromUrl,
  useBX24,
} from '@/bitrix'
import { writeAppToken } from '@/shared/auth/app-token-storage'
import { TemplateRobotForm } from './_components/template-robot-form'
import {
  readPlacementContext,
  type PlacementContext,
} from './_lib/placement-bridge'

/**
 * `PLACEMENT_HANDLER` do robô de Bizproc de envio de template.
 *
 * O Bitrix abre esta página dentro do slider de configuração do robô quando ele é
 * registrado com `USE_PLACEMENT: 'Y'`. Fora desse contexto não há `placement.info()`
 * nem para onde gravar, e a página diz isso em vez de renderizar um formulário que
 * não persiste nada.
 *
 * A autenticação é a mesma do widget: `BX24.getAuth()` → `POST /auth` → token da app
 * em storage, que é o que as duas leituras (linhas e templates) usam. O escopo de
 * ambas sai desse token, não da tela.
 */
export default function BizprocTemplateRobotPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)

  const [context, setContext] = useState<PlacementContext | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')

  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scriptLoaded || !bx24Ready || typeof window === 'undefined') return

    const urlInfo = getBitrixAppInfoFromUrl()
    if (!urlInfo.domain) {
      setError('Esta tela deve ser aberta dentro do Bitrix24.')
      return
    }

    const placement = readPlacementContext()
    if (!placement) {
      setError(
        'Esta tela deve ser aberta pela configuração do robô no fluxo do Bitrix24.',
      )
      return
    }

    let cancelled = false

    const start = async () => {
      const result = await authenticateBitrixWithBackend()
      if (cancelled) return

      if (!result.ok) {
        setError(result.error)
        return
      }

      writeAppToken(result.app.appCode, result.token)
      setContext(placement)
      setAuthenticated(true)
    }

    void start()

    return () => {
      cancelled = true
    }
  }, [scriptLoaded, bx24Ready])

  /**
   * Ajusta o iframe à altura do conteúdo, e continua ajustando.
   *
   * `fitWindow` é o que cabe aqui — ele encolhe/cresce o frame até o conteúdo. Fixar a
   * altura (`resizeWindow(640, 720)`) desfazia esse ajuste e era a origem do scroll: a
   * tela cresce com a lista de linhas, com o corpo do template e com uma variável por
   * placeholder, e nada disso é previsível na hora de escolher um número.
   *
   * O `ResizeObserver` existe porque o conteúdo muda **depois** do primeiro ajuste: as
   * duas leituras chegam assíncronas e trocar de template adiciona ou remove campos.
   */
  useEffect(() => {
    if (!scriptLoaded || !bx24Ready) return

    const node = contentRef.current
    if (!node) return

    const fit = () => window.BX24?.fitWindow?.()

    fit()

    const observer = new ResizeObserver(() => fit())
    observer.observe(node)

    return () => observer.disconnect()
  }, [scriptLoaded, bx24Ready])

  return (
    /*
      Sem `min-h-screen`: aqui `100vh` é a altura do próprio iframe, e o iframe é
      redimensionado a partir do conteúdo — pedir uma tela inteira de altura mínima
      trava o encolhimento e realimenta o ajuste. A altura é a do conteúdo, e ponto.
    */
    <div ref={contentRef} className="bg-white">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      {error && (
        <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!error && !authenticated && (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-600">Carregando configuração…</p>
          </div>
        </div>
      )}

      {authenticated && context && <TemplateRobotForm context={context} />}
    </div>
  )
}
