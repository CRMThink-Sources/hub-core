'use client'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { useLineApi } from '@/app/hooks/use-line-api'
import {
  type ContactCenterChannel,
  type ContactCenterLine,
  resolvePlacementLine,
  toChannelOptions,
  toLineOptions,
} from '@/shared/thinkzap/contact-center-placement'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Configuração do conector aberta pelo Contact Center: o usuário escolhe a linha
 * e o canal aberto que ela vai atender.
 *
 * O canal é escolhido aqui, e não tirado do placement: o Bitrix manda um `LINE`
 * até quando o usuário clica em "Conectar" sem escolher canal, e usá-lo como
 * destino vinculava a linha a um canal que ninguém escolheu. Ele só pré-seleciona
 * quando já há vínculo nele — ver `toChannelOptions`.
 *
 * Assume token gravado — quem monta é a página do placement, depois de autenticar.
 * O vínculo é o mesmo da tela da linha (`POST /lines/:itemId/channel`): o backend
 * ativa o conector no canal antes de gravar, e recusa canal de outra linha.
 */
export const ContactCenterView = () => {
  const [placementLine, setPlacementLine] = useState<number | null>(null)
  const [placementResolved, setPlacementResolved] = useState(false)
  const [lines, setLines] = useState<ContactCenterLine[] | null>(null)
  const [channels, setChannels] = useState<ContactCenterChannel[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [channelsError, setChannelsError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const lineApi = useLineApi(selectedId)

  useEffect(() => {
    window.BX24?.fitWindow?.(() => {
      window.BX24?.resizeWindow?.(600, 520)
    })

    setPlacementLine(resolvePlacementLine(window.BX24?.placement?.info?.()))
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

  const loadChannels = useCallback(async () => {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setChannelsError(resolved.message)
      return null
    }

    try {
      const res = await resolved.client.get<{
        channels?: ContactCenterChannel[]
      }>('/thinkzap/openchannels')
      const loaded = res.channels ?? []
      setChannelsError('')
      setChannels(loaded)
      return loaded
    } catch (e) {
      setChannelsError(
        thinkzapApiErrorMessage(e, 'Falha ao carregar os canais abertos'),
      )
      return null
    }
  }, [])

  useEffect(() => {
    if (!placementResolved) return

    let cancelled = false
    void Promise.all([loadLines(), loadChannels()]).then(
      ([loadedLines, loadedChannels]) => {
        if (cancelled || !loadedLines) return
        setSelectedId(toLineOptions(loadedLines, placementLine).preselectedId)
        if (loadedChannels) {
          setSelectedChannelId(
            toChannelOptions(loadedChannels, loadedLines, placementLine)
              .preselectedChannelId,
          )
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [placementResolved, placementLine, loadLines, loadChannels])

  const { options } = useMemo(
    () => toLineOptions(lines ?? [], placementLine),
    [lines, placementLine],
  )

  const { options: channelOptions } = useMemo(
    () => toChannelOptions(channels ?? [], lines ?? [], placementLine),
    [channels, lines, placementLine],
  )

  const resetFeedback = () => {
    setSaved(false)
    setSaveError('')
  }

  const handleSave = async () => {
    if (!selectedId || !selectedChannelId) return

    setSaving(true)
    resetFeedback()
    try {
      await lineApi.linkChannel(Number(selectedChannelId))
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

  const alreadyLinked =
    !!selectedChannelId &&
    lines?.find(line => line.id === selectedId)?.instance.vinculatedChannel ===
      selectedChannelId

  const selectClassName =
    'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors'

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
            Selecione o número de WhatsApp e o canal aberto que ele vai atender.
          </p>
        </div>

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
                resetFeedback()
              }}
              className={selectClassName}
            >
              <option value="">Selecione um número...</option>
              {options.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <label
              htmlFor="channel-select"
              className="text-sm font-medium text-neutral-700"
            >
              Canal aberto
            </label>
            {channelsError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {channelsError}
              </p>
            ) : channels === null ? (
              <p className="text-sm text-neutral-400">Carregando canais...</p>
            ) : (
              <select
                id="channel-select"
                value={selectedChannelId}
                onChange={e => {
                  setSelectedChannelId(e.target.value)
                  resetFeedback()
                }}
                className={selectClassName}
              >
                <option value="">Selecione um canal aberto...</option>
                {channelOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.occupiedBy
                      ? ` — vinculado a ${option.occupiedBy}`
                      : ''}
                  </option>
                ))}
              </select>
            )}

            {alreadyLinked && !saved ? (
              <p className="text-sm text-emerald-700">
                Este número já está vinculado a este canal aberto.
              </p>
            ) : null}

            {saveError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            ) : null}

            <button
              onClick={() => void handleSave()}
              disabled={
                !selectedId || !selectedChannelId || !!channelsError || saving
              }
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
