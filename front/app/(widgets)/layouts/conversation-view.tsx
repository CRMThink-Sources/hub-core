'use client'

import { resolveThinkzapClient } from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { AudioPreview } from '@/app/bitrix/widget/audio/_components/audio-preview'
import { RecordToggleButton } from '@/app/bitrix/widget/audio/_components/record-toggle-button'
import { useAudioWidget } from '@/app/bitrix/widget/audio/_hooks/use-audio-widget'
import { useSession } from '@/providers/session-provider'
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

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

const formatFileSize = (value: number): string => {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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

const fileToBase64DataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Falha ao processar anexo'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('Falha ao processar anexo'))
    reader.readAsDataURL(file)
  })
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
      console.log('response:', response)
      setDestinations(response.destinations)
    }
    void fetchDestinations()
  }, [])

  const connectors = (session?.connectors ?? []) as SessionConnector[]
  const {
    audioRef,
    audioBlob,
    isRecording,
    buttonScale,
    audioUrl,
    isPlaying,
    duration,
    currentTime,
    error: audioError,
    toggleRecording,
    togglePlayback,
    handleSeek,
    handleDeleteAudio,
    onAudioLoadedMetadata,
    onAudioTimeUpdate,
    onAudioPlay,
    onAudioPause,
    onAudioEnded,
  } = useAudioWidget({
    dialogId: null,
    domain: null,
    uploadEndpoint: '/api/audio/upload',
  })

  const selectedDestination = useMemo(
    () => destinations.find(dest => dest.phone === selectedDestinationPhone),
    [destinations, selectedDestinationPhone],
  )

  const canSubmit =
    selectedConnectorId.trim() &&
    selectedDestinationPhone.trim() &&
    (message.trim().length > 0 || attachments.length > 0) &&
    !isSending

  const handleAddAttachments = (
    event: ChangeEvent<HTMLInputElement>,
    kind: AttachmentKind,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (!selectedFiles.length) return

    setAttachments(previous => [
      ...previous,
      ...selectedFiles.map(file => ({
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

  const handleAddRecordedAudio = () => {
    if (!audioBlob) return

    const now = Date.now()
    const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
    const fileName = `audio-${now}.${extension}`
    const audioFile = new File([audioBlob], fileName, {
      type: audioBlob.type || 'audio/webm',
      lastModified: now,
    })

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

    handleDeleteAudio()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const client = resolveThinkzapClient()
    if (!client.ok) {
      setFeedbackMessage(client.message)
      return
    }

    try {
      setIsSending(true)
      setFeedbackMessage('')

      const preparedAttachments = await Promise.all(
        attachments.map(async item => ({
          kind: item.kind,
          name: item.name,
          content: await fileToBase64DataUrl(item.file),
        })),
      )

      await client.client.post('/thinkzap/messages/send-widget', {
        connectorId: selectedConnectorId,
        destination: normalizePhoneNumber(selectedDestination?.phone ?? ''),
        message: message.trim() || undefined,
        attachments: preparedAttachments,
      })

      setMessage('')
      setAttachments([])
      handleDeleteAudio()
      setFeedbackMessage('Mensagem enviada com sucesso.')
    } catch {
      setFeedbackMessage(
        'Falha ao enviar mensagem. Verifique os dados e tente novamente.',
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
        {/* <div className="mb-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Nova mensagem
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Composer com midia para envio rapido via conector.
          </p>
        </div> */}

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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={selectedConnectorId}
                  onChange={event => setSelectedConnectorId(event.target.value)}
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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={selectedDestinationPhone}
                  onChange={event =>
                    setSelectedDestinationPhone(event.target.value)
                  }
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
                className="min-h-20 resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                rows={8}
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Digite sua mensagem..."
              />
            </label>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Anexos de midia e arquivos
                  </p>
                  <p className="text-xs text-slate-500">
                    Adicione imagem, video ou documento.
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
                  className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  Imagem
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="inline-flex h-10 items-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-500"
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center rounded-xl bg-slate-700 px-4 text-sm font-medium text-white transition hover:bg-slate-600"
                >
                  Arquivo
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Gravador de audio
                </p>
                <RecordToggleButton
                  isRecording={isRecording}
                  buttonScale={buttonScale}
                  onToggle={toggleRecording}
                />

                {audioError ? (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {audioError}
                  </p>
                ) : null}

                {audioUrl ? (
                  <AudioPreview
                    audioRef={audioRef}
                    audioUrl={audioUrl}
                    isPlaying={isPlaying}
                    isSending={false}
                    sendLabel="Adicionar"
                    duration={duration}
                    currentTime={currentTime}
                    onLoadedMetadata={onAudioLoadedMetadata}
                    onTimeUpdate={onAudioTimeUpdate}
                    onPlay={onAudioPlay}
                    onPause={onAudioPause}
                    onEnded={onAudioEnded}
                    onTogglePlayback={togglePlayback}
                    onSeek={handleSeek}
                    onDelete={handleDeleteAudio}
                    onSend={handleAddRecordedAudio}
                  />
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
                  {attachments.map(item => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.kind.toUpperCase()} {' - '}
                          {formatFileSize(item.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        className="text-xs font-semibold text-red-600 transition hover:text-red-500"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Nenhum arquivo adicionado ainda.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isSending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>

            {feedbackMessage ? (
              <p className="mt-3 text-sm text-slate-600">{feedbackMessage}</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  )
}
