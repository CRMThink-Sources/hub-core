import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('importsheet/configurar-importacao')
  const semTitulo = t('responsavel.semTitulo')
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <Label>
          {isFeed
            ? t('responsavel.autorColuna')
            : t('responsavel.responsavelColuna')}
        </Label>
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
                  `${col.letter} · ${col.label || semTitulo}`
                ) : (
                  <span className="text-muted-foreground">
                    {isFeed
                      ? t('responsavel.semAutor')
                      : t('responsavel.semResponsavel')}
                  </span>
                )
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {isFeed
                ? t('responsavel.semAutor')
                : t('responsavel.semResponsavel')}
            </SelectItem>
            {visibleColumns.map(c => (
              <SelectItem key={c.index} value={String(c.index)}>
                {c.letter} · {c.label || semTitulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          {isFeed
            ? t('responsavel.casarAutor')
            : t('responsavel.casarResponsavel')}
        </Label>
        <Select
          value={responsibleMatchBy}
          onValueChange={(v: string | null) =>
            setResponsibleMatchBy((v ?? 'id') as ResponsibleMatchBy)
          }
        >
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                MATCH_OPTIONS.find(o => o.value === value)
                  ? t(`match.${value}`)
                  : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MATCH_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {t(`match.${o.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
