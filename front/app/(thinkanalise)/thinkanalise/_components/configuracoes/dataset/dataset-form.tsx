'use client'

import { useEffect, useState } from 'react'
import { axiosThinkanalise } from '../../../_lib/thinkanalise-client'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function toFieldName(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

type TableEntry = { code: string; title: string }
type DescribeField = { code: string; name: string; type: string }

type DatasetFormProps = {
  sourceId: number
  integration: string
  onSaved: () => Promise<void>
  onCancel: () => void
}

export function DatasetForm({
  sourceId,
  integration,
  onSaved,
  onCancel,
}: DatasetFormProps) {
  const [step, setStep] = useState<'table' | 'fields'>('table')
  const [tables, setTables] = useState<TableEntry[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableEntry | null>(null)
  const [describeFields, setDescribeFields] = useState<DescribeField[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [datasetName, setDatasetName] = useState('')
  const [saving, setSaving] = useState(false)
  const { setLoading } = useLoading()
  const { t } = useTranslation('thinkanalise/configuracoes/dataset')

  async function loadTables() {
    setLoadingTables(true)
    setLoading(true, t('loading.carregando'))
    try {
      const client = axiosThinkanalise()
      const tables = await client.post<TableEntry[]>('/thinkanalise/tables', {
        connection: { integration, api_key: '' },
      })
      setTables(tables as unknown as TableEntry[])
    } finally {
      setLoadingTables(false)
      setLoading(false)
    }
  }

  async function selectTable(table: TableEntry) {
    setSelectedTable(table)
    setDatasetName('')
    setLoadingFields(true)
    try {
      const client = axiosThinkanalise()
      const fields = (await client.post<DescribeField[]>(
        '/thinkanalise/describe',
        {
          name: table.code,
          connection: { integration, api_key: '' },
        },
      )) as unknown as DescribeField[]
      setDescribeFields(fields)
      setStep('fields')
    } finally {
      setLoadingFields(false)
    }
  }

  async function handleSave() {
    if (!selectedTable || !datasetName) return
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise()
      await client.post(`/thinkanalise/source/${sourceId}/dataset`, {
        name: datasetName,
        externalCode: selectedTable.code,
        externalName: selectedTable.title,
        fields: describeFields.map(f => ({
          name: f.name,
          type: f.type,
          externalCode: f.code,
          visible: true,
        })),
      })
      await onSaved()
      toast.success(t('toast.criado'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('already exists')) {
        toast.error(t('toast.jaExiste'))
      } else {
        toast.error(t('toast.erroSalvar'))
      }
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTables()
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-primary/40 bg-card">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {step === 'table' && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t('form.selecioneTabela')}
            </p>
            {loadingTables ? (
              <p className="text-xs text-muted-foreground">
                {t('form.carregando')}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {tables.map(t_ => (
                  <button
                    key={t_.code}
                    onClick={() => void selectTable(t_)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-all hover:border-primary hover:bg-accent"
                  >
                    <span className="rounded border border-border bg-accent px-2 py-0.5 text-[10px] uppercase text-accent-foreground">
                      {t_.code}
                    </span>
                    <span className="text-sm text-foreground">{t_.title}</span>
                    {loadingFields && selectedTable?.code === t_.code && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t('form.carregando')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'fields' && selectedTable && (
          <>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('form.nomeDataset')}
              </Label>
              <Input
                value={datasetName}
                onChange={e => setDatasetName(e.target.value)}
                placeholder={selectedTable.title}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('form.camposLabel')}
              </Label>
              {describeFields.map(f => (
                <div
                  key={f.code}
                  className="flex items-center gap-3 border-b border-border/60 py-1.5 last:border-0"
                >
                  <span className="w-32 truncate text-xs text-primary">
                    {toFieldName(f.name)}
                  </span>
                  <span className="flex-1 text-[10px] text-muted-foreground">
                    {f.code}
                  </span>
                  <span className="w-16 text-[10px] text-muted-foreground">
                    {f.type}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={step === 'fields' ? () => setStep('table') : onCancel}
        >
          {step === 'fields' ? t('acoes.voltar') : t('acoes.cancelar')}
        </Button>

        {step === 'fields' && (
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !datasetName}
          >
            {saving ? t('acoes.salvando') : t('acoes.criarDataset')}
          </Button>
        )}
      </div>
    </div>
  )
}
