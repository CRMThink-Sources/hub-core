import {
  AlertTriangleIcon,
  BellIcon,
  CheckIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_IDS, type SampleColumn } from '../../content'
import { useLpContent } from '../../content/locale-context'
import {
  FakeSelect,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenProps,
} from './frame'

const OUTLINE_SM =
  'inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium [&_svg]:size-3.5'

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

export function ImportacoesPage({
  newImport,
  children,
}: {
  newImport?: ScreenProps
  children?: React.ReactNode
}) {
  const { importacoes } = useLpContent().shared
  const label = (
    <>
      <PlusIcon aria-hidden className="size-4" />
      {importacoes.newImport}
    </>
  )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <PageHeader
        title={importacoes.title}
        subtitle={importacoes.subtitle}
        action={
          newImport ? (
            <HotspotButton {...newImport} className="shrink-0">
              {label}
            </HotspotButton>
          ) : (
            <PrimaryButton className="shrink-0">{label}</PrimaryButton>
          )
        }
      />
      {children}
    </div>
  )
}

export function EmptyImports() {
  const { importacoes } = useLpContent().shared

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {importacoes.emptyBefore}{' '}
        <span className="font-medium text-foreground">
          {importacoes.newImport}
        </span>{' '}
        {importacoes.emptyAfter}
      </p>
    </div>
  )
}

export type RunStatus = 'success' | 'partial' | 'running'

const STATUS_DOT: Record<RunStatus, string> = {
  success: 'bg-emerald-500',
  partial: 'bg-amber-500',
  running: 'bg-blue-500 animate-pulse',
}

export type ImportRowData = {
  title: string
  entity: string
  spreadsheet: string
  schedule: string
  status?: RunStatus
  lastRun?: string
  control:
    | { kind: 'switch'; enabled: boolean }
    | { kind: 'run'; running?: boolean }
}

export type RowHotspot = ScreenProps & {
  target: 'errors' | 'switch' | 'run'
}

export function ImportRow({
  data,
  hotspot,
}: {
  data: ImportRowData
  hotspot?: RowHotspot
}) {
  const { lista } = useLpContent().shared
  const at = (target: RowHotspot['target']) =>
    hotspot?.target === target ? hotspot : undefined

  const errorsHotspot = at('errors')
  const showErrors = data.status === 'partial'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {data.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {data.entity} · {data.spreadsheet} · {data.schedule}
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          {data.status && (
            <span
              className={`inline-block size-1.5 shrink-0 rounded-full ${STATUS_DOT[data.status]}`}
            />
          )}
          {data.lastRun ?? lista.neverRun}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showErrors &&
          (errorsHotspot ? (
            <Hotspot
              {...errorsHotspot}
              className={cn(OUTLINE_SM, 'border-amber-300 text-amber-600')}
            >
              <AlertTriangleIcon aria-hidden />
              {lista.viewErrors}
            </Hotspot>
          ) : (
            <span className={cn(OUTLINE_SM, 'border-amber-300 text-amber-600')}>
              <AlertTriangleIcon aria-hidden />
              {lista.viewErrors}
            </span>
          ))}
        {data.control.kind === 'switch' ? (
          <ScheduleSwitch
            enabled={data.control.enabled}
            hotspot={at('switch')}
          />
        ) : (
          <RunButton running={data.control.running} hotspot={at('run')} />
        )}
        <span className={OUTLINE_SM}>
          <PencilIcon aria-hidden />
          {lista.edit}
        </span>
        <span className={OUTLINE_SM}>
          <Trash2Icon aria-hidden />
        </span>
      </div>
    </div>
  )
}

function ScheduleSwitch({
  enabled,
  hotspot,
}: {
  enabled: boolean
  hotspot?: ScreenProps
}) {
  const { lista } = useLpContent().shared
  const shape = cn(
    'flex items-center gap-2 rounded-full border px-2.5 py-1',
    enabled ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-muted',
  )
  const content = (
    <>
      <Switch on={enabled} />
      <span
        className={cn(
          'text-xs font-medium',
          enabled ? 'text-emerald-700' : 'text-muted-foreground',
        )}
      >
        {enabled ? lista.scheduleActive : lista.schedulePaused}
      </span>
    </>
  )

  return hotspot ? (
    <Hotspot {...hotspot} className={shape}>
      {content}
    </Hotspot>
  ) : (
    <span className={shape}>{content}</span>
  )
}

