'use client'

import { Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { OptionSelect } from '../option-select'
import type { Participante, Option } from '../types'
import { GRUPOS_NUMERO, PARTES } from './constants'

type Props = {
  participante: Participante
  onChange: (patch: Partial<Participante>) => void
  onRemove: () => void
  users: Option[]
  userFields: Option[]
}

export function ParticipanteRow({
  participante,
  onChange,
  onRemove,
  users,
  userFields,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!participante.campo_usuario && (
          <div className="flex flex-col gap-2">
            <Label>Usuário</Label>
            <OptionSelect
              options={users}
              value={participante.contato}
              onChange={v => onChange({ contato: v, campo_usuario: null })}
            />
            <p className="text-xs text-muted-foreground">
              Selecione um usuário fixo ou use um campo do Bitrix
            </p>
          </div>
        )}

        {!participante.contato && (
          <div className="flex flex-col gap-2">
            <Label>Campo de Usuário</Label>
            <OptionSelect
              options={userFields}
              value={participante.campo_usuario}
              onChange={v => onChange({ campo_usuario: v, contato: null })}
            />
            <p className="text-xs text-muted-foreground">
              Campo do Bitrix que contém o contato
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Função</Label>
          <OptionSelect
            options={PARTES}
            value={participante.parte}
            onChange={v => onChange({ parte: v })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Email</Label>
          <Input
            value={participante.email ?? ''}
            onChange={e => onChange({ email: e.target.value })}
            placeholder="Email do participante"
          />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label>Grupo</Label>
            <OptionSelect
              options={GRUPOS_NUMERO}
              value={participante.grupo ? String(participante.grupo) : null}
              onChange={v => onChange({ grupo: v ? Number(v) : null })}
              placeholder="—"
            />
          </div>
          <Button
            variant="destructive"
            size="icon"
            onClick={onRemove}
            aria-label="Remover participante"
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={participante.has_documentation}
          onCheckedChange={(checked: boolean) =>
            onChange({ has_documentation: checked })
          }
        />
        <span>É estrangeiro</span>
      </label>
    </div>
  )
}
