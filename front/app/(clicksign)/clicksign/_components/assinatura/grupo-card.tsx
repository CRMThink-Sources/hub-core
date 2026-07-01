'use client'

import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionSelect } from '../option-select'
import type { Contato, Grupo, Option, Participante } from '../types'
import { ContatoRow } from './contato-row'
import { ParticipanteRow } from './participante-row'

export type BitrixFields = {
  stringFields: Option[]
  dateFields: Option[]
  fileFields: Option[]
  contactFields: Option[]
  userFields: Option[]
  users: Option[]
}

type Props = {
  grupo: Grupo
  collapsed: boolean
  onToggle: () => void
  onChange: (patch: Partial<Grupo>) => void
  onRemove: () => void
  onDuplicate: () => void
  fields: BitrixFields
}

function novoContato(): Contato {
  return {
    contato_padrao: false,
    contato: null,
    contato_nome: null,
    contato_email: null,
    contato_cpf: null,
    contato_group: null,
  }
}

function novoParticipante(): Participante {
  return {
    contato: null,
    campo_usuario: null,
    email: null,
    cpf: null,
    parte: null,
    grupo: null,
    has_documentation: false,
  }
}

export function GrupoCard({
  grupo,
  collapsed,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  fields,
}: Props) {
  const { t } = useTranslation('clicksign/assinatura')
  const {
    stringFields,
    dateFields,
    fileFields,
    contactFields,
    userFields,
    users,
  } = fields

  function patchContato(index: number, patch: Partial<Contato>) {
    onChange({
      contatos: grupo.contatos.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    })
  }
  function patchParticipante(index: number, patch: Partial<Participante>) {
    onChange({
      participantes: grupo.participantes.map((p, i) =>
        i === index ? { ...p, ...patch } : p,
      ),
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Cabeçalho do grupo */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onToggle}>
            {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </Button>
          <span className="text-sm text-muted-foreground">{t('group')}</span>
          <Input
            value={grupo.id ?? ''}
            onChange={e => onChange({ id: e.target.value })}
            placeholder={t('groupIdPlaceholder')}
            className="w-64"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDuplicate}
            aria-label={t('duplicateGroup')}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('removeGroup')}
          >
            <XIcon />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-border">
          {/* Campos do Negócio */}
          <div className="p-6">
            <h3 className="mb-4 text-sm font-medium text-foreground">
              {t('dealFields')}
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{t('statusLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('statusHint')}
                </p>
                <OptionSelect
                  options={stringFields}
                  value={grupo.contato_assinado}
                  onChange={v => onChange({ contato_assinado: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('signedFileLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('signedFileHint')}
                </p>
                <OptionSelect
                  options={fileFields}
                  value={grupo.arquivo_assinado}
                  onChange={v => onChange({ arquivo_assinado: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('signDateLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('signDateHint')}
                </p>
                <OptionSelect
                  options={dateFields}
                  value={grupo.data_assinatura}
                  onChange={v => onChange({ data_assinatura: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('docIdLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('docIdHint')}
                </p>
                <OptionSelect
                  options={stringFields}
                  value={grupo.clicksign_id}
                  onChange={v => onChange({ clicksign_id: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('fileToSignLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('fileToSignHint')}
                </p>
                <OptionSelect
                  options={fileFields}
                  value={grupo.arquivo}
                  onChange={v => onChange({ arquivo: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('deadlineLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('deadlineHint')}
                </p>
                <OptionSelect
                  options={dateFields}
                  value={grupo.data_limite}
                  onChange={v => onChange({ data_limite: v })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('finishedLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('finishedHint')}
                </p>
                <OptionSelect
                  options={stringFields}
                  value={grupo.processo_finalizado}
                  onChange={v => onChange({ processo_finalizado: v })}
                />
              </div>
            </div>
          </div>

          {/* Contatos */}
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                {t('contactsTitle')}
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChange({ contatos: [...grupo.contatos, novoContato()] })
                }
              >
                <PlusIcon />
                {t('addContact')}
              </Button>
            </div>
            <div className="flex flex-col gap-4">
              {grupo.contatos.map((contato, i) => (
                <ContatoRow
                  key={i}
                  contato={contato}
                  onChange={patch => patchContato(i, patch)}
                  onRemove={() =>
                    onChange({
                      contatos: grupo.contatos.filter((_, idx) => idx !== i),
                    })
                  }
                  contactFields={contactFields}
                  stringFields={stringFields}
                />
              ))}
            </div>
          </div>

          {/* Participantes */}
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                {t('participantsTitle')}
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChange({
                    participantes: [...grupo.participantes, novoParticipante()],
                  })
                }
              >
                <PlusIcon />
                {t('add')}
              </Button>
            </div>
            <div className="flex flex-col gap-4">
              {grupo.participantes.map((participante, i) => (
                <ParticipanteRow
                  key={i}
                  participante={participante}
                  onChange={patch => patchParticipante(i, patch)}
                  onRemove={() =>
                    onChange({
                      participantes: grupo.participantes.filter(
                        (_, idx) => idx !== i,
                      ),
                    })
                  }
                  users={users}
                  userFields={userFields}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