function RunButton({
  running = false,
  hotspot,
}: {
  running?: boolean
  hotspot?: ScreenProps
}) {
  const { lista } = useLpContent().shared
  const content = (
    <>
      <PlayIcon aria-hidden />
      {running ? lista.running : lista.run}
    </>
  )

  return hotspot ? (
    <Hotspot {...hotspot} className={OUTLINE_SM}>
      {content}
    </Hotspot>
  ) : (
    <span className={cn(OUTLINE_SM, running && 'opacity-50')}>{content}</span>
  )
}

export function Switch({ on }: { on: boolean }) {
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

export function useSampleImport(): Omit<ImportRowData, 'control'> {
  const { shared } = useLpContent()
  const { sample, configure, lista } = shared

  return {
    title: sample.importTitle,
    entity: configure.entities.DEAL,
    spreadsheet: sample.spreadsheetName,
    schedule: lista.everyHours(6),
    status: 'success',
    lastRun: lista.lastRun(sample.lastRunWhen),
  }
}

export function ConfiguracoesPage({
  successBanner = false,
  children,
}: {
  successBanner?: boolean
  children: React.ReactNode
}) {
  const { configuracoes } = useLpContent().shared

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <PageHeader
        title={configuracoes.title}
        subtitle={configuracoes.subtitle}
      />
      {successBanner && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground">
          <span>{configuracoes.success}</span>
          <XIcon aria-hidden className="size-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  )
}

export function GoogleCard({
  connected,
  hotspot,
}: {
  connected: boolean
  hotspot?: ScreenProps
}) {
  const { shared } = useLpContent()
  const { configuracoes, sample } = shared
  const status = connected
    ? `${configuracoes.connected} · ${sample.googleEmail}`
    : configuracoes.noAccount

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-tight text-foreground">
          {configuracoes.googleConnection}
        </p>
        {connected && hotspot ? (
          <Hotspot
            {...hotspot}
            className="mt-1 rounded px-1 text-sm text-muted-foreground"
          >
            {status}
          </Hotspot>
        ) : (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {status}
          </p>
        )}
      </div>
      {connected ? (
        <span className="inline-flex h-9 shrink-0 items-center rounded-md bg-destructive/10 px-2.5 text-sm font-medium text-destructive">
          {configuracoes.disconnect}
        </span>
      ) : hotspot ? (
        <HotspotButton {...hotspot} className="shrink-0">
          {configuracoes.connectGoogle}
        </HotspotButton>
      ) : (
        <PrimaryButton className="shrink-0">
          {configuracoes.connectGoogle}
        </PrimaryButton>
      )}
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function NotifyCard({
  users,
  selected,
  dirty,
  userHotspot,
  saveHotspot,
}: {
  users: string[]
  selected: string[]
  dirty: boolean
  userHotspot?: ScreenProps & { user: string }
  saveHotspot?: ScreenProps
}) {
  const { configuracoes } = useLpContent().shared
  const ordered = [
    ...users.filter(user => selected.includes(user)),
    ...users.filter(user => !selected.includes(user)),
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BellIcon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {configuracoes.notifyTitle}
            {selected.length > 0 && (
              <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                {configuracoes.selectedCount(selected.length)}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {configuracoes.notifyDescription}
          </p>
        </div>
      </div>

      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {configuracoes.recipients}
        </p>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {configuracoes.noneSelected}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map(user => (
              <span
                key={user}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-1 pr-1.5 text-xs"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                  {initials(user)}
                </span>
                {user}
                <XIcon aria-hidden className="size-3 text-muted-foreground" />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm text-muted-foreground">
          <SearchIcon aria-hidden className="size-4" />
          {configuracoes.searchUser}
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          {ordered.map(user => {
            const checked = selected.includes(user)
            const row = (
              <>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    checked
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {checked ? (
                    <CheckIcon aria-hidden className="size-3.5" />
                  ) : (
                    initials(user)
                  )}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    checked && 'font-medium',
                  )}
                >
                  {user}
                </span>
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {checked && <CheckIcon aria-hidden className="size-3" />}
                </span>
              </>
            )
            const shape = cn(
              'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0',
              checked && 'bg-primary/5',
            )
            return userHotspot?.user === user ? (
              <Hotspot
                key={user}
                action={userHotspot.action}
                onAdvance={userHotspot.onAdvance}
                className={shape}
                dotClassName="right-2 top-1"
              >
                {row}
              </Hotspot>
            ) : (
              <div key={user} className={shape}>
                {row}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-4 py-3">
        <span className="text-sm text-foreground">
          {dirty ? (
            configuracoes.unsaved
          ) : selected.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon aria-hidden className="size-4 text-primary" />
              {configuracoes.allSaved}
            </span>
          ) : null}
        </span>
        {saveHotspot ? (
          <HotspotButton {...saveHotspot}>{configuracoes.save}</HotspotButton>
        ) : (
          <PrimaryButton className={dirty ? '' : 'opacity-50'}>
            {configuracoes.save}
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}

// No app o diálogo é `max-w-5xl` sobre Importações; aqui ocupa a tela toda.
export function ConfigureDialog({
  top,
  children,
  save,
}: {
  top?: React.ReactNode
  children?: React.ReactNode
  save?: ScreenProps
}) {
  const { configure } = useLpContent().shared

  return (
    <div className="h-full min-h-[inherit] bg-black/10 p-3 sm:p-4">
      <div className="overflow-hidden rounded-xl bg-background shadow-xl ring-1 ring-foreground/10">
        <div className="px-5 pt-4">
          <p className="text-base font-medium">{configure.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {configure.description}
          </p>
        </div>
        {top && (
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4">
            {top}
          </div>
        )}
        {children && (
          <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/50 px-5 py-3">
          <span className="text-sm font-medium">{configure.back}</span>
          <div className="flex items-center gap-2">
            <OutlineButton>{configure.cancel}</OutlineButton>
            {save ? (
              <HotspotButton {...save}>{configure.save}</HotspotButton>
            ) : (
              <PrimaryButton>{configure.save}</PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function FakeInput({
  value,
  disabled = false,
}: {
  value: string
  disabled?: boolean
}) {
  return (
    <span
      className={cn(
        'flex h-9 items-center truncate rounded-md border border-input px-2.5 text-sm',
        disabled && 'bg-muted text-muted-foreground',
      )}
    >
      {value}
    </span>
  )
}

export function IdentitySection({ startRow }: { startRow?: ScreenProps }) {
  const { configure, sample } = useLpContent().shared
  const { identity } = configure

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={identity.name}>
        <FakeInput value={sample.importTitle} />
      </Field>
      <Field label={identity.spreadsheet}>
        <FakeInput value={sample.spreadsheetId} disabled />
      </Field>
      <Field label={identity.tab}>
        <FakeSelect value={sample.tab} className="w-full" />
      </Field>
      <Field label={identity.startRow} hint={identity.startRowHint}>
        {startRow ? (
          <Hotspot
            {...startRow}
            className="flex h-9 items-center rounded-md border border-input px-2.5 text-left text-sm"
          >
            2
          </Hotspot>
        ) : (
          <FakeInput value="2" />
        )}
      </Field>
    </div>
  )
}

export function DestinationSection({ entity }: { entity?: ScreenProps }) {
  const { configure, sample } = useLpContent().shared
  const { destination, entities } = configure

  if (entity) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={destination.entity}>
          <div className="relative">
            <FakeSelect value={entities.DEAL} className="w-full" />
            <div className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
              {ENTITY_IDS.map(id =>
                id === 'DEAL' ? (
                  <Hotspot
                    key={id}
                    {...entity}
                    className="rounded-sm bg-accent px-2 py-1.5 text-left text-sm"
                    dotClassName="right-2 top-2"
                  >
                    {entities[id]}
                  </Hotspot>
                ) : (
                  <span key={id} className="px-2 py-1.5 text-sm">
                    {entities[id]}
                  </span>
                ),
              )}
            </div>
          </div>
        </Field>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={destination.entity}>
        <FakeSelect value={entities.DEAL} className="w-full" />
      </Field>
      <Field label={destination.pipeline}>
        <FakeSelect value={sample.pipeline} className="w-full" />
      </Field>
    </div>
  )
}

export function ResponsibleSection({ matchBy }: { matchBy?: ScreenProps }) {
  const { configure, sample } = useLpContent().shared
  const column = sample.columns[sample.columns.length - 1]
  const columnLabel = `${column.letter} · ${column.label}`

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={configure.responsible.column}>
        <FakeSelect value={columnLabel} className="w-full" />
      </Field>
      <Field label={configure.responsible.matchBy}>
        {matchBy ? (
          <Hotspot
            {...matchBy}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm"
          >
            {configure.match.email}
            <span aria-hidden className="text-muted-foreground">
              ▾
            </span>
          </Hotspot>
        ) : (
          <FakeSelect value={configure.match.email} className="w-full" />
        )}
      </Field>
    </div>
  )
}

export function OptionsSection({
  contactOn,
  createContact,
}: {
  contactOn: boolean
  createContact?: ScreenProps
}) {
  const { options } = useLpContent().shared.configure
  const contact = (
    <>
      <Switch on={contactOn} />
      <span className="text-sm text-foreground">{options.createContact}</span>
    </>
  )

  return (
    <div className="flex flex-wrap gap-6">
      {createContact ? (
        <Hotspot
          {...createContact}
          className="flex items-center gap-2 rounded-full px-1"
        >
          {contact}
        </Hotspot>
      ) : (
        <span className="flex items-center gap-2">{contact}</span>
      )}
      <span className="flex items-center gap-2">
        <Switch on={false} />
        <span className="text-sm text-foreground">{options.createCompany}</span>
      </span>
    </div>
  )
}

export function MappingTable({
  identifier,
  destination,
  identifierChecked = false,
}: {
  identifier?: ScreenProps
  destination?: ScreenProps
  identifierChecked?: boolean
}) {
  const { configure, sample } = useLpContent().shared
  const { mapping, entities } = configure
  const grid =
    'grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1.3fr)_3.75rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1.3fr)_4.5rem_1.75rem]'
  const targetLabel = (column: SampleColumn) =>
    column.target === 'main'
      ? entities.DEAL
      : mapping.destinations[column.target]

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{mapping.title}</p>
          <p className="text-xs text-muted-foreground">{mapping.description}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {mapping.counter(sample.columns.length, sample.columns.length)}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border text-xs">
        <div
          className={`${grid} border-b border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground`}
        >
          <span>{mapping.column}</span>
          <span>{mapping.destination}</span>
          <span>{mapping.field}</span>
          <span className="text-center">{mapping.identifier}</span>
          <span className="hidden text-center sm:block">{mapping.actions}</span>
        </div>
        <ul className="divide-y divide-border">
          {sample.columns.map((column, index) => {
            const tag = column.type
              ? ` · ${mapping.fieldTypes[column.type]}`
              : ''
            const checked = index === 0 && identifierChecked
            return (
              <li key={column.letter} className={`${grid} px-3 py-2`}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-emerald-50 font-mono font-medium text-emerald-700">
                    {column.letter}
                  </span>
                  <span className="truncate">{column.label}</span>
                </span>
                {index === 1 && destination ? (
                  <Hotspot
                    {...destination}
                    className="flex h-8 min-w-0 items-center justify-between gap-1 rounded-md border border-border bg-background px-2 text-left"
                  >
                    <span className="truncate">{targetLabel(column)}</span>
                    <span aria-hidden className="text-muted-foreground">
                      ▾
                    </span>
                  </Hotspot>
                ) : (
                  <FakeSelect
                    value={targetLabel(column)}
                    className="h-8 w-full px-2 text-xs"
                  />
                )}
                <FakeSelect
                  value={`${column.field}${tag}`}
                  className="h-8 w-full px-2 text-xs"
                />
                <span className="flex justify-center">
                  {index === 0 && identifier ? (
                    <Hotspot
                      {...identifier}
                      className="flex size-5 items-center justify-center rounded-md border-2 border-input"
                    >
                      {null}
                    </Hotspot>
                  ) : (
                    <Checkbox checked={checked} />
                  )}
                </span>
                <span className="hidden justify-center text-muted-foreground sm:flex">
                  <Trash2Icon aria-hidden className="size-3.5" />
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 items-center justify-center rounded-md border-2',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input',
      )}
    >
      {checked && <CheckIcon className="size-3.5" />}
    </span>
  )
}
