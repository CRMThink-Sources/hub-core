import { cn } from '@/lib/utils'
import { BITRIX_MENU_IDS, type BitrixMenuId } from './content'
import { useLpBaseContent } from './lp-content-context'

export type ScreenProps = { action: string; onAdvance: () => void }

export type Screen = (props: ScreenProps) => React.ReactNode

export type ScreenFrame<AppMenu extends string = string> =
  | { kind: 'bitrix'; path: string; menu: BitrixMenuId }
  | { kind: 'app'; path: string; menu: AppMenu }
  | { kind: 'bare'; path: string }

export type AppAsideComponent<AppMenu extends string = string> = (props: {
  active: AppMenu
}) => React.ReactNode

export type TutorialView<
  ScreenId extends string = string,
  AppMenu extends string = string,
> = {
  screens: Record<ScreenId, Screen>
  frames: Record<ScreenId, ScreenFrame<AppMenu>>
}

// Laranja é o da logo, não o do tema.
export const HOTSPOT_RING =
  'relative ring-2 ring-orange-400 ring-offset-2 ring-offset-card focus-visible:outline-none focus-visible:ring-4'

export function PingDot({ className = '-right-1.5 -top-1.5' }) {
  return (
    <span aria-hidden className={`absolute flex size-3.5 ${className}`}>
      <span className="absolute inline-flex size-full rounded-full bg-orange-400 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex size-3.5 rounded-full bg-orange-500" />
    </span>
  )
}

export function Hotspot({
  action,
  onAdvance,
  children,
  className = '',
  dotClassName,
}: ScreenProps & {
  children: React.ReactNode
  className?: string
  dotClassName?: string
}) {
  return (
    <button
      type="button"
      data-hotspot
      aria-label={action}
      onClick={onAdvance}
      className={cn(HOTSPOT_RING, className)}
    >
      {children}
      <PingDot className={dotClassName} />
    </button>
  )
}

export function HotspotButton({
  children,
  className = '',
  ...props
}: ScreenProps & { children?: React.ReactNode; className?: string }) {
  return (
    <Hotspot
      {...props}
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80',
        className,
      )}
    >
      {children ?? props.action}
    </Hotspot>
  )
}

export function PrimaryButton({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium shadow-xs">
      {children}
    </span>
  )
}

export function BitrixMenu({ active }: { active: BitrixMenuId }) {
  const { bitrixMenu } = useLpBaseContent().frame

  return (
    <nav
      aria-hidden
      className="hidden w-36 shrink-0 space-y-1 bg-[#1f2d3d] p-3 text-xs text-white/70 sm:block"
    >
      <p className="mb-3 px-2 text-sm font-bold text-white">Bitrix24</p>
      {/* No Market o app ainda não foi instalado, então não tem item no menu. */}
      {BITRIX_MENU_IDS.filter(
        item => !(active === 'market' && item === 'app'),
      ).map(item => (
        <p
          key={item}
          className={`rounded-md px-2 py-1.5 ${item === active ? 'bg-white/15 font-semibold text-white' : ''}`}
        >
          {bitrixMenu[item]}
        </p>
      ))}
    </nav>
  )
}

export function DialogOver({
  background,
  children,
}: {
  background: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative h-full min-h-[inherit]">
      <div aria-hidden className="pointer-events-none opacity-40">
        {background}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 p-4">
        <div className="w-full max-w-sm rounded-xl bg-background p-5 shadow-xl ring-1 ring-foreground/10">
          {children}
        </div>
      </div>
    </div>
  )
}

export function FakeField({
  label,
  value,
  placeholder = false,
  multiline = false,
}: {
  label: string
  value: string
  placeholder?: boolean
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <p
        className={`rounded-lg border border-input px-2.5 py-1 text-sm ${
          multiline ? 'min-h-16 whitespace-pre-wrap' : 'h-8 truncate'
        } ${placeholder ? 'text-muted-foreground' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

export function FakeSelect({
  value,
  className = 'w-full max-w-60',
}: {
  value: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm',
        className,
      )}
    >
      <span className="truncate">{value}</span>
      <span aria-hidden className="text-muted-foreground">
        ▾
      </span>
    </span>
  )
}

export function FakeToggle({
  label,
  hint,
  on = false,
}: {
  label: string
  hint: string
  on?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${on ? 'justify-end bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span className="size-4 rounded-full bg-white shadow-sm" />
      </span>
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 opacity-60">
      <div className="h-12 w-20 rounded-lg bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  )
}
