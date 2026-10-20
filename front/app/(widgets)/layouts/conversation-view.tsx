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
import { isLineDisconnectedError } from '@/app/hooks/extract-line-disconnected'
import { useWidgetTemplates } from '@/app/hooks/use-widget-templates'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSendableLines } from '@/shared/aplication/subscription-items'
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
import {
  appendWidgetButton,
  ButtonComposer,
  buttonComposerValidationMessage,
  toButtonPayload,
  type WidgetButtonEntry,
  type WidgetButtonType,
} from './button-composer'
import { buildSendWidgetFormData } from './send-widget-message.client'
import { resolveWidgetEntity } from './resolve-widget-entity'
import {
  TemplateComposer,
  templateKey,
  type HeaderImageSource,
} from './template-composer'
import {
  canSendWidgetTemplate,
  needsHeaderImage,
  orderedTemplateParameters,
  templateButtonParameters,
  widgetHeaderImageFileError,
} from './template-variables'
import { uploadWidgetHeaderImage } from './upload-widget-header-image.client'
import {
  attachmentSizeErrorMessage,
  isAttachmentWithinSizeLimit,
  WIDGET_ATTACHMENT_MAX_MB,
} from './widget-attachment-limits'

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

/** Resposta de `GET /thinkzap/messages/line-status/:id` — dois booleanos, nada mais. */
type LineStatusResponse = {
  connected: boolean
  available: boolean
}

/**
 * Status de conexão da linha **selecionada**.
 *
 * `unknown` existe separado de `known` com `connected: false` de propósito: leitura
 * que falhou, ou que respondeu `available: false`, não é desconexão — avisar nesse
 * caso mandaria o operador reconectar um telefone que pode estar ligado. Só `known`
 * com `connected: false` vira aviso.
 */
type LineStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'known'; connected: boolean }
  | { kind: 'unknown' }

const LINE_DISCONNECTED_MESSAGE =
  'Não foi possível enviar: o número desta linha não está conectado.' as const

