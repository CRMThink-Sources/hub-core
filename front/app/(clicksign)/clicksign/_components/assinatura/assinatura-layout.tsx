'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Grupo } from '../types'
import { GrupoCard } from './grupo-card'
import { useAssinaturaData } from '../data/use-assinatura-data'
import { useSettings } from '../data/use-settings'

function novoGrupo(): Grupo {
  return {
    id: null,
    contato_assinado: null,
    data_assinatura: null,
    arquivo: null,
    arquivo_assinado: null,
    clicksign_id: null,
    data_limite: null,
    processo_finalizado: null,
    observations: null,
    contatos: [
      {
        contato_padrao: false,
        contato: null,
        contato_nome: null,
        contato_email: null,
        contato_cpf: null,
        contato_group: null,
      },
    ],
    participantes: [],
  }
}

export default function AssinaturaLayout() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const { fields, error } = useAssinaturaData()
  const { settings, save: persist } = useSettings()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings?.groups) setGrupos(settings.groups as Grupo[])
  }, [settings])

  function updateGrupo(index: number, patch: Partial<Grupo>) {
    setGrupos(prev =>
      prev.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    )
  }
  function addGrupo() {
    setGrupos(prev => [...prev, novoGrupo()])
  }
  function removeGrupo(index: number) {
    setGrupos(prev => prev.filter((_, i) => i !== index))
  }
  function duplicateGrupo(index: number) {
    setGrupos(prev => {
      const original = prev[index]
      const copia: Grupo = {
        ...structuredClone(original),
        id: `${original.id ?? ''} (Cópia)`,
      }
      return [...prev.slice(0, index + 1), copia, ...prev.slice(index + 1)]
    })
  }

  async function save() {
    setSaving(true)
    try {
      await persist({ groups: grupos })
      toast.success('Grupos de assinatura salvos')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6 lg:px-8">
      <div className="sticky top-4 z-20 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Configuração de Assinaturas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure os grupos de assinatura e seus respectivos campos no
            Bitrix24
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void save()}
            disabled={saving}
          >
            <CheckIcon />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button onClick={addGrupo}>
            <PlusIcon />
            Novo Grupo
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum grupo de assinatura. Clique em “Novo Grupo” para começar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((grupo, index) => (
            <GrupoCard
              key={index}
              grupo={grupo}
              collapsed={!!collapsed[index]}
              onToggle={() =>
                setCollapsed(prev => ({ ...prev, [index]: !prev[index] }))
              }
              onChange={patch => updateGrupo(index, patch)}
              onRemove={() => removeGrupo(index)}
              onDuplicate={() => duplicateGrupo(index)}
              fields={fields}
            />
          ))}
        </div>
      )}
    </div>
  )
}
