import { useCallback, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
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
 * Operações de templates de um conector oficial. Os endpoints são
 * `/thinkzap/connector/:id/templates` (list/create) e `.../sync`.
 */
export function useConnectorTemplates(authTokenKey: string) {
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(
    async (connectorId: string) => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        const { templates: list } = await client.get<{
          templates: ConnectorTemplate[]
        }>(`/thinkzap/connector/${connectorId}/templates`)
        setTemplates(list)
        return list
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Falha ao carregar templates'))
        setTemplates([])
        return []
      } finally {
        setLoading(false)
      }
    },
    [authTokenKey],
  )

  const syncTemplates = useCallback(
    async (connectorId: string) => {
      setLoading(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        const { templates: list } = await client.post<{
          templates: ConnectorTemplate[]
        }>(`/thinkzap/connector/${connectorId}/templates/sync`)
        setTemplates(list)
        return list
      } catch (err: unknown) {
        setError(extractThinkzapError(err, 'Falha ao sincronizar templates'))
        return []
      } finally {
        setLoading(false)
      }
    },
    [authTokenKey],
  )

  return { templates, loading, error, fetchTemplates, syncTemplates, setError }
}

/**
 * Cadastro de template isolado do estado da lista para permitir tratamento de
 * erro próprio (mantendo os dados do formulário ao falhar).
 */
export function useCreateTemplate(authTokenKey: string) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = useCallback(
    async (connectorId: string, payload: CreateTemplatePayload) => {
      setSaving(true)
      setError(null)
      try {
        const client = axiosThinkzap(authTokenKey)
        await client.post(
          `/thinkzap/connector/${connectorId}/templates`,
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
    [authTokenKey],
  )

  return { createTemplate, saving, error, setError }
}
