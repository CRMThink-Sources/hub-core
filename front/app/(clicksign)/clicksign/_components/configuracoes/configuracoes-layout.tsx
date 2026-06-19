'use client'

import { useEffect, useState } from 'react'
import { BuildingIcon, PlusIcon, Trash2Icon, CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { OptionSelect } from '../option-select'
import { useContactFields } from '../data/use-contact-fields'
import { useSettings } from '../data/use-settings'
import type { Empresa, Option, VerifySettings, ContactSettings } from '../types'

// Constantes de domínio Clicksign (não vêm do Bitrix)
const AMBIENTES: Option[] = [
  { code: 'prod', name: 'Produção' },
  { code: 'sandbox', name: 'Sandbox' },
]
const PASTAS: Option[] = [
  { code: '#title', name: 'Título do Card' },
  { code: '#date', name: 'Data Atual (yyyy-mm-dd)' },
  { code: '#locale_data', name: 'Data Atual (dd-mm-yyyy)' },
]
const LEMBRETES: Option[] = [
  { code: '1', name: '1 dia' },
  { code: '2', name: '2 dias' },
  { code: '3', name: '3 dias' },
  { code: '7', name: '7 dias' },
  { code: '14', name: '14 dias' },
]

const EXTRA_CONFIGS: { key: keyof VerifySettings; label: string }[] = [
  { key: 'selfie_enabled', label: 'Utilizar Selfie como autenticação' },
  {
    key: 'facial_biometrics_enabled',
    label:
      'Utilizar biometria facial como ponto de autenticação adicional para o signatário',
  },
  {
    key: 'handwritten_enabled',
    label:
      'Utilizar assinatura manuscrita como ponto de autenticação no momento da assinatura',
  },
  {
    key: 'official_document_enabled',
    label: 'Solicitar a foto (frente e verso) do documento oficial',
  },
  {
    key: 'has_documentation',
    label: 'Não solicitar documento (CPF) no momento da assinatura',
  },
  {
    key: 'rubrica',
    label: 'Solicitar rubrica (necessário ativar função de envelope)',
  },
]

function novaEmpresa(): Empresa {
  return {
    name: 'Nova Empresa',
    token: '',
    ambiente: 'prod',
    pasta: '#title',
    lembrete: '1',
  }
}

export default function ConfiguracoesLayout() {
  const [empresas, setEmpresas] = useState<Empresa[]>([novaEmpresa()])
  const [verify, setVerify] = useState<VerifySettings>({
    selfie_enabled: false,
    facial_biometrics_enabled: false,
    handwritten_enabled: false,
    official_document_enabled: false,
    has_documentation: false,
    rubrica: false,
  })
  const [contact, setContact] = useState<ContactSettings>({
    documentation: null,
    has_document: null,
    part: { name: '[Clicksign] Assinar como', code: 'UF_CRM_SIGNER_PART' },
  })
  const { fields: contactFields } = useContactFields()
  const { settings, save: persist } = useSettings()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    const tokens = (settings.fields as { tokens?: Empresa[] } | null)?.tokens
    if (tokens?.length) setEmpresas(tokens)
    if (settings.verifySettings)
      setVerify(settings.verifySettings as VerifySettings)
    if (settings.contactSettings)
      setContact(settings.contactSettings as ContactSettings)
  }, [settings])

  function updateEmpresa(index: number, patch: Partial<Empresa>) {
    setEmpresas(prev =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    )
  }
  function addEmpresa() {
    setEmpresas(prev => [...prev, novaEmpresa()])
  }
  function removeEmpresa(index: number) {
    setEmpresas(prev => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    try {
      await persist({
        fields: { tokens: empresas },
        verifySettings: verify,
        contactSettings: contact,
      })
      toast.success('Configurações salvas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6 lg:px-8">
      {/* Empresas */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border p-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Configurações de Empresas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie as configurações de integração com a Clicksign
            </p>
          </div>
          <Button onClick={addEmpresa}>
            <PlusIcon />
            Nova Empresa
          </Button>
        </div>

        <div className="divide-y divide-border">
          {empresas.map((empresa, index) => (
            <div key={index} className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BuildingIcon className="size-5" />
                  </div>
                  <Input
                    value={empresa.name}
                    onChange={e =>
                      updateEmpresa(index, { name: e.target.value })
                    }
                    placeholder="Nome da empresa"
                    className="max-w-sm text-base font-medium"
                  />
                </div>
                {empresas.length > 1 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeEmpresa(index)}
                    aria-label="Remover empresa"
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Token de Acesso</Label>
                  <Input
                    value={empresa.token}
                    onChange={e =>
                      updateEmpresa(index, { token: e.target.value })
                    }
                    placeholder="Cole o token da Clicksign"
                  />
                  <p className="text-xs text-muted-foreground">
                    Token de autenticação da API Clicksign
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Ambiente</Label>
                  <OptionSelect
                    options={AMBIENTES}
                    value={empresa.ambiente}
                    onChange={v =>
                      updateEmpresa(index, {
                        ambiente: (v ?? 'prod') as Empresa['ambiente'],
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Ambiente de integração com a Clicksign
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Formato da Pasta</Label>
                  <OptionSelect
                    options={PASTAS}
                    value={empresa.pasta}
                    onChange={v =>
                      updateEmpresa(index, { pasta: v ?? '#title' })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Como as pastas serão nomeadas na Clicksign
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Lembrete Automático</Label>
                  <OptionSelect
                    options={LEMBRETES}
                    value={empresa.lembrete}
                    onChange={v => updateEmpresa(index, { lembrete: v ?? '1' })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Frequência dos lembretes de assinatura
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Configurações extras */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Configurações Adicionais
          </h2>
        </div>
        <div className="flex flex-col gap-3 p-6">
          {EXTRA_CONFIGS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 text-sm text-foreground"
            >
              <Checkbox
                checked={verify[key]}
                onCheckedChange={(checked: boolean) =>
                  setVerify(prev => ({ ...prev, [key]: checked }))
                }
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Campos de contato */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Campos de Contato
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>CPF</Label>
            <OptionSelect
              options={contactFields}
              value={contact.documentation}
              onChange={v =>
                setContact(prev => ({ ...prev, documentation: v }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>É estrangeiro?</Label>
            <OptionSelect
              options={contactFields}
              value={contact.has_document}
              onChange={v => setContact(prev => ({ ...prev, has_document: v }))}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Assinar como</Label>
            <Input disabled value={contact.part.name} />
            <p className="text-xs text-primary">
              Campo criado na instalação do APP (não excluir)
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          <CheckIcon />
          {saving ? 'Salvando…' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  )
}
