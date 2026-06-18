import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('importsheet/configurar-importacao')
  const [excludedOpen, setExcludedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {isFeed ? t('depara.tituloFeed') : t('depara.titulo')}
          </p>
          {!isFeed && (
            <p className="text-xs text-muted-foreground">
              {t('depara.descricao')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isFeed && excluded.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExcludedOpen(true)}
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('depara.camposExcluidos', { count: excluded.length })}
              </button>
              <Dialog
                open={excludedOpen}
                onOpenChange={open => !open && setExcludedOpen(false)}
              >
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      {t('depara.camposExcluidosTitulo')}
                    </DialogTitle>
                    <DialogDescription>
                      {t('depara.camposExcluidosDescricao')}
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
                            {col?.label ??
                              t('depara.coluna', { numero: idx + 1 })}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreColumn(idx)}
                          >
                            {t('depara.restaurar')}
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
                {t('depara.contadorFeed', {
                  mapeados: feedMappedCount,
                  total: FEED_FIELDS.length,
                })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('depara.contadorColunas', {
                  mapeados: mappedCount,
                  total: visibleColumns.length,
                })}
              </span>
            ))}
        </div>
      </div>

      {!entitySelected ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('depara.selecioneEntidade')}
        </p>
      ) : headerLoading || (perColumn && fieldsLoading) ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {t('depara.carregandoColunas')}
        </div>
      ) : header && header.columns.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('depara.primeiraLinhaVazia')}
        </p>
      ) : isFeed ? (
        <FeedMappingTable
          header={header}
          mappings={mappings}
          setFeedColumn={setFeedColumn}
        />
      ) : visibleColumns.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('depara.todasRemovidas')}
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
