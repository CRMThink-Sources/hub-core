export type ImportErrorRow = {
  row: number
  message: string
  // Subs já criados: o reprocess reusa em vez de recriar (não duplica sub sem identificador).
  contactId?: string
  companyId?: string
}

export type ImportRunError =
  | { kind: 'partial'; cursorRow: number; rows: ImportErrorRow[] }
  | {
      kind: 'fatal'
      cursorRow: number
      message: string
      // Erros por-linha preservados através do fatal (seguem reprocessáveis).
      rows?: ImportErrorRow[]
    }

export function serializeImportError(error: ImportRunError): string {
  return JSON.stringify(error)
}

// last_error guarda JSON estruturado; string crua = dado antigo → vira fatal.
export function parseImportError(raw: string | null): ImportRunError | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'kind' in parsed &&
      ((parsed as ImportRunError).kind === 'partial' ||
        (parsed as ImportRunError).kind === 'fatal')
    ) {
      return parsed as ImportRunError
    }
  } catch {
    // não-JSON
  }
  return { kind: 'fatal', cursorRow: 0, message: raw }
}
