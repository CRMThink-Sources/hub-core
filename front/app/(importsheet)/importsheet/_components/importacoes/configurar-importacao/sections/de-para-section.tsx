import { Loader2Icon } from 'lucide-react'
import type { ComboboxOption } from '@/components/ui/combobox'
import type {
  ColumnMapping,
  SpreadsheetColumn,
  SpreadsheetHeader,
} from '../../../types'
import { FEED_FIELDS } from '../constants'
import { ColumnMappingTable } from './column-mapping-table'
import { FeedMappingTable } from './feed-mapping-table'

type Props = {
  entitySelected: boolean
  isFeed: boolean
  perColumn: boolean
  header: SpreadsheetHeader | null
  headerLoading: boolean
  fieldsLoading: boolean
  visibleColumns: SpreadsheetColumn[]
  mappedCount: number
  feedMappedCount: number
  mappings: ColumnMapping[]
  fieldOptions: ComboboxOption[]
  setMapping: (columnIndex: number, fieldName: string | null) => void
  toggleIdentifier: (columnIndex: number, isIdentifier: boolean) => void
  excludeColumn: (columnIndex: number) => void
  setFeedColumn: (code: string, columnIndex: number | null) => void
}

export function DeParaSection({
  entitySelected,
  isFeed,
  perColumn,
  header,
  headerLoading,
  fieldsLoading,
  visibleColumns,
  mappedCount,
  feedMappedCount,
  mappings,
  fieldOptions,
  setMapping,
  toggleIdentifier,
  excludeColumn,
  setFeedColumn,
}: Props) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {isFeed ? 'Mapeamento do Livefeed' : 'De-para de colunas'}
        </p>
        {header &&
          (isFeed ? (
            <span className="text-xs text-muted-foreground">
              {feedMappedCount} de {FEED_FIELDS.length} campos
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {mappedCount} de {visibleColumns.length} mapeadas
            </span>
          ))}
      </div>

      {!entitySelected ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Selecione uma entidade para mapear as colunas.
        </p>
      ) : headerLoading || (perColumn && fieldsLoading) ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Carregando colunas e campos…
        </div>
      ) : header && header.columns.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          A primeira linha da aba está vazia.
        </p>
      ) : isFeed ? (
        <FeedMappingTable
          header={header}
          mappings={mappings}
          setFeedColumn={setFeedColumn}
        />
      ) : visibleColumns.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Todas as colunas foram removidas.
        </p>
      ) : (
        <ColumnMappingTable
          visibleColumns={visibleColumns}
          mappings={mappings}
          fieldOptions={fieldOptions}
          setMapping={setMapping}
          toggleIdentifier={toggleIdentifier}
          excludeColumn={excludeColumn}
        />
      )}
    </div>
  )
}
