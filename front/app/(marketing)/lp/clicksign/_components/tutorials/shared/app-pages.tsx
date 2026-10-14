import {
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  InfoIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  EXTRA_IDS,
  GROUP_FIELD_ORDER,
  type DealFieldId,
  type ExtraId,
} from '../../content'
import { useLpContent } from '../../content/locale-context'
import {
  FakeSelect,
  Hotspot,
  HotspotButton,
  PrimaryButton,
  type ScreenProps,
} from './frame'

// "Formato da Pasta" fica de fora de propósito: é salvo, mas o envio não usa.

const SECONDARY_SM =
  'inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 rounded-md bg-secondary px-2.5 text-xs font-medium text-secondary-foreground [&_svg]:size-3.5'

const INPUT =
  'flex h-9 w-full min-w-0 items-center truncate rounded-md border border-input px-2.5 text-left text-sm'

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

function FakeInput({
  value,
  placeholder = false,
  disabled = false,
  className,
}: {
  value: string
  placeholder?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        INPUT,
        placeholder && 'text-muted-foreground',
        disabled && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {value}
    </span>
  )
}

function InputSlot({
  value,
  placeholder,
  hotspot,
  className,
}: {
  value: string
  placeholder?: boolean
  hotspot?: ScreenProps
  className?: string
}) {
  return hotspot ? (
    <Hotspot
      {...hotspot}
      className={cn(INPUT, placeholder && 'text-muted-foreground', className)}
    >
      {value}
    </Hotspot>
  ) : (
    <FakeInput value={value} placeholder={placeholder} className={className} />
  )
}

function SelectSlot({
  value,
  hotspot,
  placeholder = false,
}: {
  value: string
  hotspot?: ScreenProps
  placeholder?: boolean
}) {
  if (!hotspot) {
    return (
      <span className={placeholder ? 'text-muted-foreground' : ''}>
        <FakeSelect value={value} className="w-full" />
      </span>
    )
  }
  return (
    <Hotspot
      {...hotspot}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm',
        placeholder && 'text-muted-foreground',
      )}
    >
      <span className="truncate">{value}</span>
      <span aria-hidden className="text-muted-foreground">
        ▾
      </span>
    </Hotspot>
  )
}

