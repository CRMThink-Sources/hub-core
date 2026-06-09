'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2Icon, PlusIcon, XCircleIcon } from 'lucide-react'
import type { Dataset, Source, SourceSettings } from '../../types'
import { axiosThinkanalise } from '../../../_lib/thinkanalise-client'
import { DatasetCard } from '../dataset/dataset-card'
import { DatasetForm } from '../dataset/dataset-form'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Switch } from '@/components/ui/switch' // toggle ativo/inativo desabilitado temporariamente

const AUTH_TOKEN_KEY = 'hubthink_auth_token'

/** Badge de resultado do teste de conexão — sucesso/erro, com ícone. */
function TestStatusBadge({
  status,
  okLabel,
  erroLabel,
}: {
  status: 'idle' | 'ok' | 'erro'
  okLabel: string
  erroLabel: string
}) {
  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-accent px-2.5 py-1 text-xs font-semibold text-primary">
        <CheckCircle2Icon className="size-3.5" />
        {okLabel}
      </span>
    )
  }
  if (status === 'erro') {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
        <XCircleIcon className="size-3.5" />
        {erroLabel}
      </span>
    )
  }
  return null
}

type Props = {
  source: Source
  connectorId: number
  provider: string
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
}

type NewSourceProps = {
  connectorId: number
  provider: string
  onSaved: () => Promise<void>
  onCancel: () => void
}

async function startContaAzulOAuth(
  client: ReturnType<typeof axiosThinkanalise>,
  params: { connectorId: number; title: string } | { sourceId: number },
): Promise<void> {
  const result = (await client.get('/thinkanalise/oauth/conta-azul/start', {
    params,
  })) as unknown as { url: string; logoutUrl: string }

  window.open(result.logoutUrl, 'conta-azul-oauth', 'width=500,height=700')
}

