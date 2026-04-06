'use client'

import { useState } from 'react'
import { PROVIDERS, DEFAULT_SYNC_FREQ, nextSyncTime } from './constants'
import type { Config } from '../../types/thinkanalise-types'

type Props = {
  config: Config
  onChange: (updated: Config) => void
}

export function ConfigCard({ config, onChange }: Props) {
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const [expanded, setExpanded] = useState(config.status !== 'conectado')
  const [editingLabel, setEditingLabel] = useState(false)

  function update(patch: Partial<Config>) {
    onChange({ ...config, ...patch })
  }

  async function handleTest() {
    setTesting(true)
    setTestStatus('idle')
    console.log('[testar conexão] payload →', {
      provider: config.provider,
      apiKey: config.apiKey,
    })
    await new Promise(r => setTimeout(r, 800))
    setTestStatus(config.apiKey.length > 8 ? 'ok' : 'erro')
    setTesting(false)
  }

  function handleSave() {
    console.log('[salvar config] payload →', {
      id: config.id,
      provider: config.provider,
      label: config.label,
      apiKey: config.apiKey,
      syncFreq: config.syncFreq,
      status: config.status,
    })
  }

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      {/* cabeçalho */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] bg-[#F9F9FB] cursor-pointer select-none"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded bg-[#ede0f7] text-[#6c02ad] border border-[#e5e7eb] tracking-wide uppercase">
          {config.provider}
        </span>

        {/* label editável inline */}
        {editingLabel ? (
          <input
            autoFocus
            value={config.label}
            onChange={e => update({ label: e.target.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
            onClick={e => e.stopPropagation()}
            placeholder="Nome da integração"
            className="text-sm font-semibold bg-transparent border-b border-[#6c02ad] outline-none w-48 text-black placeholder:text-gray-300"
          />
        ) : (
          <span
            className="text-sm font-semibold hover:text-[#6c02ad] transition-colors"
            onClick={e => {
              e.stopPropagation()
              setEditingLabel(true)
            }}
            title="Clique para editar"
          >
            {config.label || (
              <span className="text-gray-300 font-normal">sem nome</span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${config.status === 'conectado' ? 'bg-[#6c02ad]' : 'bg-red-400'}`}
          />
          <span className="text-xs text-gray-400 font-mono">
            {config.status}
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
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                Integração
              </label>
              <select
                value={config.provider}
                onChange={e =>
                  update({ provider: e.target.value as Config['provider'] })
                }
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#6c02ad] focus:ring-2 focus:ring-[#6c02ad]/20 focus:bg-white
                           hover:border-[#6c02ad] transition-colors"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                placeholder="Cole sua chave aqui"
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#6c02ad] focus:ring-2 focus:ring-[#6c02ad]/20 focus:bg-white
                           hover:border-[#6c02ad] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                Frequência de sync
              </label>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-medium w-9">
                  {config.syncFreq}
                </span>
                <span className="text-xs text-gray-400 font-mono">min</span>
                <input
                  type="range"
                  min={15}
                  max={240}
                  step={15}
                  value={config.syncFreq}
                  onChange={e => update({ syncFreq: Number(e.target.value) })}
                  className="flex-1 accent-[#6c02ad]"
                />
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#ede0f7] text-[#400166] border border-[#e5e7eb]">
                  {config.syncFreq === DEFAULT_SYNC_FREQ
                    ? 'padrão'
                    : 'personalizado'}
                </span>
              </div>
            </div>
          </div>

          {/* barra de sync */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-t border-[#e5e7eb] bg-[#F9F9FB] text-xs font-mono text-gray-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6.5" stroke="#6c02ad" />
              <path
                d="M4 7l2 2 4-4"
                stroke="#6c02ad"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            última sync: <strong className="text-black">—</strong>
            &nbsp;·&nbsp; próxima:{' '}
            <strong className="text-black">
              {nextSyncTime(config.syncFreq)}
            </strong>
          </div>

          {/* rodapé */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb] flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleTest()}
                disabled={testing}
                className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                           hover:bg-[#f3e8ff] hover:text-[#6c02ad] hover:border-[#6c02ad] transition-all disabled:opacity-50 cursor-pointer"
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
                <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-[#ede0f7] text-[#400166] border border-[#e5e7eb]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#6c02ad" />
                    <path
                      d="M4 7l2 2 4-4"
                      stroke="#6c02ad"
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
              className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#6c02ad] text-white hover:bg-[#400166] transition-colors cursor-pointer"
            >
              salvar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
