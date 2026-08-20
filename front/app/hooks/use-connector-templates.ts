import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'

export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type TemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  [key: string]: unknown
}

export type ConnectorTemplate = {
  id: string
  name: string
  category: TemplateCategory
  language: string
  status: TemplateStatus
  components: TemplateComponent[]
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

  return { templates, loading, error, fetchTemplates, syncTemplates, setError }
}

/**
 * Cadastro de template isolado do estado da lista para permitir tratamento de
 * erro próprio (mantendo os dados do formulário ao falhar).
 */
export function useCreateTemplate() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = useCallback(
    async (itemId: string, payload: CreateTemplatePayload) => {
      setSaving(true)
      setError(null)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        await client.post(
          `/thinkzap/lines/${encodeURIComponent(itemId)}/templates`,
          payload,
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
