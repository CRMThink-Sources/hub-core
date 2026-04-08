'use client'

import { useState } from 'react'
import { PROVIDERS } from './constants'
import type { Connection } from '../../types/thinkanalise-types'

type Props = {
  connection: Connection
  onChange: (updated: Connection) => void
}

export function ConfigCard({ connection, onChange }: Props) {
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const [expanded, setExpanded] = useState(connection.status !== 'conectado')
  const [editingLabel, setEditingLabel] = useState(false)

  function update(patch: Partial<Connection>) {
    onChange({ ...connection, ...patch })
  }

  async function handleTest() {
    setTesting(true)
    setTestStatus('idle')
    // TODO: POST /check { provider, apiKey }
    await new Promise(r => setTimeout(r, 800))
    setTestStatus(connection.apiKey.length > 8 ? 'ok' : 'erro')
    setTesting(false)
  }

  function handleSave() {
    // TODO: biconnector.connector.add ou .update
    console.log('[salvar]', connection)
  }

  const statusColor = {
    conectado: 'bg-[#4a7fd4]',
    pendente: 'bg-yellow-400',
    erro: 'bg-red-400',
  }[connection.status]

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      {/* cabeçalho */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] bg-[#F9F9FB] cursor-pointer select-none"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb] tracking-wide uppercase">
          {connection.provider}
        </span>

        {editingLabel ? (
          <input
            autoFocus
            value={connection.label}
            onChange={e => update({ label: e.target.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
            onClick={e => e.stopPropagation()}
            placeholder="Nome da conexão"
            className="text-sm font-semibold bg-transparent border-b border-[#223f6e] outline-none w-48 text-black placeholder:text-gray-300"
          />
        ) : (
          <span
            className="text-sm font-semibold hover:text-[#223f6e] transition-colors"
            onClick={e => {
              e.stopPropagation()
              setEditingLabel(true)
            }}
            title="Clique para editar"
          >
            {connection.label || (
              <span className="text-gray-300 font-normal">sem nome</span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400 font-mono">
            {connection.status}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`ml-1 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {expanded && (
        <>
          <div className="px-5 py-5 flex flex-col gap-5">
            {/* integração */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                Integração
              </label>
              <select
                value={connection.provider}
                onChange={e =>
                  update({ provider: e.target.value as Connection['provider'] })
                }
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                           hover:border-[#223f6e] transition-colors"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* api key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                API Key
              </label>
              <input
                type="password"
                value={connection.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                placeholder="Cole sua chave aqui"
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                           hover:border-[#223f6e] transition-colors"
              />
            </div>
          </div>

          {/* rodapé */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb] flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleTest()}
                disabled={testing}
                className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                           hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
                  <path
                    d="M4 6h4M6 4v4"
                    stroke="currentColor"
                    strokeLinecap="round"
                  />
                </svg>
                {testing ? 'testando...' : 'testar conexão'}
              </button>

              {testStatus === 'ok' && (
                <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#4a7fd4" />
                    <path
                      d="M4 7l2 2 4-4"
                      stroke="#4a7fd4"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  conexão ok
                </span>
              )}
              {testStatus === 'erro' && (
                <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#b91c1c" />
                    <path
                      d="M5 5l4 4M9 5l-4 4"
                      stroke="#b91c1c"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  api key inválida
                </span>
              )}
            </div>

            <button
              onClick={handleSave}
              className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors cursor-pointer"
            >
              salvar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
