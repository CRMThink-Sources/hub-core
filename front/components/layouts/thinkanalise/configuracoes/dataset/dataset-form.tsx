'use client'

import { useEffect, useState } from 'react'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'

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
    <div className="rounded-lg border border-dashed border-[#223f6e]/40 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {step === 'table' && (
          <>
            <p className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
              {t('form.selecioneTabela')}
            </p>
            {loadingTables ? (
              <p className="text-xs text-gray-400 font-mono">
                {t('form.carregando')}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {tables.map(t_ => (
                  <button
                    key={t_.code}
                    onClick={() => void selectTable(t_)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB]
                               hover:bg-[#eef2f9] hover:border-[#223f6e] transition-all text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb] uppercase">
                      {t_.code}
                    </span>
                    <span className="text-sm text-gray-700">{t_.title}</span>
                    {loadingFields && selectedTable?.code === t_.code && (
                      <span className="ml-auto text-xs text-gray-400 font-mono">
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
              <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                {t('form.nomeDataset')}
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={e => setDatasetName(e.target.value)}
                placeholder={selectedTable.title}
                className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white placeholder:text-gray-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                {t('form.camposLabel')}
              </label>
              {describeFields.map(f => (
                <div
                  key={f.code}
                  className="flex items-center gap-3 py-1.5 border-b border-[#f3f4f6] last:border-0"
                >
                  <span className="text-xs font-mono text-[#223f6e] w-32 truncate">
                    {toFieldName(f.name)}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 flex-1">
                    {f.code}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 w-16">
                    {f.type}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-[#e5e7eb]">
        <button
          onClick={step === 'fields' ? () => setStep('table') : onCancel}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 cursor-pointer"
        >
          {step === 'fields' ? t('acoes.voltar') : t('acoes.cancelar')}
        </button>

        {step === 'fields' && (
          <button
            onClick={() => void handleSave()}
            disabled={saving || !datasetName}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] disabled:opacity-50 cursor-pointer"
          >
            {saving ? t('acoes.salvando') : t('acoes.criarDataset')}
          </button>
        )}
      </div>
    </div>
  )
}
