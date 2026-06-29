'use client'

import { useEffect, useState } from 'react'
import {
  BuildingIcon,
  PlusIcon,
  Trash2Icon,
  CheckIcon,
  InfoIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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

const EXTRA_CONFIGS: {
  key: keyof VerifySettings
  labelKey: string
  hintKey?: string
}[] = [
  { key: 'selfie_enabled', labelKey: 'selfie' },
  {
    key: 'facial_biometrics_enabled',
    labelKey: 'facialBiometrics',
    hintKey: 'facialBiometricsHint',
  },
  { key: 'handwritten_enabled', labelKey: 'handwritten' },
  { key: 'official_document_enabled', labelKey: 'officialDocument' },
  { key: 'rubrica', labelKey: 'rubrica' },
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
  const { t } = useTranslation('clicksign/configuracoes')
  const [empresas, setEmpresas] = useState<Empresa[]>([novaEmpresa()])
  const [verify, setVerify] = useState<VerifySettings>({
    selfie_enabled: false,
    facial_biometrics_enabled: false,
    handwritten_enabled: false,
    official_document_enabled: false,
    rubrica: false,
  })
  const [contact, setContact] = useState<ContactSettings>({
    documentation: null,
    has_document: null,
    part: { name: '[Clicksign] Assinar como', code: 'UF_CRM_SIGNER_PART' },
  })
  const { fields: contactFields } = useContactFields()
  const { settings, save: persist } = useSettings()
  const [savingMain, setSavingMain] = useState(false)
  const [savingExtra, setSavingExtra] = useState(false)

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

  async function saveMain() {
    setSavingMain(true)
    try {
      await persist({ fields: { tokens: empresas } })
      toast.success(t('toastSaved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastError'))
    } finally {
      setSavingMain(false)
    }
  }

  async function saveExtra() {
    setSavingExtra(true)
    try {
      await persist({ verifySettings: verify, contactSettings: contact })
      toast.success(t('toastSaved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastError'))
    } finally {
      setSavingExtra(false)
    }
  }

  return (
    <Tabs
      defaultValue="principal"
      className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 sm:px-6 lg:px-8"
    >
      <TabsList className="w-full max-w-sm group-data-horizontal/tabs:h-11">
        <TabsTrigger value="principal" className="h-full text-base">
          {t('tabPrincipal')}
        </TabsTrigger>
        <TabsTrigger value="extra" className="h-full text-base">
          {t('tabExtra')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="principal" className="flex flex-col gap-6">
        {/* Empresas */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border p-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {t('companiesTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('companiesDescription')}
              </p>
            </div>
            <Button onClick={addEmpresa}>
              <PlusIcon />
              {t('newCompany')}
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
                      placeholder={t('companyNamePlaceholder')}
                      className="max-w-sm text-base font-medium"
                    />
                  </div>
                  {empresas.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeEmpresa(index)}
                      aria-label={t('removeCompany')}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>{t('tokenLabel')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('tokenHint')}
                    </p>
                    <Input
                      value={empresa.token}
                      onChange={e =>
                        updateEmpresa(index, { token: e.target.value })
                      }
                      placeholder={t('tokenPlaceholder')}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>{t('environmentLabel')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('environmentHint')}
                    </p>
                    <OptionSelect
                      options={AMBIENTES}
                      value={empresa.ambiente}
                      onChange={v =>
                        updateEmpresa(index, {
                          ambiente: (v ?? 'prod') as Empresa['ambiente'],
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>{t('folderLabel')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('folderHint')}
                    </p>
                    <OptionSelect
                      options={PASTAS}
                      value={empresa.pasta}
                      onChange={v =>
                        updateEmpresa(index, { pasta: v ?? '#title' })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>{t('reminderLabel')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('reminderHint')}
                    </p>
                    <OptionSelect
                      options={LEMBRETES}
                      value={empresa.lembrete}
                      onChange={v =>
                        updateEmpresa(index, { lembrete: v ?? '1' })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => void saveMain()} disabled={savingMain}>
            <CheckIcon />
            {savingMain ? t('saving') : t('save')}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="extra" className="flex flex-col gap-6">
        {/* Configurações extras */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t('additionalTitle')}
            </h2>
          </div>
          <div className="flex flex-col gap-3 p-6">
            {EXTRA_CONFIGS.map(({ key, labelKey, hintKey }) => (
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
                <span className="inline-flex items-center gap-1.5">
                  {t(labelKey)}
                  {hintKey && (
                    <span className="group relative inline-flex">
                      <InfoIcon className="size-4 shrink-0 cursor-help text-muted-foreground" />
                      <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-opacity group-hover:visible group-hover:opacity-100">
                        {t(hintKey)}
                      </span>
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Campos de contato */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t('contactFieldsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('contactFieldsDescription')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t('cpfLabel')}</Label>
              <OptionSelect
                options={contactFields}
                value={contact.documentation}
                onChange={v =>
                  setContact(prev => ({ ...prev, documentation: v }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('isForeignLabel')}</Label>
              <OptionSelect
                options={contactFields}
                value={contact.has_document}
                onChange={v =>
                  setContact(prev => ({ ...prev, has_document: v }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>{t('signAsLabel')}</Label>
              <Input disabled value={contact.part.name} />
              <p className="text-xs text-primary">{t('signAsHint')}</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => void saveExtra()} disabled={savingExtra}>
            <CheckIcon />
            {savingExtra ? t('saving') : t('save')}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
