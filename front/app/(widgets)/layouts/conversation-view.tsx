'use client'

import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { StatusBanner } from '@/app/bitrix/widget/audio/_components/status-banner'
import { AudioPreviewPanel } from '@/app/bitrix/widget/audio/_features/playback/audio-preview-panel'
import { useAudioPlayback } from '@/app/bitrix/widget/audio/_features/playback/use-audio-playback'
import { RecordControls } from '@/app/bitrix/widget/audio/_features/recording/record-controls'
import { useAudioRecorder } from '@/app/bitrix/widget/audio/_features/recording/use-audio-recorder'
import { formatFileSize } from '@/app/bitrix/widget/audio/_lib/format-file-size'
import { useSession } from '@/providers/session-provider'
import { Button } from '@/components/ui/button'
import { Mic } from 'lucide-react'
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { buildSendWidgetFormData } from './send-widget-message.client'
import {
  attachmentSizeErrorMessage,
  isAttachmentWithinSizeLimit,
  WIDGET_ATTACHMENT_MAX_MB,
} from './widget-attachment-limits'

type SessionConnector = {
  id: string
  instance?: {
    name?: string | null
    phoneNumber?: string | null
    connected?: boolean
  } | null
}

type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

type ComposerAttachment = {
  id: string
  name: string
  size: number
  type: string
  kind: AttachmentKind
  file: File
}

type IDestination = {
  id: string
  label: string
  phone: string
}

type ListDestinationsResponse = {
  destinations: IDestination[]
  ids: Array<{ entityTypeId: number; id: string }>
}

