'use client'

import { useEffect, useRef, useState } from 'react'
import {
  authenticateBitrixWithBackend,
  BX24Script,
  getBitrixAppInfoFromUrl,
  useBX24,
} from '@/bitrix'
import { writeAppToken } from '@/shared/auth/app-token-storage'
import { ButtonRobotForm } from '../_shared-button/button-robot-form'
import {
  readPlacementContext,
  type PlacementContext,
} from '../template/_lib/placement-bridge'

/**
 * `PLACEMENT_HANDLER` do robô de Bizproc de envio de botões pela linha **não
 * oficial** (Z-API) — mirror de `BizprocButtonOfficialRobotPage`. Os três
 * tipos são oferecidos, mas resposta rápida não convive com link/ligação no
 * mesmo envio — o WhatsApp Web recusa a combinação.
 */
export default function BizprocButtonUnofficialRobotPage() {
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

      {authenticated && context && (
        <ButtonRobotForm
          context={context}
          allowedTypes={['REPLY', 'URL', 'CALL']}
          linesEndpoint="/thinkzap/messages/button-lines/unofficial"
          lineLabel="Linha do WhatsApp Web"
        />
      )}
    </div>
  )
}