export function SourceCard({
  source,
  connectorId: _connectorId,
  provider,
  onSaved,
  onDeleted,
}: Props) {
  const isContaAzul = provider === 'conta_azul'
  const isSonax = provider === 'sonax'
  const { t } = useTranslation('thinkanalise/configuracoes/source')

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({ title: source.title, apiKey: '' })
  const [sonaxDraft, setSonaxDraft] = useState({ id_cliente: '', token: '' })
  const [addingDataset, setAddingDataset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const { setLoading } = useLoading()

  async function loadDatasets() {
    const client = axiosThinkanalise(AUTH_TOKEN_KEY)
    const data = (await client.get(
      `/thinkanalise/source/${source.id}/datasets`,
    )) as unknown as Dataset[]
    setDatasets(data)
  }

  useEffect(() => {
    const controller = new AbortController()
    axiosThinkanalise(AUTH_TOKEN_KEY)
      .get(`/thinkanalise/source/${source.id}/datasets`, {
        signal: controller.signal,
      })
      .then(data => setDatasets(data as unknown as Dataset[]))
      .catch(() => {})
    return () => controller.abort()
  }, [source.id])

  function handleCancelEdit() {
    setDraft({ title: source.title, apiKey: '' })
    setSonaxDraft({ id_cliente: '', token: '' })
    setIsEditing(false)
    setTestStatus('idle')
  }

  async function handleTest() {
    const apiKey = isSonax
      ? JSON.stringify({
          id_cliente: sonaxDraft.id_cliente,
          token: sonaxDraft.token,
        })
      : draft.apiKey || source.settings.api_key
    setTesting(true)
    setTestStatus('idle')
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
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
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      const fields: { title?: string; settings?: SourceSettings } = {}
      if (draft.title !== source.title) fields.title = draft.title
      if (isSonax && (sonaxDraft.id_cliente || sonaxDraft.token)) {
        fields.settings = {
          integration: provider,
          api_key: JSON.stringify({
            id_cliente: sonaxDraft.id_cliente,
            token: sonaxDraft.token,
          }),
        }
      } else if (!isContaAzul && !isSonax && draft.apiKey) {
        fields.settings = { integration: provider, api_key: draft.apiKey }
      }
      await client.put(`/thinkanalise/source/${source.id}`, fields)
      await onSaved()
      setIsEditing(false)
      setDraft(d => ({ ...d, apiKey: '' }))
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleConnectOAuth() {
    setConnecting(true)
    setConnectError(false)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await startContaAzulOAuth(client, { sourceId: source.id })
    } catch (err) {
      console.error('[ContaAzulOAuth] erro ao iniciar conexão:', err)
      setConnectError(true)
    } finally {
      setConnecting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setLoading(true, t('loading.removendo'))
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.delete(`/thinkanalise/source/${source.id}`)
      await onDeleted()
    } finally {
      setDeleting(false)
      setLoading(false)
    }
  }

  // Toggle ativo/inativo desabilitado temporariamente: o Bitrix ignora
  // `active` no source.update e sempre retorna active=true.
  // async function handleToggleActive() {
  //   setLoading(true, t('loading.atualizando'))
  //   try {
  //     const client = axiosThinkanalise(AUTH_TOKEN_KEY)
  //     await client.put(`/thinkanalise/source/${source.id}`, {
  //       title: source.title,
  //       active: !source.active,
  //     })
  //     await onSaved()
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  useEffect(() => {
    if (!isContaAzul) return
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== 'conta-azul-oauth') return
      if (event.data.status === 'success') void onSaved()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isContaAzul, onSaved])

  const isConnected = Boolean(source.settings.api_key)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      {/* cabeçalho da fonte */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm font-medium text-foreground">
          {isEditing ? (
            <Input
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="h-8"
            />
          ) : (
            source.title
          )}
        </span>

        {/* Toggle ativo/inativo desabilitado temporariamente: Bitrix
            ignora `active` no source.update e sempre retorna active=true. */}
        {/* <Switch
          checked={source.active}
          onCheckedChange={() => void handleToggleActive()}
          aria-label={
            source.active ? t('botoes.desativar') : t('botoes.ativar')
          }
        />
        <span className="text-xs text-muted-foreground">
          {source.active ? t('status.ativo') : t('status.inativo')}
        </span> */}
      </div>

      {/* campos em edição */}
      {isEditing && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          {isContaAzul ? (
            <div className="flex items-center gap-3">
              <span
                className={
                  isConnected
                    ? 'text-xs text-primary'
                    : 'text-xs text-muted-foreground'
                }
              >
                {isConnected ? t('status.conectado') : t('status.naoConectado')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleConnectOAuth()}
                disabled={connecting}
              >
                {connecting
                  ? t('botoes.redirecionando')
                  : t('botoes.reconectarContaAzul')}
              </Button>
              {connectError && (
                <span className="text-xs text-destructive">
                  {t('botoes.erroConexao')}
                </span>
              )}
            </div>
          ) : isSonax ? (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('campos.idCliente')}
                </Label>
                <Input
                  value={sonaxDraft.id_cliente}
                  onChange={e =>
                    setSonaxDraft(d => ({ ...d, id_cliente: e.target.value }))
                  }
                  placeholder={t('campos.manterPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('campos.token')}
                </Label>
                <Input
                  type="password"
                  value={sonaxDraft.token}
                  onChange={e =>
                    setSonaxDraft(d => ({ ...d, token: e.target.value }))
                  }
                  placeholder={t('campos.manterPlaceholder')}
                />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest()}
                  disabled={
                    testing || (!sonaxDraft.id_cliente && !sonaxDraft.token)
                  }
                >
                  {testing ? t('botoes.testando') : t('botoes.testarConexao')}
                </Button>
                <TestStatusBadge
                  status={testStatus}
                  okLabel={t('status.conexaoOk')}
                  erroLabel={t('status.credenciaisInvalidas')}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('campos.apiKey')}
                </Label>
                <Input
                  type="password"
                  value={draft.apiKey}
                  onChange={e =>
                    setDraft(d => ({ ...d, apiKey: e.target.value }))
                  }
                  placeholder={t('campos.manterPlaceholder')}
                />
              </div>

              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
                  {testing ? t('botoes.testando') : t('botoes.testarConexao')}
                </Button>
                <TestStatusBadge
                  status={testStatus}
                  okLabel={t('status.conexaoOk')}
                  erroLabel={t('status.apiKeyInvalida')}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* seção de datasets */}
      <div className="flex flex-col gap-2 px-4 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t('datasets')} ({datasets.length})
          </span>
          {!addingDataset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingDataset(true)}
            >
              <PlusIcon />
              {t('novoDataset')}
            </Button>
          )}
        </div>

        {datasets.map(d => (
          <DatasetCard
            key={d.id}
            dataset={d}
            onChanged={loadDatasets}
            onDeleted={loadDatasets}
          />
        ))}

        {addingDataset && (
          <DatasetForm
            sourceId={source.id}
            integration={provider}
            onSaved={async () => {
              setAddingDataset(false)
              await loadDatasets()
            }}
            onCancel={() => setAddingDataset(false)}
          />
        )}
      </div>

      {/* rodapé */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        {isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
              {t('botoes.cancelar')}
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || !draft.title}
            >
              {saving ? t('botoes.salvando') : t('botoes.salvar')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? t('botoes.removendo') : t('botoes.remover')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {t('botoes.editar')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function NewSourceCard({
  connectorId,
  provider,
  onSaved,
  onCancel,
}: NewSourceProps) {
  const isContaAzul = provider === 'conta_azul'
  const isSonax = provider === 'sonax'
  const { t } = useTranslation('thinkanalise/configuracoes/source')

  const [title, setTitle] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [sonaxCreds, setSonaxCreds] = useState({ id_cliente: '', token: '' })
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const { setLoading } = useLoading()

  useEffect(() => {
    if (!isContaAzul) return
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== 'conta-azul-oauth') return
      if (event.data.status === 'success') void onSaved()
      else setSaving(false)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isContaAzul, onSaved])

  async function handleTest() {
    const testApiKey = isSonax
      ? JSON.stringify({
          id_cliente: sonaxCreds.id_cliente,
          token: sonaxCreds.token,
        })
      : apiKey
    setTesting(true)
    setTestStatus('idle')
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post('/thinkanalise/check', {
        connection: { integration: provider, api_key: testApiKey },
      })
      setTestStatus('ok')
    } catch {
      setTestStatus('erro')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    const effectiveApiKey = isSonax
      ? JSON.stringify({
          id_cliente: sonaxCreds.id_cliente,
          token: sonaxCreds.token,
        })
      : apiKey
    if (!title || !effectiveApiKey) return
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post(`/thinkanalise/connector/${connectorId}/source`, {
        title,
        settings: { integration: provider, api_key: effectiveApiKey },
        active: true,
      })
      await onSaved()
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  const [saveConnectError, setSaveConnectError] = useState(false)

  async function handleSaveAndConnect() {
    if (!title) return
    setSaving(true)
    setSaveConnectError(false)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await startContaAzulOAuth(client, { connectorId, title })
    } catch (err) {
      console.error('[ContaAzulOAuth] erro ao iniciar OAuth:', err)
      setSaveConnectError(true)
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

        {isSonax && (
          <>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('campos.idCliente')}
              </Label>
              <Input
                value={sonaxCreds.id_cliente}
                onChange={e =>
                  setSonaxCreds(d => ({ ...d, id_cliente: e.target.value }))
                }
                placeholder="Ex: 215"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('campos.token')}
              </Label>
              <Input
                type="password"
                value={sonaxCreds.token}
                onChange={e =>
                  setSonaxCreds(d => ({ ...d, token: e.target.value }))
                }
                placeholder="Token de 20+ caracteres"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTest()}
                disabled={
                  testing || !sonaxCreds.id_cliente || !sonaxCreds.token
                }
              >
                {testing ? t('botoes.testando') : t('botoes.testarConexao')}
              </Button>
              <TestStatusBadge
                status={testStatus}
                okLabel={t('status.conexaoOk')}
                erroLabel={t('status.credenciaisInvalidas')}
              />
            </div>
          </>
        )}

        {!isContaAzul && !isSonax && (
          <>
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
              <TestStatusBadge
                status={testStatus}
                okLabel={t('status.conexaoOk')}
                erroLabel={t('status.apiKeyInvalida')}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('botoes.cancelar')}
        </Button>
        {isContaAzul ? (
          <>
            {saveConnectError && (
              <span className="mr-auto text-xs text-destructive">
                {t('botoes.erroConexao')}
              </span>
            )}
            <Button
              size="sm"
              onClick={() => void handleSaveAndConnect()}
              disabled={saving || !title}
            >
              {saving
                ? t('botoes.redirecionando')
                : t('botoes.salvarConectarContaAzul')}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={
              saving ||
              !title ||
              (isSonax ? !sonaxCreds.id_cliente || !sonaxCreds.token : !apiKey)
            }
          >
            {saving ? t('botoes.salvando') : t('botoes.salvarFonte')}
          </Button>
        )}
      </div>
    </div>
  )
}
