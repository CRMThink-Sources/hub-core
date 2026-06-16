import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BitrixCategory, BitrixEntity, EntityCode } from '../../../types'
import { ENTITIES } from '../constants'

type Props = {
  entityCode: EntityCode | ''
  setEntityCode: (value: EntityCode | '') => void
  setSpaTypeId: (value: number | null) => void
  needsPipeline: boolean
  categoryId: number | null
  setCategoryId: (value: number | null) => void
  categories: BitrixCategory[]
  categoriesLoading: boolean
  needsSpa: boolean
  spaTypeId: number | null
  spas: BitrixEntity[]
}

export function DestinoSection({
  entityCode,
  setEntityCode,
  setSpaTypeId,
  needsPipeline,
  categoryId,
  setCategoryId,
  categories,
  categoriesLoading,
  needsSpa,
  spaTypeId,
  spas,
}: Props) {
  const { t } = useTranslation('importsheet/configurar-importacao')
  return (
    <div
      className={`grid gap-4 ${
        needsPipeline || needsSpa ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      <div className="flex flex-col gap-2">
        <Label>{t('destino.entidade')}</Label>
        <Select
          value={entityCode}
          onValueChange={(v: string | null) => {
            setEntityCode((v ?? '') as EntityCode | '')
            setSpaTypeId(null)
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                value && ENTITIES.find(en => en.code === value) ? (
                  t(`entidades.${value}`)
                ) : (
                  <span className="text-muted-foreground">
                    {t('destino.selecione')}
                  </span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ENTITIES.map(en => (
              <SelectItem key={en.code} value={en.code}>
                {t(`entidades.${en.code}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsPipeline && (
        <div className="flex flex-col gap-2">
          <Label>{t('destino.pipeline')}</Label>
          <Select
            value={categoryId === null ? '' : String(categoryId)}
            onValueChange={(v: string | null) =>
              setCategoryId(v ? Number(v) : null)
            }
          >
            <SelectTrigger>
              <SelectValue>
                {(value: string) =>
                  value ? (
                    (categories.find(c => String(c.id) === value)?.name ??
                    value)
                  ) : (
                    <span className="text-muted-foreground">
                      {categoriesLoading
                        ? t('destino.carregando')
                        : t('destino.selecione')}
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {needsSpa && (
        <div className="flex flex-col gap-2">
          <Label>{t('destino.spa')}</Label>
          <Select
            value={spaTypeId === null ? '' : String(spaTypeId)}
            onValueChange={(v: string | null) =>
              setSpaTypeId(v ? Number(v) : null)
            }
          >
            <SelectTrigger>
              <SelectValue>
                {(value: string) =>
                  value ? (
                    (spas.find(s => String(s.entityTypeId) === value)?.label ??
                    value)
                  ) : (
                    <span className="text-muted-foreground">
                      {t('destino.selecioneSpa')}
                    </span>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {spas.map(s => (
                <SelectItem key={s.entityTypeId} value={String(s.entityTypeId)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
