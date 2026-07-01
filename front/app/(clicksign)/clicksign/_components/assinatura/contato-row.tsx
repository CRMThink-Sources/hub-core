'use client'

import { Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { OptionSelect } from '../option-select'
import type { Contato, Option } from '../types'
import { GRUPOS_NUMERO } from './constants'

type Props = {
  contato: Contato
  onChange: (patch: Partial<Contato>) => void
  onRemove: () => void
  contactFields: Option[]
  stringFields: Option[]
}

export function ContatoRow({
  contato,
  onChange,
  onRemove,
  contactFields,
  stringFields,
}: Props) {
  const { t } = useTranslation('clicksign/assinatura')
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={contato.contato_padrao}
            onCheckedChange={(checked: boolean) =>
              onChange({ contato_padrao: checked })
            }
          />
          <div>
            <span className="text-sm font-medium text-foreground">
              {t('useDefaultContact')}
            </span>
            <p className="text-xs text-muted-foreground">
              {t('useDefaultContactHint')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs">{t('group')}</Label>
          <div className="w-24">
            <OptionSelect
              options={GRUPOS_NUMERO}
              value={
                contato.contato_group ? String(contato.contato_group) : null
              }
              onChange={v => onChange({ contato_group: v ? Number(v) : null })}
              placeholder="—"
            />
          </div>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('removeContact')}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {!contato.contato_padrao && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!contato.contato_nome && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>{t('contactFieldLabel')}</Label>
              <OptionSelect
                options={contactFields}
                value={contato.contato}
                onChange={v =>
                  onChange({
                    contato: v,
                    contato_nome: null,
                    contato_email: null,
                    contato_cpf: null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('contactFieldHint')}
              </p>
            </div>
          )}

          {!contato.contato && (
            <>
              <div className="flex flex-col gap-2">
                <Label>{t('nameFieldLabel')}</Label>
                <OptionSelect
                  options={stringFields}
                  value={contato.contato_nome}
                  onChange={v => onChange({ contato_nome: v, contato: null })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('emailFieldLabel')}</Label>
                <OptionSelect
                  options={stringFields}
                  value={contato.contato_email}
                  onChange={v => onChange({ contato_email: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('cpfFieldLabel')}</Label>
                <OptionSelect
                  options={stringFields}
                  value={contato.contato_cpf}
                  onChange={v => onChange({ contato_cpf: v })}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
