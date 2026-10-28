import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'

export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * Botão no formato de cadastro da Meta. `COPY_CODE` não tem `text`: o rótulo é do
 * WhatsApp. URL dinâmica termina em `{{1}}` e leva `example` com a URL completa.
 */
export type TemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'COPY_CODE'; example: string }

export type TemplateButtonType = TemplateButton['type']

export type TemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  /** Só em `BUTTONS`. Template sincronizado pode trazer tipos fora de `TemplateButton`. */
  buttons?: TemplateButton[]
  [key: string]: unknown
}

export type ConnectorTemplate = {
  id: string
  name: string
  category: TemplateCategory
  language: string
  status: TemplateStatus
  components: TemplateComponent[]
  /**
   * Imagem padrão do envio, em template com cabeçalho de imagem: é a que o widget e
   * o robô usam quando ninguém informa outra. Ausente = ainda não definida.
   */
  defaultImageUrl?: string
}

export type CreateTemplatePayload = {
  name: string
  category: TemplateCategory
  language: string
  components: TemplateComponent[]
}

/**
 * Operações de templates de uma linha oficial. Os endpoints são
 * `/thinkzap/lines/:itemId/templates` (list/create) e `.../sync`.
 */
export function useConnectorTemplates() {
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async (itemId: string) => {
    setLoading(true)
    setError(null)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const { templates: list } = await client.get<{
        templates: ConnectorTemplate[]
      }>(`/thinkzap/lines/${encodeURIComponent(itemId)}/templates`)
      setTemplates(list)
      return list
    } catch (err: unknown) {
      setError(extractThinkzapError(err, 'Falha ao carregar templates'))
      setTemplates([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const syncTemplates = useCallback(async (itemId: string) => {
    setLoading(true)
    setError(null)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const { templates: list } = await client.post<{
        templates: ConnectorTemplate[]
      }>(`/thinkzap/lines/${encodeURIComponent(itemId)}/templates/sync`)
      setTemplates(list)
      return list
    } catch (err: unknown) {
      setError(extractThinkzapError(err, 'Falha ao sincronizar templates'))
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    syncTemplates,
    setError,
    setTemplates,
  }
}

/**
 * Pedido multipart da criação com arquivo: o JSON de sempre em `payload` e a
 * imagem em `headerImage` — os nomes que a API lê.
 */
export function buildCreateTemplateFormData(
  payload: CreateTemplatePayload,
  headerImageFile: Blob,
): FormData {
  const form = new FormData()
  form.append('payload', JSON.stringify(payload))
  form.append('headerImage', headerImageFile)
  return form
}

/**
 * Cadastro de template isolado do estado da lista para permitir tratamento de
 * erro próprio (mantendo os dados do formulário ao falhar).
 */
export function useCreateTemplate() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = useCallback(
    async (
      itemId: string,
      payload: CreateTemplatePayload,
      /** Imagem de exemplo do cabeçalho como arquivo; ausente = pedido JSON. */
      headerImageFile?: File,
    ) => {
      setSaving(true)
      setError(null)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        await client.post(
          `/thinkzap/lines/${encodeURIComponent(itemId)}/templates`,
          headerImageFile
            ? buildCreateTemplateFormData(payload, headerImageFile)
            : payload,
        )
        return true
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Falha ao cadastrar template'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { createTemplate, saving, error, setError }
}

/**
 * Edição de template: mesmo pedido da criação, por `PUT` no `id` remoto. O
 * template volta para análise da Meta.
 *
 * Cabeçalho de imagem sem `example` e sem arquivo = manter a imagem atual (a API
 * usa a imagem padrão do envio como amostra).
 */
export function useUpdateTemplate() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateTemplate = useCallback(
    async (
      itemId: string,
      templateId: string,
      payload: CreateTemplatePayload,
      headerImageFile?: File,
    ) => {
      setSaving(true)
      setError(null)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        await client.put(
          `/thinkzap/lines/${encodeURIComponent(itemId)}/templates/${encodeURIComponent(templateId)}`,
          headerImageFile
            ? buildCreateTemplateFormData(payload, headerImageFile)
            : payload,
        )
        return true
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Falha ao editar template'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { updateTemplate, saving, error, setError }
}

/** Imagem padrão: o link em JSON, ou o arquivo em `image` (multipart). */
export function buildDefaultImageRequest(
  source: { imageUrl: string } | { file: Blob },
): FormData | { imageUrl: string } {
  if ('imageUrl' in source) return { imageUrl: source.imageUrl.trim() }
  const form = new FormData()
  form.append('image', source.file)
  return form
}

/**
 * Define ou troca a imagem padrão do envio de um template com cabeçalho de
 * imagem. Devolve a URL gravada, ou `null` na falha (com `error` preenchido).
 */
export function useSetTemplateDefaultImage() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDefaultImage = useCallback(
    async (
      itemId: string,
      template: Pick<ConnectorTemplate, 'name' | 'language'>,
      source: { imageUrl: string } | { file: File },
    ): Promise<string | null> => {
      setSaving(true)
      setError(null)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        const { headerImageUrl } = await client.put<{ headerImageUrl: string }>(
          `/thinkzap/lines/${encodeURIComponent(itemId)}/templates/${encodeURIComponent(template.name)}/${encodeURIComponent(template.language)}/default-image`,
          buildDefaultImageRequest(source),
        )
        return headerImageUrl
      } catch (err: unknown) {
        setError(
          extractThinkzapError(err, 'Falha ao salvar a imagem padrão do envio'),
        )
        return null
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { setDefaultImage, saving, error, setError }
}
