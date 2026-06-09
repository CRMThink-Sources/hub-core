import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  type ComboboxOption,
} from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ColumnMapping,
  MappingTarget,
  SpreadsheetColumn,
} from '../../../types'
import { UNSET } from '../constants'

type Props = {
  visibleColumns: SpreadsheetColumn[]
  mappings: ColumnMapping[]
  fieldOptionsByTarget: Record<MappingTarget, ComboboxOption[]>
  destinations: { value: MappingTarget; label: string }[]
  setMapping: (columnIndex: number, fieldName: string | null) => void
  setMappingTarget: (columnIndex: number, target: MappingTarget) => void
  toggleIdentifier: (columnIndex: number, isIdentifier: boolean) => void
  excludeColumn: (columnIndex: number) => void
}

export function ColumnMappingTable({
  visibleColumns,
  mappings,
  fieldOptionsByTarget,
  destinations,
  setMapping,
  setMappingTarget,
  toggleIdentifier,
  excludeColumn,
}: Props) {
  const showTarget = destinations.length > 1
  const grid = showTarget
    ? 'grid-cols-[1fr_1.25rem_7rem_1.4fr_6rem_2rem]'
    : 'grid-cols-[1fr_1.25rem_1.4fr_6rem_2rem]'

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className={`grid ${grid} items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground`}
      >
        <span>Coluna</span>
        <span aria-hidden />
        {showTarget && <span>Destino</span>}
        <span>Campo no Bitrix</span>
        <span className="text-center">Identificador</span>
        <span aria-hidden />
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {visibleColumns.map(col => {
          const mapping = mappings.find(m => m.columnIndex === col.index)
          const target = mapping?.target ?? 'main'
          const fieldOptions = fieldOptionsByTarget[target]
          const selected =
            fieldOptions.find(o => o.value === (mapping?.fieldName ?? UNSET)) ??
            null
          return (
            <li
              key={col.index}
              className={`grid ${grid} items-center gap-3 px-3 py-2.5`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-xs text-muted-foreground">
                  {col.letter}
                </span>
                <span className="truncate">
                  {col.label || (
                    <em className="text-muted-foreground">(sem título)</em>
                  )}
                </span>
              </span>
              <span className="text-center text-muted-foreground">→</span>

              {showTarget && (
                <Select
                  value={target}
                  onValueChange={(v: string | null) => {
                    if (v !== null)
                      setMappingTarget(col.index, v as MappingTarget)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) =>
                        destinations.find(d => d.value === value)?.label ??
                        value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Combobox
                items={fieldOptions}
                value={selected}
                onValueChange={(value: ComboboxOption | null) =>
                  setMapping(
                    col.index,
                    !value || value.value === UNSET ? null : value.value,
                  )
                }
              >
                <ComboboxTrigger placeholder="Selecione…" />
                <ComboboxContent searchPlaceholder="Buscar campo…">
                  {(item: ComboboxOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
              <span className="flex justify-center">
                <Checkbox
                  checked={mapping?.isIdentifier ?? false}
                  disabled={mapping?.fieldName == null}
                  onCheckedChange={checked =>
                    toggleIdentifier(col.index, checked)
                  }
                  aria-label="Usar como identificador"
                  title="Usar como identificador (chave de deduplicação)"
                  className="size-5 rounded-md border-2 [&_svg]:size-3.5"
                />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => excludeColumn(col.index)}
                aria-label="Remover coluna"
                className="text-muted-foreground hover:text-destructive"
              >
                <XIcon />
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
