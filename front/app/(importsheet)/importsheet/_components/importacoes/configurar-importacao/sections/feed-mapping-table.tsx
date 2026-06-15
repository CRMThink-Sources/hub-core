import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('importsheet/configurar-importacao')
  const semTitulo = t('feedTabela.semTitulo')
  const columns = header?.columns ?? []
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1.4fr_1.25rem_1fr] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>{t('feedTabela.campoFeed')}</span>
        <span aria-hidden />
        <span>{t('feedTabela.colunaPlanilha')}</span>
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
              <span className="text-sm text-foreground">
                {t(`feedFields.${f.code}`)}
              </span>
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
                        `${col.letter} · ${col.label || semTitulo}`
                      ) : (
                        <span className="text-muted-foreground">
                          {t('feedTabela.selecione')}
                        </span>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>
                    {t('feedTabela.selecione')}
                  </SelectItem>
                  {columns.map(c => (
                    <SelectItem key={c.index} value={String(c.index)}>
                      {c.letter} · {c.label || semTitulo}
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