const normalizePhoneNumber = (value: string): string => {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

/**
 * Mesmos rótulos da tela de conexões (`provider.oficial` / `provider.naoOficial`).
 * O widget não usa i18n — o resto deste arquivo também é literal em português.
 */
const PROVIDER_LABEL = {
  HUBMESSAGE: 'Oficial',
  ZAPI: 'WhatsApp Web',
  NONE: '',
} as const

/**
 * Mensagem de falha de leitura do contexto. Cada estado tem texto próprio: dizer
 * "sessão expirada" para um `502` mandaria o operador reabrir o widget num
 * problema que não é dele.
 */
const contextErrorMessage = (
  status: 'error' | 'not-found' | 'unauthenticated',
  message?: string,
): string => {
  if (status === 'error') {
    return message || 'Não foi possível carregar suas linhas.'
  }
  if (status === 'not-found') {
    return 'Instalação não encontrada neste portal.'
  }
  return 'Sessão expirada. Reabra a aplicação pelo Bitrix24.'
}

export const ConversationView = () => {
  const { state: aplicationState } = useAplicationContext()
  const [selectedConnectorId, setSelectedConnectorId] = useState('')
  const [selectedDestinationPhone, setSelectedDestinationPhone] = useState('')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  /**
   * Estado do modo template, **separado** do modo livre (`message`/`attachments`).
   *
   * Campos distintos e não um payload polimórfico: é o que garante que trocar de
   * linha entre providers não mande o rascunho do modo abandonado. Cada ramo de
   * `handleSubmit` lê só os seus campos.
   */
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')
  const [templateValues, setTemplateValues] = useState<Record<string, string>>(
    {},
  )
  const [templateButtonValues, setTemplateButtonValues] = useState<
    Record<number, string>
  >({})
  const [templateHeaderImageUrl, setTemplateHeaderImageUrl] = useState('')
  /**
   * Imagem do cabeçalho por arquivo: o arquivo sobe assim que é escolhido, e a URL
   * devolvida entra em `templateHeaderImageUrl` — o envio é o mesmo do link.
   */
  const [headerImageSource, setHeaderImageSource] =
    useState<HeaderImageSource>('FILE')
  const [headerImageFileName, setHeaderImageFileName] = useState('')
  const [headerImageUploading, setHeaderImageUploading] = useState(false)
  const [headerImageUploadError, setHeaderImageUploadError] = useState('')
  /** Upload de um arquivo/template anterior que termine depois é descartado. */
  const headerImageUploadTokenRef = useRef(0)
  /**
   * Estado do modo botões — mesmo raciocínio do modo template: campos
   * separados do modo livre, para que trocar de modo não misture rascunhos.
   *
   * `buttonModeActive` é **escolha do operador**, não derivada do provider
   * como `composerMode` de template/livre: botão funciona nos dois providers,
   * então não há linha que force ou proíba o modo.
   */
  const [buttonModeActive, setButtonModeActive] = useState(false)
  const [buttonBody, setButtonBody] = useState('')
  const [buttonHeader, setButtonHeader] = useState('')
  const [buttonFooter, setButtonFooter] = useState('')
  const [buttons, setButtons] = useState<WidgetButtonEntry[]>([])
  const [destinations, setDestinations] = useState<IDestination[]>([])
  const [lineStatus, setLineStatus] = useState<LineStatus>({ kind: 'idle' })
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

  /**
   * Linhas ofertáveis, derivadas dos itens de assinatura de `/api/application/me`.
   *
   * `new Date()` é avaliado no render, não dentro da função pura. Recalcula quando
   * o contexto muda — inclusive depois de um `refresh`, que é o que faz uma linha
   * recém-contratada aparecer sem recarregar o widget.
   */
  const lines = useMemo(
    () =>
      aplicationState.status === 'ready'
        ? listSendableLines(aplicationState.subscriptions, new Date())
        : [],
    [aplicationState],
  )

  const selectedLine = useMemo(
    () => lines.find(line => line.id === selectedConnectorId),
    [lines, selectedConnectorId],
  )

  /**
   * Modo de composição. `template`/`free` continuam **derivados** do provider
   * da linha, pelo motivo de sempre: o operador não tem como saber se a janela
   * de conversa de 24h daquele contato está aberta, e oferecer mensagem livre
   * numa linha oficial seria oferecer um botão que falha no primeiro toque.
   *
   * `button` é diferente: funciona nos dois providers, então é **escolha do
   * operador** (`buttonModeActive`), sobrepondo o modo derivado enquanto
   * ligado. Trocar de linha com o modo ligado mantém o modo — só os tipos de
   * botão oferecidos mudam, via `allowedButtonTypes` abaixo.
   */
  const composerMode: 'free' | 'template' | 'button' = buttonModeActive
    ? 'button'
    : selectedLine?.provider === 'HUBMESSAGE'
      ? 'template'
      : 'free'

  /**
   * Tipos de botão que a linha selecionada aceita. `HUBMESSAGE` só tem
   * **um botão `URL`** no endpoint de ação interativa — confirmado contra a
   * API real em 2026-09-15 que a Cloud API da Meta não tem botão de ligação
   * em mensagem de sessão livre, e que o botão de URL (`cta_url`) não
   * combina com outro no mesmo envio (`maxButtons` abaixo). `ZAPI` tem os
   * três, até `MAX_WIDGET_BUTTONS` (o default quando `maxButtons` fica
   * `undefined`), mas não pode misturar `REPLY` com os outros dois no mesmo
   * envio — a mistura é recusada por
   * `buttonComposerValidationMessage`, não por este array.
   */
  const allowedButtonTypes: WidgetButtonType[] = !selectedLine
    ? []
    : selectedLine.provider === 'HUBMESSAGE'
      ? ['URL']
      : ['REPLY', 'URL', 'CALL']

  const maxButtons: number | undefined =
    selectedLine?.provider === 'HUBMESSAGE' ? 1 : undefined

  /**
   * Templates aprovados da linha, só no modo template. `''` no modo livre é o que
   * impede a requisição de sair para linha Z-API.
   */
  const widgetTemplates = useWidgetTemplates(
    composerMode === 'template' ? selectedConnectorId : '',
  )

  const selectedTemplate = widgetTemplates.templates.find(
    template => templateKey(template) === selectedTemplateKey,
  )

  /**
   * Linha selecionada que saiu da lista (assinatura vencida, item cancelado) não
   * pode continuar armada no formulário: o envio iria com um id que o backend
   * recusa, e o operador não veria por quê.
   */
  useEffect(() => {
    if (!selectedConnectorId) return
    if (lines.some(line => line.id === selectedConnectorId)) return
    setSelectedConnectorId('')
    /**
     * O status vai junto: sem isto o aviso da linha que saiu da lista ficaria na tela
     * sem nenhuma linha selecionada para ele descrever.
     */
    setLineStatus({ kind: 'idle' })
  }, [lines, selectedConnectorId])

  /**
   * Troca de linha zera a escolha de template e as variáveis.
   *
   * Sem isto, um template da linha anterior continuaria armado — e o par
   * (`name`, `language`) até existiria na linha nova por coincidência de nome, com
   * variáveis preenchidas para outro texto. Roda em qualquer troca, inclusive de
   * oficial para Z-API: é o que garante que o payload de template não sobrevive à
   * saída do modo.
   */
  useEffect(() => {
    setSelectedTemplateKey('')
    setTemplateValues({})
    setTemplateButtonValues({})
    resetHeaderImage()
  }, [selectedConnectorId])

  /**
   * Limpa a imagem do cabeçalho (troca de linha, de template, de modo, ou envio
   * concluído). O token invalida um upload ainda em andamento.
   */
  function resetHeaderImage(source: HeaderImageSource = 'FILE') {
    headerImageUploadTokenRef.current += 1
    setHeaderImageSource(source)
    setTemplateHeaderImageUrl('')
    setHeaderImageFileName('')
    setHeaderImageUploading(false)
    setHeaderImageUploadError('')
  }

  async function pickHeaderImageFile(file: File) {
    const rejection = widgetHeaderImageFileError(file)
    const token = ++headerImageUploadTokenRef.current
    setTemplateHeaderImageUrl('')
    setHeaderImageFileName(file.name)
    if (rejection) {
      setHeaderImageUploadError(rejection)
      return
    }

    setHeaderImageUploadError('')
    setHeaderImageUploading(true)
    try {
      const url = await uploadWidgetHeaderImage(file)
      if (headerImageUploadTokenRef.current !== token) return
      setTemplateHeaderImageUrl(url)
    } catch (error) {
      if (headerImageUploadTokenRef.current !== token) return
      setHeaderImageUploadError((error as Error).message)
    } finally {
      if (headerImageUploadTokenRef.current === token) {
        setHeaderImageUploading(false)
      }
    }
  }

  /**
   * Status da linha selecionada, **uma consulta por seleção**.
   *
   * Não é uma por linha listada: rotular as `<option>`s com estado ao vivo é o custo
   * que `widget-line-listing` removeu. O aviso vive fora do select.
   *
   * O `AbortController` existe porque seleção rápida entre linhas deixaria a resposta
   * da linha antiga sobrescrever o estado da nova — o aviso apareceria sobre a linha
   * errada. `checking` não trava a composição: o operador digita enquanto a consulta
   * corre.
   */
  useEffect(() => {
    if (!selectedConnectorId) {
      setLineStatus({ kind: 'idle' })
      return
    }

    const client = resolveThinkzapClient()
    if (!client.ok) {
      setLineStatus({ kind: 'unknown' })
      return
    }

    const controller = new AbortController()
    setLineStatus({ kind: 'checking' })

    const checkStatus = async () => {
      try {
        const status = await client.client.get<LineStatusResponse>(
          `/thinkzap/messages/line-status/${selectedConnectorId}`,
          { signal: controller.signal },
        )

        if (controller.signal.aborted) return

        /**
         * `available: false` é "não deu para saber", não "está desconectada". Cai em
         * `unknown` e nenhum aviso aparece.
         */
        setLineStatus(
          status.available
            ? { kind: 'known', connected: status.connected }
            : { kind: 'unknown' },
        )
      } catch {
        if (controller.signal.aborted) return
        /**
         * Erro de rede, `404` de rota (api mais antiga que o front) ou qualquer outra
         * falha: `unknown`. Degradação silenciosa — o envio revalida no servidor.
         */
        setLineStatus({ kind: 'unknown' })
      }
    }

    void checkStatus()

    return () => controller.abort()
  }, [selectedConnectorId])

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

  /**
   * O que cada modo exige para habilitar o Enviar. A linha e o destino valem para os
   * dois; o resto é do modo.
   *
   * No template, `hasAllTemplateVariables` é o que impede o envio incompleto: o
   * provider recusaria por contagem de parâmetros, e o operador levaria a recusa da
   * Meta como se fosse erro nosso.
   */
  const canSubmitFreeMessage =
    (message.trim().length > 0 || attachments.length > 0) &&
    !hasOversizedAttachment &&
    !audioUrl

  const canSubmitTemplate =
    !!selectedTemplate &&
    canSendWidgetTemplate({
      template: selectedTemplate,
      values: templateValues,
      buttonValues: templateButtonValues,
      headerImageUrl: templateHeaderImageUrl,
      headerImageUploading,
    })

  const buttonValidationMessage = buttonComposerValidationMessage(
    buttonBody,
    buttons,
    allowedButtonTypes,
    maxButtons,
  )
  const canSubmitButtons = buttonValidationMessage === null

  const canSubmit =
    selectedConnectorId.trim() &&
    selectedDestinationPhone.trim() &&
    !isSending &&
    (composerMode === 'template'
      ? canSubmitTemplate
      : composerMode === 'button'
        ? canSubmitButtons
        : canSubmitFreeMessage)

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

  /**
   * `REPLY` não convive com `URL`/`CALL` no mesmo envio — trocar de família
   * reinicia a lista, em vez de deixar o operador montar uma combinação que
   * o envio vai recusar. Mesma família acumula (`appendWidgetButton`).
   */
  const addButton = (type: WidgetButtonType) => {
    setButtons(previous => appendWidgetButton(previous, type))
  }

  const updateButton = (id: string, patch: Partial<WidgetButtonEntry>) => {
    setButtons(previous =>
      previous.map(button =>
        button.id === id ? { ...button, ...patch } : button,
      ),
    )
  }

  const removeButton = (id: string) => {
    setButtons(previous => previous.filter(button => button.id !== id))
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

    /**
     * Antes do `try`: sem entidade, nenhum envio sai. A API recusaria com erro de
     * validação cru; aqui o operador recebe uma mensagem que entende, e o rascunho
     * fica intacto porque só o caminho de sucesso limpa o formulário.
     */
    const info = window.BX24?.placement?.info?.()
    const crmEntity = resolveWidgetEntity(info?.placement, info?.options)
    if (!crmEntity) {
      setErrorFeedback(
        'Não foi possível identificar a ficha do CRM em que o widget está aberto.',
      )
      return
    }
    const { entity, entityId } = crmEntity

    try {
      setIsSending(true)
      setFeedbackMessage('')

      const payloadBase = {
        // Id do item de assinatura, direto do `id` da linha selecionada — a mesma
        // chave que a tela de ajustes e os grupos usam. Sem transformação.
        subscriptionItemId: selectedConnectorId,
        destination: normalizePhoneNumber(selectedDestination?.phone ?? ''),
        message: message.trim() || undefined,
        entity,
        entityId,
      }

      /**
       * Ramo de template: rota própria, payload próprio. Nada de `message` nem de
       * anexo entra aqui — nem poderia, o modo não deixa preencher.
       *
       * `return` no fim do bloco: o caminho livre abaixo não pode ser alcançado com
       * uma linha oficial selecionada.
       */
      if (composerMode === 'template') {
        if (!selectedTemplate) return

        await client.client.post('/thinkzap/messages/send-widget-template', {
          subscriptionItemId: selectedConnectorId,
          destination: normalizePhoneNumber(selectedDestination?.phone ?? ''),
          templateName: selectedTemplate.name,
          language: selectedTemplate.language,
          bodyParameters: orderedTemplateParameters(
            selectedTemplate.body,
            templateValues,
          ),
          /**
           * O corpo vai junto para o servidor resolver o texto que o histórico do CRM
           * guarda — sem ele, a API teria de consultar o catálogo do provider a cada
           * envio só para descobrir onde os parâmetros entram.
           */
          templateBody: selectedTemplate.body,
          buttonParameters: templateButtonParameters(
            selectedTemplate.buttons,
            templateButtonValues,
          ),
          ...(needsHeaderImage(selectedTemplate)
            ? { headerImageUrl: templateHeaderImageUrl.trim() }
            : {}),
          entity,
          entityId,
        })

        setSelectedTemplateKey('')
        setTemplateValues({})
        setTemplateButtonValues({})
        resetHeaderImage(headerImageSource)
        /**
         * O template passou a ser enfileirado, como o texto livre: o servidor responde
         * `202` e a entrega acontece logo depois, com retentativa. Dizer "enviado com
         * sucesso" afirmaria uma entrega que ainda não aconteceu — e no template isso
         * custa caro, porque o operador que acredita na falha reenvia, e a Meta cobra
         * o segundo.
         */
        setSuccessFeedback(
          'Template na fila de envio. Você será avisado na timeline se ele não for entregue.',
        )
        return
      }

      /**
       * Ramo de botões: rota própria, disponível nos dois providers — ao
       * contrário do template, não há `return` condicionado a provider aqui.
       */
      if (composerMode === 'button') {
        if (!canSubmitButtons) return

        await client.client.post('/thinkzap/messages/send-widget-button', {
          subscriptionItemId: selectedConnectorId,
          destination: normalizePhoneNumber(selectedDestination?.phone ?? ''),
          body: buttonBody.trim(),
          header: buttonHeader.trim() || undefined,
          footer: buttonFooter.trim() || undefined,
          buttons: buttons.map(toButtonPayload),
          entity,
          entityId,
        })

        setButtonBody('')
        setButtonHeader('')
        setButtonFooter('')
        setButtons([])
        setSuccessFeedback(
          'Mensagem com botões na fila de envio. Você será avisado na timeline se ela não for entregue.',
        )
        return
      }

      /**
       * Os dois caminhos têm garantias diferentes, e o texto de sucesso segue essa
       * diferença.
       *
       * **Anexo** continua sendo entregue dentro do próprio request: sucesso aqui
       * significa que o contato recebeu.
       *
       * **Texto** passou a ser enfileirado: o servidor responde `202` e a entrega
       * acontece logo depois, com retentativa. Dizer "enviada com sucesso" afirmaria
       * uma entrega que ainda não aconteceu — o que era exatamente o problema, porque
       * o operador acreditava que a mensagem tinha saído quando ela se perdera.
       */
      let queued = false

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
        queued = true
      }

      /**
       * O composer é limpo nos dois casos. No caminho enfileirado isso mudou de
       * significado: a mensagem agora é durável no servidor, então preservar o rascunho
       * convidaria o operador a reenviar o que já vai sair — e o contato receberia duas
       * vezes. O rascunho só sobrevive a **erro**, no `catch` abaixo.
       */
      setMessage('')
      setAttachments([])
      recorder.clearRecording()
      playback.resetPlayback()
      setSuccessFeedback(
        queued
          ? 'Mensagem na fila de envio. Você será avisado na timeline se ela não for entregue.'
          : 'Mensagem enviada com sucesso.',
      )
    } catch (error) {
      /**
       * A recusa por desconexão é traduzida pelo `code`, não pelo texto da resposta —
       * a mensagem do servidor é interpolada com o id do item.
       *
       * A mensagem digitada e os anexos **não** são limpos: só o caminho de sucesso
       * acima limpa o formulário. Jogar fora o trabalho do operador numa recusa que
       * ele resolve trocando de linha seria o pior desfecho possível.
       */
      if (isLineDisconnectedError(error)) {
        setErrorFeedback(LINE_DISCONNECTED_MESSAGE)
        /**
         * O servidor acabou de dizer o que a consulta de seleção só supunha: alinha o
         * aviso com o que o envio descobriu.
         */
        setLineStatus({ kind: 'known', connected: false })
      } else {
        setErrorFeedback(
          thinkzapApiErrorMessage(
            error,
            'Falha ao enviar mensagem. Verifique os dados e tente novamente.',
          ),
        )
      }
    } finally {
      setIsSending(false)
    }
  }

  if (aplicationState.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            <p className="text-sm text-slate-600">Carregando suas linhas...</p>
          </div>
        </div>
      </div>
    )
  }

  /**
   * Falha de leitura **não** vira lista vazia, e não renderiza o formulário: compor
   * uma mensagem sobre um contexto ilegível seria compor algo que não tem por onde
   * sair. Ver spec `widget-line-listing`.
   */
  if (aplicationState.status !== 'ready') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Não foi possível carregar suas linhas
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {contextErrorMessage(
              aplicationState.status,
              aplicationState.status === 'error'
                ? aplicationState.message
                : undefined,
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        {!lines.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              Nenhuma linha disponível para envio
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Nenhuma das linhas desta instalação está habilitada. Verifique a
              tela de conexões.
            </p>
          </div>
        ) : (
          <form
            onSubmit={event => {
              void handleSubmit(event)
            }}
            className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg backdrop-blur sm:p-6"
          >
            {/*
              Aviso **acima** do grid e na largura toda, não embaixo do select: dentro
              da coluna ele empurrava o campo Destino para fora do alinhamento, e o
              texto de duas linhas quebrava o layout do par de selects.

              Só aparece quando a leitura deu certo e disse desconectada — `checking` e
              `unknown` não avisam nada.

              Não desabilita o Enviar de propósito — o estado do provider muda sozinho
              (o telefone volta, o cliente reconecta), e travar o botão com base numa
              leitura de segundos atrás transformaria um aviso recuperável em bloqueio
              falso. O servidor decide no envio.
            */}
            {lineStatus.kind === 'known' && !lineStatus.connected ? (
              <p className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Esta linha não está conectada. Reconecte o número na tela de
                conexões antes de enviar.
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5">
              <label className="group grid min-w-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Linha
                </span>
                <select
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  value={selectedConnectorId}
                  onChange={event => setSelectedConnectorId(event.target.value)}
                  disabled={isSending}
                >
                  <option value="">Selecione uma linha</option>
                  {/*
                    Sem indicador de conectado/offline: status ao vivo não está no
                    item de assinatura, e buscá-lo por linha para rotular uma
                    `<option>` é o custo que esta tela deixou de pagar. Linha
                    desconectada continua ofertada — o aviso da linha **selecionada**
                    fica acima do grid, com uma consulta só, e o envio por ela é
                    recusado com erro próprio antes de tocar o provider.
                  */}
                  {lines.map(line => (
                    <option key={line.id} value={line.id}>
                      {line.name} - {PROVIDER_LABEL[line.provider]}
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

            {/*
              Toggle explícito do modo botões — ao contrário de template/livre, que o
              provider decide, botão funciona nos dois e é o operador quem escolhe.
              Fica fora do `disabled` de linha/destino de propósito: o operador pode
              armar o modo antes de escolher a linha.
            */}
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={buttonModeActive}
                onChange={event => setButtonModeActive(event.target.checked)}
                disabled={isSending}
              />
              Enviar mensagem com botões
            </label>

            {/*
              Modo template/botões substitui o composer livre inteiro — textarea,
              anexos e gravação de áudio saem da árvore, não ficam apenas
              desabilitados. Linha oficial só envia template aprovado, e deixar os
              controles visíveis sugeriria que existe um caminho livre que não existe;
              botões seguem a mesma regra por consistência de tela.
            */}
            {composerMode === 'template' ? (
              <TemplateComposer
                templates={widgetTemplates.templates}
                loading={widgetTemplates.loading}
                error={widgetTemplates.error}
                selectedKey={selectedTemplateKey}
                onSelectTemplate={key => {
                  setSelectedTemplateKey(key)
                  /**
                   * Variáveis do template anterior não são reaproveitadas: mesmo
                   * placeholder pode significar outra coisa no template novo.
                   */
                  setTemplateValues({})
                  setTemplateButtonValues({})
                  resetHeaderImage(headerImageSource)
                }}
                values={templateValues}
                onChangeValue={(key, value) =>
                  setTemplateValues(previous => ({ ...previous, [key]: value }))
                }
                buttonValues={templateButtonValues}
                onChangeButtonValue={(index, value) =>
                  setTemplateButtonValues(previous => ({
                    ...previous,
                    [index]: value,
                  }))
                }
                headerImageUrl={templateHeaderImageUrl}
                onChangeHeaderImageUrl={setTemplateHeaderImageUrl}
                headerImageUploadAvailable={widgetTemplates.headerImageUpload}
                headerImageSource={
                  widgetTemplates.headerImageUpload ? headerImageSource : 'LINK'
                }
                onChangeHeaderImageSource={source => resetHeaderImage(source)}
                onPickHeaderImageFile={file => void pickHeaderImageFile(file)}
                headerImageFileName={headerImageFileName}
                headerImageUploading={headerImageUploading}
                headerImageUploadError={headerImageUploadError}
                disabled={isSending}
              />
            ) : composerMode === 'button' ? (
              <>
                <ButtonComposer
                  body={buttonBody}
                  onChangeBody={setButtonBody}
                  header={buttonHeader}
                  onChangeHeader={setButtonHeader}
                  footer={buttonFooter}
                  onChangeFooter={setButtonFooter}
                  buttons={buttons}
                  allowedTypes={allowedButtonTypes}
                  maxButtons={maxButtons}
                  onAddButton={addButton}
                  onUpdateButton={updateButton}
                  onRemoveButton={removeButton}
                  disabled={isSending}
                />
                {!selectedLine ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Escolha uma linha para saber quais tipos de botão estão
                    disponíveis.
                  </p>
                ) : null}
              </>
            ) : (
              <>
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
                        fallbackDurationSeconds={
                          recorder.recordedDurationSeconds
                        }
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
                        Clique em Adicionar para incluir o audio na lista de
                        anexos antes de enviar.
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
                        const oversized = !isAttachmentWithinSizeLimit(
                          item.size,
                        )
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
              </>
            )}

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