function OpenSelect({
  value,
  options,
  pick,
  hotspot,
}: {
  value: string
  options: string[]
  pick: string
  hotspot: ScreenProps
}) {
  return (
    <div className="relative">
      <FakeSelect value={value} className="w-full" />
      <div className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
        {options.map(option =>
          option === pick ? (
            <Hotspot
              key={option}
              {...hotspot}
              className="rounded-sm bg-accent px-2 py-1.5 text-left text-sm"
              dotClassName="right-2 top-2"
            >
              {option}
            </Hotspot>
          ) : (
            <span key={option} className="px-2 py-1.5 text-sm">
              {option}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

function SaveButton({
  label,
  hotspot,
  outline = false,
}: {
  label: string
  hotspot?: ScreenProps
  outline?: boolean
}) {
  const content = (
    <>
      <CheckIcon aria-hidden className="size-4" />
      {label}
    </>
  )
  const outlineClass =
    'inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium'
  if (hotspot) {
    return outline ? (
      <Hotspot {...hotspot} className={outlineClass}>
        {content}
      </Hotspot>
    ) : (
      <HotspotButton {...hotspot}>{content}</HotspotButton>
    )
  }
  return outline ? (
    <span className={outlineClass}>{content}</span>
  ) : (
    <PrimaryButton>{content}</PrimaryButton>
  )
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5',
        on ? 'justify-end bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span className="size-3.5 rounded-full bg-white shadow-sm" />
    </span>
  )
}

function Checkbox({
  checked,
  hotspot,
}: {
  checked: boolean
  hotspot?: ScreenProps
}) {
  const shape = cn(
    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
    checked
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-input',
  )
  const mark = checked ? <CheckIcon aria-hidden className="size-3" /> : null
  return hotspot ? (
    <Hotspot {...hotspot} className={shape} dotClassName="-right-2 -top-2">
      {mark}
    </Hotspot>
  ) : (
    <span aria-hidden className={shape}>
      {mark}
    </span>
  )
}

export function ConfiguracoesPage({
  tab,
  extraTab,
  children,
}: {
  tab: 'principal' | 'extra'
  extraTab?: ScreenProps
  children: React.ReactNode
}) {
  const { configuracoes } = useLpContent().shared
  const trigger = (active: boolean) =>
    cn(
      'flex h-full flex-1 items-center justify-center rounded-md text-sm font-medium',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground',
    )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex h-10 w-full max-w-sm gap-1 rounded-lg bg-muted p-1">
        <span className={trigger(tab === 'principal')}>
          {configuracoes.tabPrincipal}
        </span>
        {extraTab ? (
          <Hotspot {...extraTab} className={trigger(tab === 'extra')}>
            {configuracoes.tabExtra}
          </Hotspot>
        ) : (
          <span className={trigger(tab === 'extra')}>
            {configuracoes.tabExtra}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export type CompanyTarget = 'name' | 'token' | 'environment' | 'reminder'

export function CompaniesCard({
  name,
  token,
  reminderDays = 1,
  hotspot,
}: {
  name: string
  token: string | null
  reminderDays?: number
  hotspot?: ScreenProps & { target: CompanyTarget }
}) {
  const { configuracoes } = useLpContent().shared
  const at = (target: CompanyTarget) =>
    hotspot?.target === target ? hotspot : undefined
  const environment = at('environment')
  const reminder = at('reminder')

  return (
    <Card
      title={configuracoes.companiesTitle}
      description={configuracoes.companiesDescription}
      action={
        <PrimaryButton className="shrink-0">
          <PlusIcon aria-hidden className="size-4" />
          {configuracoes.newCompany}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BuildingIcon aria-hidden className="size-4" />
          </span>
          <InputSlot
            value={name}
            hotspot={at('name')}
            className="max-w-xs font-medium"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={configuracoes.tokenLabel}
            hint={configuracoes.tokenHint}
          >
            <InputSlot
              value={token ?? configuracoes.tokenPlaceholder}
              placeholder={token === null}
              hotspot={at('token')}
            />
          </Field>
          <Field
            label={configuracoes.environmentLabel}
            hint={configuracoes.environmentHint}
          >
            {environment ? (
              <OpenSelect
                value={configuracoes.environments.prod}
                options={[
                  configuracoes.environments.prod,
                  configuracoes.environments.sandbox,
                ]}
                pick={configuracoes.environments.prod}
                hotspot={environment}
              />
            ) : (
              <FakeSelect
                value={configuracoes.environments.prod}
                className="w-full"
              />
            )}
          </Field>
          <Field
            label={configuracoes.reminderLabel}
            hint={configuracoes.reminderHint}
          >
            {reminder ? (
              <OpenSelect
                value={configuracoes.reminderDays(reminderDays)}
                options={[1, 2, 3, 7, 14].map(configuracoes.reminderDays)}
                pick={configuracoes.reminderDays(3)}
                hotspot={reminder}
              />
            ) : (
              <FakeSelect
                value={configuracoes.reminderDays(reminderDays)}
                className="w-full"
              />
            )}
          </Field>
        </div>
      </div>
    </Card>
  )
}

export function SaveBar({ save }: { save?: ScreenProps }) {
  const { configuracoes } = useLpContent().shared
  return (
    <div className="flex justify-end">
      <SaveButton label={configuracoes.save} hotspot={save} />
    </div>
  )
}

// No app o aviso de custo da biometria aparece no hover do ícone; aqui fica à vista.
export function AdditionalCard({
  checked,
  hotspot,
}: {
  checked: ExtraId[]
  hotspot?: ScreenProps & { id: ExtraId }
}) {
  const { configuracoes } = useLpContent().shared

  return (
    <Card title={configuracoes.additionalTitle}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {EXTRA_IDS.map(id => (
          <div key={id} className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={checked.includes(id)}
              hotspot={
                hotspot?.id === id
                  ? { action: hotspot.action, onAdvance: hotspot.onAdvance }
                  : undefined
              }
            />
            <span className="min-w-0">
              <span className="inline-flex items-start gap-1.5">
                {configuracoes.extras[id]}
                {id === 'facialBiometrics' && (
                  <InfoIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                )}
              </span>
              {id === 'facialBiometrics' && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {configuracoes.facialBiometricsHint}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ContactFieldsCard({
  filled,
  cpf,
}: {
  filled: boolean
  cpf?: ScreenProps
}) {
  const { shared } = useLpContent()
  const { configuracoes, sample, select } = shared

  return (
    <Card
      title={configuracoes.contactFieldsTitle}
      description={configuracoes.contactFieldsDescription}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <Field label={configuracoes.cpfLabel}>
          <SelectSlot
            value={filled || cpf ? sample.cpfField : select}
            hotspot={cpf}
          />
        </Field>
        <Field label={configuracoes.isForeignLabel}>
          <SelectSlot
            value={filled || cpf ? sample.foreignField : select}
            placeholder={!filled && !cpf}
          />
        </Field>
        <Field label={configuracoes.signAsLabel} className="sm:col-span-2">
          <FakeInput value={configuracoes.signAsValue} disabled />
          <p className="text-xs text-primary">{configuracoes.signAsHint}</p>
        </Field>
      </div>
    </Card>
  )
}

export function AssinaturaPage({
  save,
  newGroup,
  children,
}: {
  save?: ScreenProps
  newGroup?: ScreenProps
  children: React.ReactNode
}) {
  const { assinatura } = useLpContent().shared
  const newGroupLabel = (
    <>
      <PlusIcon aria-hidden className="size-4" />
      {assinatura.newGroup}
    </>
  )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-foreground">
            {assinatura.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {assinatura.description}
          </p>
        </div>
        <div className="flex gap-2">
          <SaveButton label={assinatura.save} hotspot={save} outline />
          {newGroup ? (
            <HotspotButton {...newGroup}>{newGroupLabel}</HotspotButton>
          ) : (
            <PrimaryButton>{newGroupLabel}</PrimaryButton>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

export function EmptyGroups() {
  const { assinatura } = useLpContent().shared
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{assinatura.empty}</p>
    </div>
  )
}

export function GroupCard({
  id,
  idHotspot,
  collapsed = false,
  children,
}: {
  id: string | null
  idHotspot?: ScreenProps
  collapsed?: boolean
  children?: React.ReactNode
}) {
  const { assinatura } = useLpContent().shared
  const Chevron = collapsed ? ChevronRightIcon : ChevronDownIcon

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 p-3 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Chevron aria-hidden className="size-4 shrink-0" />
          <span className="text-sm text-muted-foreground">
            {assinatura.group}
          </span>
          <InputSlot
            value={id ?? assinatura.groupIdPlaceholder}
            placeholder={id === null}
            hotspot={idHotspot}
            className="max-w-64 bg-background"
          />
        </div>
        <span className="flex gap-2 text-muted-foreground">
          <CopyIcon aria-hidden className="size-4" />
          <XIcon aria-hidden className="size-4" />
        </span>
      </div>
      {!collapsed && children && (
        <div className="divide-y divide-border">{children}</div>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  button,
}: {
  title: string
  button?: { label: string; hotspot?: ScreenProps }
}) {
  const label = button && (
    <>
      <PlusIcon aria-hidden />
      {button.label}
    </>
  )
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {button &&
        (button.hotspot ? (
          <Hotspot {...button.hotspot} className={SECONDARY_SM}>
            {label}
          </Hotspot>
        ) : (
          <span className={SECONDARY_SM}>{label}</span>
        ))}
    </div>
  )
}

export function DealFieldsSection({
  filled,
  hotspot,
}: {
  filled: boolean
  hotspot?: ScreenProps & { field: DealFieldId }
}) {
  const { assinatura, select } = useLpContent().shared

  return (
    <div className="p-4 sm:p-5">
      <SectionHeader title={assinatura.dealFields} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GROUP_FIELD_ORDER.map(id => {
          const field = assinatura.fields[id]
          return (
            <Field key={id} label={field.label} hint={field.hint}>
              <SelectSlot
                value={filled ? field.label : select}
                placeholder={!filled}
                hotspot={
                  hotspot?.field === id
                    ? { action: hotspot.action, onAdvance: hotspot.onAdvance }
                    : undefined
                }
              />
            </Field>
          )
        })}
      </div>
    </div>
  )
}

export function ContactsSection({
  defaultOn,
  toggle,
}: {
  defaultOn: boolean
  toggle?: ScreenProps
}) {
  const { assinatura } = useLpContent().shared
  const row = (
    <>
      <Switch on={defaultOn} />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium text-foreground">
          {assinatura.useDefaultContact}
        </span>
        <span className="block text-xs text-muted-foreground">
          {assinatura.useDefaultContactHint}
        </span>
      </span>
    </>
  )

  return (
    <div className="p-4 sm:p-5">
      <SectionHeader
        title={assinatura.contactsTitle}
        button={{ label: assinatura.addContact }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        {toggle ? (
          <Hotspot
            {...toggle}
            className="flex items-center gap-3 rounded-lg px-1"
          >
            {row}
          </Hotspot>
        ) : (
          <span className="flex items-center gap-3">{row}</span>
        )}
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium">{assinatura.group}</span>
          <FakeSelect value="1" className="w-16" />
          <span className="flex size-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <Trash2Icon aria-hidden className="size-3.5" />
          </span>
        </span>
      </div>
    </div>
  )
}

export function ParticipantsSection({
  filled,
  add,
  role,
}: {
  filled: boolean
  add?: ScreenProps
  role?: ScreenProps
}) {
  const { assinatura, sample } = useLpContent().shared

  return (
    <div className="p-4 sm:p-5">
      <SectionHeader
        title={assinatura.participantsTitle}
        button={{ label: assinatura.add, hotspot: add }}
      />
      {filled && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={assinatura.userLabel}>
              <FakeSelect value={sample.user} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {assinatura.userHint}
              </p>
            </Field>
            <Field label={assinatura.roleLabel}>
              <SelectSlot value={sample.role} hotspot={role} />
            </Field>
            <Field label={assinatura.emailLabel}>
              <FakeInput value={assinatura.emailPlaceholder} placeholder />
            </Field>
            <Field label={assinatura.group}>
              <FakeSelect value="1" className="w-full" />
            </Field>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Checkbox checked={false} />
            {assinatura.isForeign}
          </p>
        </div>
      )}
    </div>
  )
}