const normalizePhoneNumber = (value: string): string => {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

const PLACEMENT_TO_ENTITY = {
  CRM_DEAL_DETAIL_TAB: 'deal',
  CRM_CONTACT_DETAIL_TAB: 'contact',
  CRM_COMPANY_DETAIL_TAB: 'company',
  CRM_LEAD_DETAIL_TAB: 'lead',
}

export const ConversationView = () => {
  const { session, isFetching } = useSession()
  const [selectedConnectorId, setSelectedConnectorId] = useState('')
  const [selectedDestinationPhone, setSelectedDestinationPhone] = useState('')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [destinations, setDestinations] = useState<IDestination[]>([])
  const [isSending, setIsSending] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'error'>(
    'success',
  )

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const info = window.BX24?.placement?.info?.()
    const placement = info?.placement
    const placementOptions = info?.options ?? {}
    const contextId = placementOptions.ID

    const fetchDestinations = async () => {
      const client = resolveThinkzapClient()
      if (!client.ok) return
      const response = await client.client.get<ListDestinationsResponse>(
        `/thinkzap/destinations`,
        {
          params: {
            contextId,
            placement,
          },
        },
      )
      setDestinations(response.destinations)
    }
    void fetchDestinations()
  }, [])

  const connectors = (session?.connectors ?? []) as SessionConnector[]
  const playback = useAudioPlayback()
  const recorder = useAudioRecorder()
  const { audioBlob, audioUrl } = recorder

  const selectedDestination = useMemo(
    () => destinations.find(dest => dest.phone === selectedDestinationPhone),
    [destinations, selectedDestinationPhone],
  )

  const hasOversizedAttachment = attachments.some(
    item => !isAttachmentWithinSizeLimit(item.size),
  )

  const canSubmit =
    selectedConnectorId.trim() &&
    selectedDestinationPhone.trim() &&
    (message.trim().length > 0 || attachments.length > 0) &&
    !isSending &&
    !hasOversizedAttachment &&
    !audioUrl

  const setErrorFeedback = (text: string) => {
    setFeedbackVariant('error')
    setFeedbackMessage(text)
  }

  const setSuccessFeedback = (text: string) => {
    setFeedbackVariant('success')
    setFeedbackMessage(text)
  }

  const validateFileSize = (file: File): boolean => {
    if (isAttachmentWithinSizeLimit(file.size)) return true
    setErrorFeedback(attachmentSizeErrorMessage(file.name))
    return false
  }

  const handleAddAttachments = (
    event: ChangeEvent<HTMLInputElement>,
    kind: AttachmentKind,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (!selectedFiles.length) return

    const validFiles = selectedFiles.filter(validateFileSize)
    if (!validFiles.length) {
      event.target.value = ''
      return
    }

    setAttachments(previous => [
      ...previous,
      ...validFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        type: file.type,
        kind,
        file,
      })),
    ])

    event.target.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments(previous => previous.filter(item => item.id !== id))
  }

  const handleToggleRecording = () => {
    if (!recorder.isRecording) {
      playback.resetPlayback()
    }
    recorder.toggleRecording()
  }

  const handleAddRecordedAudio = () => {
    if (!audioBlob) return

    const now = Date.now()
    const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
    const fileName = `audio-${now}.${extension}`
    const audioFile = new File([audioBlob], fileName, {
      type: audioBlob.type || 'audio/webm',
      lastModified: now,
    })

    if (!validateFileSize(audioFile)) return

    setAttachments(previous => [
      ...previous,
      {
        id: `${audioFile.name}-${audioFile.lastModified}-${audioFile.size}`,
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type,
        kind: 'audio',
        file: audioFile,
      },
    ])

    recorder.clearRecording()
    playback.resetPlayback()
    setSuccessFeedback('Audio adicionado aos anexos.')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const client = resolveThinkzapClient()
    if (!client.ok) {
      setErrorFeedback(client.message)
      return
    }

    try {
      setIsSending(true)
      setFeedbackMessage('')
      const info = window.BX24?.placement?.info?.()
      const placement = info?.placement
      const placementOptions = info?.options ?? {}
      const entity =
        PLACEMENT_TO_ENTITY[placement as keyof typeof PLACEMENT_TO_ENTITY]
      const entityId = placementOptions.ID

      const payloadBase = {
        // Id do item de assinatura: o `id` que a sessão devolve para cada linha.
        subscriptionItemId: selectedConnectorId,
        destination: normalizePhoneNumber(selectedDestination?.phone ?? ''),
        message: message.trim() || undefined,
        entity,
        entityId,
      }

      if (attachments.length > 0) {
        const formData = buildSendWidgetFormData({
          ...payloadBase,
          attachments: attachments.map(item => ({
            kind: item.kind,
            name: item.name,
            file: item.file,
          })),
        })

        await client.client.post(
          '/thinkzap/messages/send-widget-multipart',
          formData,
        )
      } else {
        await client.client.post('/thinkzap/messages/send-widget', payloadBase)
      }

      setMessage('')
      setAttachments([])
      recorder.clearRecording()
      playback.resetPlayback()
      setSuccessFeedback('Mensagem enviada com sucesso.')
    } catch (error) {
      setErrorFeedback(
        thinkzapApiErrorMessage(
          error,
          'Falha ao enviar mensagem. Verifique os dados e tente novamente.',
        ),
      )
    } finally {
      setIsSending(false)
    }
  }

  if (isFetching) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Carregando sessão...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        {!connectors.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              Nenhum conector encontrado na sua sessão.
            </p>
          </div>
        ) : (
          <form
            onSubmit={event => {
              void handleSubmit(event)
            }}
            className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg backdrop-blur sm:p-6"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5">
              <label className="group grid min-w-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conector
                </span>
                <select
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedConnectorId}
                  onChange={event => setSelectedConnectorId(event.target.value)}
                  disabled={isSending}
                >
                  <option value="">Selecione um conector</option>
                  {connectors.map(connector => (
                    <option key={connector.id} value={connector.id}>
                      {connector.instance?.name ?? connector.id}
                      {connector.instance?.connected
                        ? ' (conectado)'
                        : ' (offline)'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="group grid min-w-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Destino
                </span>
                <select
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedDestinationPhone}
                  onChange={event =>
                    setSelectedDestinationPhone(event.target.value)
                  }
                  disabled={isSending}
                >
                  <option value="">Selecione um número</option>
                  {destinations.map(destination => (
                    <option
                      key={`${destination.id}-${destination.phone}`}
                      value={destination.phone}
                    >
                      {destination.label} - {destination.phone}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mensagem
              </span>
              <textarea
                className="min-h-20 resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                rows={8}
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Digite sua mensagem..."
                disabled={isSending}
              />
            </label>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Anexos de midia e arquivos
                  </p>
                  <p className="text-xs text-slate-500">
                    Max. {WIDGET_ATTACHMENT_MAX_MB} MB por arquivo.
                  </p>
                </div>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  {attachments.length} selecionado(s)
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isSending}
                  className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Imagem
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isSending}
                  className="inline-flex h-10 items-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="inline-flex h-10 items-center rounded-xl bg-slate-700 px-4 text-sm font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Arquivo
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white">
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Mensagem de voz
                    </p>
                    <p className="text-xs text-slate-500">
                      Grave, ouça o preview e adicione aos anexos.
                    </p>
                  </div>
                </div>

                <RecordControls
                  isRecording={recorder.isRecording}
                  buttonScale={recorder.buttonScale}
                  elapsedSeconds={recorder.recordingElapsedSeconds}
                  onToggle={handleToggleRecording}
                />

                {recorder.error ? (
                  <StatusBanner variant="error" message={recorder.error} />
                ) : null}

                {audioUrl ? (
                  <AudioPreviewPanel
                    audioRef={playback.audioRef}
                    audioUrl={audioUrl}
                    isPlaying={playback.isPlaying}
                    isSending={isSending}
                    duration={playback.duration}
                    currentTime={playback.currentTime}
                    fallbackDurationSeconds={recorder.recordedDurationSeconds}
                    blobSize={audioBlob?.size}
                    onLoadedMetadata={playback.onLoadedMetadata}
                    onTimeUpdate={playback.onTimeUpdate}
                    onPlay={playback.onPlay}
                    onPause={playback.onPause}
                    onEnded={playback.onEnded}
                    onTogglePlayback={playback.togglePlayback}
                    onSeek={playback.handleSeek}
                    onDelete={() => {
                      recorder.clearRecording()
                      playback.resetPlayback()
                    }}
                    onSend={handleAddRecordedAudio}
                    sendLabel="Adicionar"
                  />
                ) : null}

                {audioUrl ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Clique em Adicionar para incluir o audio na lista de anexos
                    antes de enviar.
                  </p>
                ) : null}
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={event => handleAddAttachments(event, 'image')}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={event => handleAddAttachments(event, 'video')}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => handleAddAttachments(event, 'file')}
              />

              {attachments.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {attachments.map(item => {
                    const oversized = !isAttachmentWithinSizeLimit(item.size)
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                          oversized
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.kind.toUpperCase()} -{' '}
                            {formatFileSize(item.size)}
                            {oversized
                              ? ` (excede ${WIDGET_ATTACHMENT_MAX_MB} MB)`
                              : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(item.id)}
                          disabled={isSending}
                          className="text-xs font-semibold text-red-600 transition hover:text-red-500 disabled:opacity-60"
                        >
                          Remover
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Nenhum arquivo adicionado ainda.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={!canSubmit} size="lg">
                {isSending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>

            {feedbackMessage ? (
              <StatusBanner
                variant={feedbackVariant}
                message={feedbackMessage}
              />
            ) : null}
          </form>
        )}
      </div>
    </div>
  )
}
