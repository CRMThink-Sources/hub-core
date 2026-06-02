'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type {
  ImportSelection,
  SpreadsheetDetails,
  SpreadsheetTab,
} from '../types'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (selection: ImportSelection) => void
}

/** Aceita o ID puro ou uma URL do Google Sheets — extrai o ID em ambos os casos. */
function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : trimmed
}

export function NovaImportacaoModal({ open, onClose, onSelect }: Props) {
  const [rawInput, setRawInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [sheet, setSheet] = useState<SpreadsheetDetails | null>(null)
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null)

  // Reseta o estado a cada abertura.
  useEffect(() => {
    if (!open) return
    setRawInput('')
    setValidating(false)
    setError(null)
    setAuthError(false)
    setSheet(null)
    setSelectedTabId(null)
  }, [open])

  // Fecha no ESC.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleValidate(): Promise<void> {
    const id = extractSpreadsheetId(rawInput)
    if (!id) return

    setValidating(true)
    setError(null)
    setAuthError(false)
    setSheet(null)
    setSelectedTabId(null)
    try {
      const result = (await axiosImportsheet().get(
        `/importsheet/sheets/${encodeURIComponent(id)}`,
      )) as unknown as { spreadsheet: SpreadsheetDetails }
      const details = result.spreadsheet
      setSheet(details)
      // Auto-seleciona quando há uma única aba.
      if (details.tabs.length === 1) setSelectedTabId(details.tabs[0].sheetId)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Falha ao validar a planilha.'
      // Mensagem de reconexão vem do backend (401) — oferece atalho pras Configurações.
      setAuthError(/reconecte/i.test(message))
      setError(message)
    } finally {
      setValidating(false)
    }
  }

  function handleContinue() {
    if (!sheet) return
    const tab = sheet.tabs.find(t => t.sheetId === selectedTabId)
    if (!tab) return
    onSelect({ spreadsheet: sheet, tab })
  }

  const canContinue = sheet !== null && selectedTabId !== null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nova importação"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    >
      <div className="w-full max-w-lg bg-white rounded-xl border border-[#e5e7eb] shadow-xl flex flex-col max-h-[80vh]">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Nova importação
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Informe o ID (ou link) da planilha do Google
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* input + validar */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="spreadsheet-id"
              className="text-sm font-medium text-gray-700"
            >
              ID da planilha
            </label>
            <div className="flex gap-2">
              <input
                id="spreadsheet-id"
                type="text"
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleValidate()
                }}
                placeholder="ex.: 1AbC…XyZ ou a URL da planilha"
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#e5e7eb]
                         focus:outline-none focus:border-gray-900 transition-all"
              />
              <button
                type="button"
                onClick={() => void handleValidate()}
                disabled={validating || rawInput.trim().length === 0}
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white text-gray-900
                         hover:bg-gray-50 hover:border-gray-900 transition-all cursor-pointer whitespace-nowrap
                         disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {validating ? 'Validando…' : 'Validar'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              O ID fica na URL: docs.google.com/spreadsheets/d/
              <span className="font-mono">ID</span>/edit
            </p>
          </div>

          {/* erro */}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col gap-2">
              <span>{error}</span>
              {authError && (
                <Link
                  href="/importsheet/configuracoes"
                  className="self-start text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  Ir para Configurações
                </Link>
              )}
            </div>
          )}

          {/* resultado da validação */}
          {sheet && (
            <div className="flex flex-col gap-3 border border-[#e5e7eb] rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                  Planilha válida
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {sheet.name}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">
                  {sheet.tabs.length > 1 ? 'Selecione a aba' : 'Aba'}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {sheet.tabs.map((tab: SpreadsheetTab) => {
                    const isSelected = tab.sheetId === selectedTabId
                    return (
                      <li key={tab.sheetId}>
                        <button
                          type="button"
                          onClick={() => setSelectedTabId(tab.sheetId)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-[#e5e7eb] hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <span className="block text-sm text-gray-900 truncate">
                            {tab.title}
                          </span>
                          {tab.rowCount !== null &&
                            tab.columnCount !== null && (
                              <span className="block text-xs text-gray-400 mt-0.5">
                                {tab.rowCount} linhas · {tab.columnCount}{' '}
                                colunas
                              </span>
                            )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white
                     hover:bg-gray-50 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white text-gray-900
                     hover:bg-gray-50 hover:border-gray-900 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
