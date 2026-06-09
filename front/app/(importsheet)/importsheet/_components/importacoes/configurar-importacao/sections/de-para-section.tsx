import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import type { ComboboxOption } from '@/components/ui/combobox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type {
  ColumnMapping,
  MappingTarget,
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
  fieldOptionsByTarget: Record<MappingTarget, ComboboxOption[]>
  destinations: { value: MappingTarget; label: string }[]
  excluded: number[]
  setMapping: (columnIndex: number, fieldName: string | null) => void
  setMappingTarget: (columnIndex: number, target: MappingTarget) => void
  toggleIdentifier: (columnIndex: number, isIdentifier: boolean) => void
  excludeColumn: (columnIndex: number) => void
  restoreColumn: (columnIndex: number) => void
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
  fieldOptionsByTarget,
  destinations,
  excluded,
  setMapping,
  setMappingTarget,
  toggleIdentifier,
  excludeColumn,
  restoreColumn,
  setFeedColumn,
}: Props) {
  const [excludedOpen, setExcludedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {isFeed ? 'Mapeamento do Livefeed' : 'De-para de colunas'}
        </p>
        <div className="flex items-center gap-3">
          {!isFeed && excluded.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExcludedOpen(true)}
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Campos excluídos ({excluded.length})
              </button>
              <Dialog
                open={excludedOpen}
                onOpenChange={open => !open && setExcludedOpen(false)}
              >
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Campos excluídos</DialogTitle>
                    <DialogDescription>
                      Restaure colunas para incluí-las no de-para.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody className="flex flex-col gap-2">
                    {excluded.map(idx => {
                      const col = header?.columns.find(c => c.index === idx)
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5"
                        >
                          <span className="truncate text-sm text-foreground">
                            {col?.label ?? `Coluna ${idx + 1}`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreColumn(idx)}
                          >
                            Restaurar
                          </Button>
                        </div>
                      )
                    })}
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </>
          )}
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
          fieldOptionsByTarget={fieldOptionsByTarget}
          destinations={destinations}
          setMapping={setMapping}
          setMappingTarget={setMappingTarget}
          toggleIdentifier={toggleIdentifier}
          excludeColumn={excludeColumn}
        />
      )}
    </div>
  )
}
