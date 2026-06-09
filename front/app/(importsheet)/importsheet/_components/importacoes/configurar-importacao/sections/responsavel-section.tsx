import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ResponsibleMatchBy, SpreadsheetColumn } from '../../../types'
import { MATCH_OPTIONS, NONE } from '../constants'

type Props = {
  isFeed: boolean
  visibleColumns: SpreadsheetColumn[]
  responsibleColumnIndex: number | null
  setResponsibleColumnIndex: (value: number | null) => void
  responsibleMatchBy: ResponsibleMatchBy
  setResponsibleMatchBy: (value: ResponsibleMatchBy) => void
}

export function ResponsavelSection({
  isFeed,
  visibleColumns,
  responsibleColumnIndex,
  setResponsibleColumnIndex,
  responsibleMatchBy,
  setResponsibleMatchBy,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <Label>{isFeed ? 'Autor' : 'Responsável'} (coluna)</Label>
        <Select
          value={
            responsibleColumnIndex === null
              ? NONE
              : String(responsibleColumnIndex)
          }
          onValueChange={(v: string | null) =>
            setResponsibleColumnIndex(!v || v === NONE ? null : Number(v))
          }
        >
          <SelectTrigger>
            <SelectValue>
              {(value: string) => {
                const col = visibleColumns.find(c => String(c.index) === value)
                return col ? (
                  `${col.letter} · ${col.label || '(sem título)'}`
                ) : (
                  <span className="text-muted-foreground">
                    {isFeed ? 'Sem autor' : 'Sem responsável'}
                  </span>
                )
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {isFeed ? 'Sem autor' : 'Sem responsável'}
            </SelectItem>
            {visibleColumns.map(c => (
              <SelectItem key={c.index} value={String(c.index)}>
                {c.letter} · {c.label || '(sem título)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Casar {isFeed ? 'autor' : 'responsável'} por</Label>
        <Select
          value={responsibleMatchBy}
          onValueChange={(v: string | null) =>
            setResponsibleMatchBy((v ?? 'id') as ResponsibleMatchBy)
          }
        >
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                MATCH_OPTIONS.find(o => o.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MATCH_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
