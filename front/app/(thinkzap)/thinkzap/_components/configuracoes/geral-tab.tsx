'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type ConnectorSettings = {
  prefixOperatorNameEnabled: boolean
  widgetOpenChannelEnabled: boolean
}

type Connector = {
  id: string
  instance: {
    name: string
    phoneNumber?: string | null
    vinculatedChannel?: string | null
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
  const [widgetOpenChannelEnabled, setWidgetOpenChannelEnabled] =
    useState(false)
  const [initialName, setInitialName] = useState('')
  const [
    initialPrefixOperatorNameEnabled,
    setInitialPrefixOperatorNameEnabled,
  ] = useState(false)
  const [initialWidgetOpenChannelEnabled, setInitialWidgetOpenChannelEnabled] =
    useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const connectorName = connector.instance.name ?? ''
    const connectorPrefixEnabled =
      connector.instance.settings?.prefixOperatorNameEnabled ?? false
    const connectorWidgetOpenChannel =
      connector.instance.settings?.widgetOpenChannelEnabled ?? false

    setName(connectorName)
    setPrefixOperatorNameEnabled(connectorPrefixEnabled)
    setWidgetOpenChannelEnabled(connectorWidgetOpenChannel)
    setInitialName(connectorName)
    setInitialPrefixOperatorNameEnabled(connectorPrefixEnabled)
    setInitialWidgetOpenChannelEnabled(connectorWidgetOpenChannel)
  }, [connector])

  const hasChanges =
    name !== initialName ||
    prefixOperatorNameEnabled !== initialPrefixOperatorNameEnabled ||
    widgetOpenChannelEnabled !== initialWidgetOpenChannelEnabled

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
          widgetOpenChannelEnabled,
        },
      })

      setInitialName(name)
      setInitialPrefixOperatorNameEnabled(prefixOperatorNameEnabled)
      setInitialWidgetOpenChannelEnabled(widgetOpenChannelEnabled)
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
      <div className="flex flex-col gap-2">
        <Label>{t('nomeCanal')}</Label>
        <Input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('telefone')}</Label>
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {connector.instance.phoneNumber || t('semTelefone')}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          checked={prefixOperatorNameEnabled}
          onCheckedChange={(checked: boolean) =>
            setPrefixOperatorNameEnabled(checked)
          }
          className="mt-0.5"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {t('prefixOperatorName')}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('prefixOperatorNameHint')}
          </span>
        </span>
      </label>

      <label
        className={`flex items-start gap-2 ${connector.instance.vinculatedChannel ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
      >
        <Checkbox
          checked={widgetOpenChannelEnabled}
          onCheckedChange={(checked: boolean) =>
            setWidgetOpenChannelEnabled(checked)
          }
          disabled={!connector.instance.vinculatedChannel}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {t('widgetOpenChannel')}
          </span>
          <span className="text-sm text-muted-foreground">
            {connector.instance.vinculatedChannel
              ? t('widgetOpenChannelHint')
              : t('widgetOpenChannelNoChannel')}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
        >
          {saving ? t('salvando') : t('salvar')}
        </Button>
        {saved && <span className="text-sm text-primary">{t('salvo')}</span>}
        {saveError && (
          <span className="text-sm text-destructive">{saveError}</span>
        )}
      </div>
    </div>
  )
}
