import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SpreadsheetDetails } from '../../../types'

type Props = {
  spreadsheet: SpreadsheetDetails
  title: string
  setTitle: (value: string) => void
  startRow: number
  setStartRow: (value: number) => void
  selectedTabId: number
  setSelectedTabId: (value: number) => void
}

export function IdentidadeSection({
  spreadsheet,
  title,
  setTitle,
  startRow,
  setStartRow,
  selectedTabId,
  setSelectedTabId,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-title">Título da importação</Label>
        <Input
          id="import-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="ex.: Leads de junho"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-spreadsheet-id">ID da planilha</Label>
        <Input
          id="import-spreadsheet-id"
          value={spreadsheet.id}
          disabled
          className="bg-muted text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Aba para importar</Label>
        <Select
          value={String(selectedTabId)}
          onValueChange={(v: string | null) => {
            if (v !== null) setSelectedTabId(Number(v))
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                spreadsheet.tabs.find(t => String(t.sheetId) === value)
                  ?.title ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {spreadsheet.tabs.map(t => (
              <SelectItem key={t.sheetId} value={String(t.sheetId)}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="import-start-row">Importar a partir da linha</Label>
        <Input
          id="import-start-row"
          type="number"
          min={2}
          value={startRow}
          onChange={e => setStartRow(Math.max(2, Number(e.target.value) || 2))}
        />
        <p className="text-xs text-muted-foreground">
          Linha 1 = cabeçalho. Importa a partir desta linha; reduza para
          reprocessar.
        </p>
      </div>
    </div>
  )
}
