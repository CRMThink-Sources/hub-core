'use client'

import { useState } from 'react'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { axiosThinkanalise } from '../../../_lib/thinkanalise-client'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SourceFormProps = {
  connectorId: number
  provider: string
  onSaved: () => Promise<void>
  onCancel: () => void
}

export function SourceForm({
  connectorId,
  provider,
  onSaved,
  onCancel,
}: SourceFormProps) {
  const [title, setTitle] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const { setLoading } = useLoading()
  const { t } = useTranslation('thinkanalise/configuracoes/source')

  async function handleTest() {
    setTesting(true)
    setTestStatus('idle')
    try {
      const client = axiosThinkanalise()
      await client.post('/thinkanalise/check', {
        connection: { integration: provider, api_key: apiKey },
      })
      setTestStatus('ok')
    } catch {
      setTestStatus('erro')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!title || !apiKey) return
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise()
      await client.post(`/thinkanalise/connector/${connectorId}/source`, {
        title,
        settings: { integration: provider, api_key: apiKey },
        active: true,
      })
      await onSaved()
      toast.success(t('toast.fonteCriada'))
    } catch {
      toast.error(t('toast.erroCriarFonte'))
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-primary/40 bg-card">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('campos.nomeFonte')}
          </Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('campos.nomeFontePlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('campos.apiKey')}
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={t('campos.apiKeyPlaceholder')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={testing || !apiKey}
          >
            {testing ? t('botoes.testando') : t('botoes.testarConexao')}
          </Button>
          {testStatus === 'ok' && (
            <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-accent px-2.5 py-1 text-xs font-semibold text-primary">
              <CheckCircle2Icon className="size-3.5" />
              {t('status.conexaoAutenticada')}
            </span>
          )}
          {testStatus === 'erro' && (
            <span className="flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              <XCircleIcon className="size-3.5" />
              {t('status.apiKeyInvalida')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('botoes.cancelar')}
        </Button>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !title || !apiKey}
        >
          {saving ? t('botoes.salvando') : t('botoes.salvarFonte')}
        </Button>
      </div>
    </div>
  )
}
