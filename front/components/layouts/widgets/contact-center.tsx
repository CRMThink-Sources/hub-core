'use client'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { useLineApi } from '@/app/hooks/use-line-api'
import {
  type ContactCenterLine,
  resolvePlacementLine,
  toLineOptions,
} from '@/shared/thinkzap/contact-center-placement'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Configuração do conector aberta pelo Contact Center: escolhe a linha que atende
 * o canal aberto do placement.
 *
 * Assume token gravado — quem monta é a página do placement, depois de autenticar.
 * O vínculo é o mesmo da tela da linha (`POST /lines/:itemId/channel`): o backend
 * ativa o conector no canal antes de gravar, e recusa canal de outra linha.
 */
export const ContactCenterView = () => {
  const [placementLine, setPlacementLine] = useState<number | null>(null)
  const [placementResolved, setPlacementResolved] = useState(false)
  const [lines, setLines] = useState<ContactCenterLine[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const lineApi = useLineApi(selectedId)

  useEffect(() => {
    window.BX24?.fitWindow?.(() => {
      window.BX24?.resizeWindow?.(600, 400)
    })

    const line = resolvePlacementLine(window.BX24?.placement?.info?.())
    if (line === null) {
      console.warn('Placement sem canal aberto identificado')
    }
    setPlacementLine(line)
    setPlacementResolved(true)
  }, [])

  const loadLines = useCallback(async () => {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setLoadError(resolved.message)
      return null
    }

    try {
      const { connectors } = await resolved.client.get<{
        connectors: ContactCenterLine[]
      }>('/thinkzap/connector/list')
      setLoadError('')
      setLines(connectors)
      return connectors
    } catch (e) {
      setLoadError(thinkzapApiErrorMessage(e, 'Falha ao carregar as linhas'))
      return null
    }
  }, [])

  useEffect(() => {
    if (!placementResolved) return

    let cancelled = false
    void loadLines().then(loaded => {
      if (cancelled || !loaded) return
      setSelectedId(toLineOptions(loaded, placementLine).preselectedId)
    })

    return () => {
      cancelled = true
    }
  }, [placementResolved, placementLine, loadLines])

  const { options } = useMemo(
    () => toLineOptions(lines ?? [], placementLine),
    [lines, placementLine],
  )

  const handleSave = async () => {
    if (!selectedId || placementLine === null) return

    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await lineApi.linkChannel(placementLine)
      setSaved(true)
      await loadLines()
    } catch (e) {
      setSaveError(
        thinkzapApiErrorMessage(e, 'Falha ao vincular o canal aberto'),
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedLinkedHere =
    options.find(option => option.id === selectedId)?.linkedHere === true

  return (
    <div className="w-full min-h-full p-5 bg-neutral-950 text-white flex flex-col gap-5">
      <h1 className="text-xl font-bold tracking-tight">Vincular WhatsApp</h1>

      {loadError ? (
        <p className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {loadError}
        </p>
      ) : null}

      <section className="rounded-xl bg-white p-5 shadow-sm border border-neutral-200 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-1">
            Vincular ao Canal Aberto
          </h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Selecione qual número de WhatsApp será vinculado
            {placementLine !== null
              ? ` ao Canal Aberto ${placementLine}`
              : ' ao canal aberto selecionado'}
            .
          </p>
        </div>

        {placementResolved && placementLine === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Não foi possível identificar o canal aberto. Feche e abra novamente
            a configuração do conector pelo Contact Center.
          </p>
        ) : null}

        {lines === null ? (
          loadError ? null : (
            <p className="text-sm text-neutral-400">Carregando linhas...</p>
          )
        ) : options.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">
            Nenhum número disponível. Cadastre um conector primeiro.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label
              htmlFor="connector-select"
              className="text-sm font-medium text-neutral-700"
            >
              Número WhatsApp
            </label>
            <select
              id="connector-select"
              value={selectedId}
              onChange={e => {
                setSelectedId(e.target.value)
                setSaved(false)
                setSaveError('')
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
            >
              <option value="">Selecione um número...</option>
              {options.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.linkedHere ? ' (vinculada a este canal)' : ''}
                </option>
              ))}
            </select>

            {selectedLinkedHere && !saved ? (
              <p className="text-sm text-emerald-700">
                Esta linha já está vinculada a este canal aberto.
              </p>
            ) : null}

            {saveError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            ) : null}

            <button
              onClick={() => void handleSave()}
              disabled={!selectedId || placementLine === null || saving}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Vinculando...' : saved ? 'Vinculado!' : 'Vincular'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
