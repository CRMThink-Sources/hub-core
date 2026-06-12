'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova importação</DialogTitle>
          <DialogDescription>
            Informe o ID (ou link) da planilha do Google
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="spreadsheet-id">ID da planilha</Label>
            <div className="flex gap-2">
              <Input
                id="spreadsheet-id"
                value={rawInput}
                onChange={e => {
                  setRawInput(e.target.value)
                  // Invalida o resultado anterior — evita manter o "OK" de outra planilha.
                  setSheet(null)
                  setSelectedTabId(null)
                  setError(null)
                  setAuthError(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleValidate()
                }}
                placeholder="ex.: 1AbC…XyZ ou a URL da planilha"
              />
              <Button
                variant="outline"
                onClick={() => void handleValidate()}
                disabled={validating || rawInput.trim().length === 0}
              >
                {validating && <Loader2Icon className="animate-spin" />}
                {validating ? 'Validando…' : 'Validar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O ID fica na URL: docs.google.com/spreadsheets/d/
              <span className="rounded bg-primary/10 px-1 font-mono font-bold text-primary">
                ID
              </span>
              /edit
            </p>
          </div>

          {error && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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

          {sheet && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-foreground" />
                <span className="truncate text-sm font-medium text-foreground">
                  {sheet.name}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
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
                          className={cn(
                            'w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-accent'
                              : 'border-border hover:border-muted-foreground/40 hover:bg-accent',
                          )}
                        >
                          <span className="block truncate text-sm text-foreground">
                            {tab.title}
                          </span>
                          {tab.rowCount !== null &&
                            tab.columnCount !== null && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
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
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleContinue} disabled={!canContinue}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
