'use client'

import { useState } from 'react'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'

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
    setLoading(true, 'Salvando...')
    try {
      const client = axiosThinkanalise()
      await client.post(`/thinkanalise/connector/${connectorId}/source`, {
        title,
        settings: { integration: provider, api_key: apiKey },
        active: true,
      })
      await onSaved()
      toast.success('Fonte criada com sucesso.')
    } catch {
      toast.error('Erro ao criar a fonte.')
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-[#223f6e]/40 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
            Nome da Fonte
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Clientes inadimplentes"
            className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                       focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                       hover:border-[#223f6e] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Cole sua chave aqui"
            className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                       focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                       hover:border-[#223f6e] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleTest()}
            disabled={testing || !apiKey}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                       hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
          >
            {testing ? 'testando...' : 'testar conexão'}
          </button>
          {testStatus === 'ok' && (
            <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="6" fill="#10b981" fillOpacity="0.15" />
                <path
                  d="M3.5 6l1.8 1.8L8.5 4.5"
                  stroke="#059669"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              conexão autenticada
            </span>
          )}
          {testStatus === 'erro' && (
            <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 font-semibold">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="6" fill="#ef4444" fillOpacity="0.15" />
                <path
                  d="M4 4l4 4M8 4l-4 4"
                  stroke="#dc2626"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              api key inválida
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[#e5e7eb]">
        <button
          onClick={onCancel}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 transition-all cursor-pointer"
        >
          cancelar
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !title || !apiKey}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'salvando...' : 'salvar fonte'}
        </button>
      </div>
    </div>
  )
}
