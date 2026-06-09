import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ColumnMapping, SpreadsheetHeader } from '../../../types'
import { FEED_FIELDS, UNSET } from '../constants'

type Props = {
  header: SpreadsheetHeader | null
  mappings: ColumnMapping[]
  setFeedColumn: (code: string, columnIndex: number | null) => void
}

export function FeedMappingTable({ header, mappings, setFeedColumn }: Props) {
  const columns = header?.columns ?? []
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1.4fr_1.25rem_1fr] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Campo do Livefeed</span>
        <span aria-hidden />
        <span>Coluna da planilha</span>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {FEED_FIELDS.map(f => {
          const current =
            mappings.find(m => m.fieldName === f.code)?.columnIndex ?? null
          return (
            <li
              key={f.code}
              className="grid grid-cols-[1.4fr_1.25rem_1fr] items-center gap-3 px-3 py-2.5"
            >
              <span className="text-sm text-foreground">{f.label}</span>
              <span className="text-center text-muted-foreground">→</span>
              <Select
                value={current === null ? UNSET : String(current)}
                onValueChange={(v: string | null) =>
                  setFeedColumn(f.code, !v || v === UNSET ? null : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) => {
                      const col = columns.find(c => String(c.index) === value)
                      return col ? (
                        `${col.letter} · ${col.label || '(sem título)'}`
                      ) : (
                        <span className="text-muted-foreground">
                          Selecione…
                        </span>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Selecione…</SelectItem>
                  {columns.map(c => (
                    <SelectItem key={c.index} value={String(c.index)}>
                      {c.letter} · {c.label || '(sem título)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
