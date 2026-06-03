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
import type { ColumnMapping, SpreadsheetColumn } from '../../../types'
import { UNSET } from '../constants'

type Props = {
  visibleColumns: SpreadsheetColumn[]
  mappings: ColumnMapping[]
  fieldOptions: ComboboxOption[]
  setMapping: (columnIndex: number, fieldName: string | null) => void
  toggleIdentifier: (columnIndex: number, isIdentifier: boolean) => void
  excludeColumn: (columnIndex: number) => void
}

export function ColumnMappingTable({
  visibleColumns,
  mappings,
  fieldOptions,
  setMapping,
  toggleIdentifier,
  excludeColumn,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_1.25rem_1.4fr_6rem_2rem] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Coluna</span>
        <span aria-hidden />
        <span>Campo no Bitrix</span>
        <span className="text-center">Identificador</span>
        <span aria-hidden />
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {visibleColumns.map(col => {
          const mapping = mappings.find(m => m.columnIndex === col.index)
          const selected =
            fieldOptions.find(o => o.value === (mapping?.fieldName ?? UNSET)) ??
            null
          return (
            <li
              key={col.index}
              className="grid grid-cols-[1fr_1.25rem_1.4fr_6rem_2rem] items-center gap-3 px-3 py-2.5"
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
