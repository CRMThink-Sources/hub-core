'use client'

import { useState, useEffect } from 'react'
import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import { PROVIDERS } from '../constants'
import { useAplication } from '@/providers/aplication-provider'
import type { Connection, Source } from '../../types'
import { axiosThinkanalise } from '../../../_lib/thinkanalise-client'
import { SourceCard, NewSourceCard } from '../source/source-card'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PROVIDER_BADGE: Record<string, string> = {
  asaas: 'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]',
  bling: 'bg-[#dcfce7] text-[#15803d] border-[#86efac]',
  conta_azul: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  omie: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  sonax: 'bg-[#ecfeff] text-[#0891b2] border-[#a5f3fc]',
}

const STATUS_DOT: Record<Connection['status'], string> = {
  conectado: 'bg-primary',
  pendente: 'bg-amber-400',
  erro: 'bg-destructive',
}

type Props = {
  connection: Connection
  onChange: (updated: Connection) => void
  onSaved: (id: string) => Promise<void>
  onDeleted: () => Promise<void>
  onRemoveNew: (id: string) => void
  isOpen?: boolean
  onToggle?: () => void
}

export function ConnectorCard({
  connection,
  onChange,
  onSaved,
  onDeleted,
  onRemoveNew,
  isOpen,
  onToggle,
}: Props) {
  const aplication = useAplication()
  const { t } = useTranslation('thinkanalise/configuracoes/connector')
  const BLOCKED_DOMAIN_ID = '9c8d9dca-db2d-4978-93ca-fc28ba6017d7' // domainId do cliente https://bmd.bitrix24.com.br/
  // `customer.id` é o id de `core_domains` — o mesmo valor que vinha em
  // `session.app.domainId`.
  const isBlocked = aplication?.customer.id === BLOCKED_DOMAIN_ID // bloquando para o cliente apenas usar connectores asaas
  const availableProviders = isBlocked
    ? PROVIDERS.filter(p => p.value === 'asaas')
    : PROVIDERS

  const isSaved = !!connection.biconnectorId

  const [draft, setDraft] = useState({ label: connection.label })
  const [isEditing, setIsEditing] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(!isSaved)
  const expanded = isOpen !== undefined ? isOpen : internalExpanded
  function toggleExpanded() {
    if (onToggle) onToggle()
    else setInternalExpanded(prev => !prev)
  }
  const [addingSource, setAddingSource] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)

  const { setLoading } = useLoading()

  async function fetchSources() {
    if (!connection.biconnectorId) return
    setSourcesLoading(true)
    try {
      const client = axiosThinkanalise()
      const data = (await client.get(
        `/thinkanalise/connector/${connection.biconnectorId}/sources`,
      )) as unknown as Source[]
      setSources(data)
    } finally {
      setSourcesLoading(false)
    }
  }

  useEffect(() => {
    if (!expanded || !isSaved || !connection.biconnectorId) return
    const controller = new AbortController()
    setSourcesLoading(true)
    axiosThinkanalise()
      .get(`/thinkanalise/connector/${connection.biconnectorId}/sources`, {
        signal: controller.signal,
      })
      .then(data => setSources(data as unknown as Source[]))
      .catch(() => {})
      .finally(() => setSourcesLoading(false))
    return () => controller.abort()
  }, [expanded, isSaved])

  function updateNew(patch: Partial<Connection>) {
    onChange({ ...connection, ...patch })
  }

  function handleCancelEdit() {
    setDraft({ label: connection.label })
    setIsEditing(false)
  }

  const currentLabel =
    isSaved && !isEditing
      ? connection.label
      : isSaved
        ? draft.label
        : connection.label
  const isReadOnly = isSaved && !isEditing

  async function handleSave() {
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise()
      if (isSaved) {
        await client.put(
          `/thinkanalise/connector/${connection.biconnectorId}`,
          {
            label: draft.label,
          },
        )
        await onSaved(connection.id)
        toast.success(t('toast.atualizado'))
      } else {
        if (!connection.label) return
        await client.post('/thinkanalise/connector', {
          label: connection.label,
          provider: connection.provider,
        })
        await onSaved(connection.id)
        toast.success(t('toast.criado'))
      }
    } catch {
      toast.error(t('toast.erroSalvar'))
      if (!isSaved) onChange({ ...connection, status: 'erro' })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!isSaved) {
      onRemoveNew(connection.id)
      return
    }
    setDeleting(true)
    setLoading(true, t('loading.removendo'))
    try {
      const client = axiosThinkanalise()
      await client.delete(`/thinkanalise/connector/${connection.biconnectorId}`)
      await onDeleted()
      toast.success(t('toast.removido'))
    } catch {
      await onDeleted()
    } finally {
      setDeleting(false)
      setLoading(false)
    }
  }

  const providerLabel =
    PROVIDERS.find(p => p.value === connection.provider)?.label ??
    connection.provider

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* cabeçalho */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full select-none items-center gap-3 border-b border-border bg-muted/40 px-5 py-4 text-left transition-colors hover:bg-muted/60"
      >
        <span
          className={cn(
            'rounded border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
            PROVIDER_BADGE[connection.provider] ?? PROVIDER_BADGE.asaas,
          )}
        >
          {providerLabel}
        </span>

        <span className="text-sm font-semibold text-foreground">
          {currentLabel || (
            <span className="font-normal text-muted-foreground/60">
              {t('semNome')}
            </span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn('size-2 rounded-full', STATUS_DOT[connection.status])}
          />
          <span className="text-xs text-muted-foreground">
            {t(`statusLabel.${connection.status}`)}
          </span>
          <ChevronDownIcon
            className={cn(
              'ml-1 size-4 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      {expanded && (
        <>
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* label — só para novos */}
            {!isSaved && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`connector-name-${connection.id}`}>
                  {t('campos.nome')}
                </Label>
                <Input
                  id={`connector-name-${connection.id}`}
                  value={connection.label}
                  onChange={e => updateNew({ label: e.target.value })}
                  placeholder={t('campos.nomeConexao')}
                />
              </div>
            )}

            {/* label — edição de conector salvo */}
            {isSaved && isEditing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`connector-name-${connection.id}`}>
                  {t('campos.nome')}
                </Label>
                <Input
                  id={`connector-name-${connection.id}`}
                  value={draft.label}
                  onChange={e =>
                    setDraft(d => ({ ...d, label: e.target.value }))
                  }
                />
              </div>
            )}

            {/* integração */}
            <div className="flex flex-col gap-1.5">
              <Label>{t('campos.integracao')}</Label>
              <Select
                value={connection.provider}
                onValueChange={(value: Connection['provider'] | null) => {
                  if (value) updateNew({ provider: value })
                }}
                disabled={isReadOnly || isSaved}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map(p => (
                    <SelectItem
                      key={p.value}
                      value={p.value}
                      disabled={p.disabled}
                    >
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* seção de fontes — só para conectores salvos */}
          {isSaved && (
            <div className="flex flex-col gap-3 px-5 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('fontes')} ({sources.length})
                </span>
                {!addingSource && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingSource(true)}
                  >
                    <PlusIcon />
                    {t('novaFonte')}
                  </Button>
                )}
              </div>

              {sourcesLoading && (
                <p className="px-1 text-xs text-muted-foreground">
                  {t('carregando')}
                </p>
              )}
              {sources.map(s => (
                <SourceCard
                  key={s.id}
                  source={s}
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={fetchSources}
                  onDeleted={fetchSources}
                />
              ))}

              {addingSource && (
                <NewSourceCard
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={async () => {
                    setAddingSource(false)
                    await fetchSources()
                  }}
                  onCancel={() => setAddingSource(false)}
                />
              )}
            </div>
          )}

          {/* rodapé */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? t('acoes.removendo') : t('acoes.remover')}
            </Button>

            {isSaved && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                {t('acoes.editar')}
              </Button>
            )}

            {isSaved && isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  {t('acoes.cancelar')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !draft.label}
                >
                  {saving ? t('acoes.salvando') : t('acoes.salvar')}
                </Button>
              </>
            )}

            {!isSaved && (
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !connection.label}
              >
                {saving ? t('acoes.salvando') : t('acoes.salvar')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
