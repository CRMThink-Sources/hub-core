'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

type ConnectorSettings = {
  prefixOperatorNameEnabled: boolean
}

type Connector = {
  id: string
  instance: {
    name: string
    phoneNumber?: string | null
    settings?: ConnectorSettings
  }
}

type Props = {
  connector: Connector
  authTokenKey: string
  onSaved?: () => void
}

export function GeralTab({ connector, authTokenKey, onSaved }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/geral')
  const [name, setName] = useState('')
  const [prefixOperatorNameEnabled, setPrefixOperatorNameEnabled] =
    useState(false)
  const [initialName, setInitialName] = useState('')
  const [
    initialPrefixOperatorNameEnabled,
    setInitialPrefixOperatorNameEnabled,
  ] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const connectorName = connector.instance.name ?? ''
    const connectorPrefixEnabled =
      connector.instance.settings?.prefixOperatorNameEnabled ?? false

    setName(connectorName)
    setPrefixOperatorNameEnabled(connectorPrefixEnabled)
    setInitialName(connectorName)
    setInitialPrefixOperatorNameEnabled(connectorPrefixEnabled)
  }, [connector])

  const hasChanges =
    name !== initialName ||
    prefixOperatorNameEnabled !== initialPrefixOperatorNameEnabled

  const canSave = hasChanges && name.trim().length > 0

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const client = axiosThinkzap(authTokenKey)

      await client.put(`/thinkzap/instance/${connector.id}`, {
        name,
        settings: {
          prefixOperatorNameEnabled,
        },
      })

      setInitialName(name)
      setInitialPrefixOperatorNameEnabled(prefixOperatorNameEnabled)
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Erro ao salvar configurações',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-black">
          {t('nomeCanal')}
        </label>
        <input
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5A997E]"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-black">
          {t('telefone')}
        </label>
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {connector.instance.phoneNumber || t('semTelefone')}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={prefixOperatorNameEnabled}
          onChange={e => setPrefixOperatorNameEnabled(e.target.checked)}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-black">
            {t('prefixOperatorName')}
          </span>
          <span className="text-sm text-gray-600">
            {t('prefixOperatorNameHint')}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
          className="cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4a8169] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('salvando') : t('salvar')}
        </button>
        {saved && <span className="text-sm text-[#5A997E]">{t('salvo')}</span>}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>
    </div>
  )
}
