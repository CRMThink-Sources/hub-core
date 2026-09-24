import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Peças comuns às telas simuladas dos tutoriais: contrato de tela, moldura
 * (menu do Bitrix24 ou menu lateral do app), destaque clicável e elementos
 * inertes. As telas são desenhadas em HTML — não são prints — mas copiam a
 * estrutura, as classes e os textos dos componentes reais.
 *
 * Cada tela recebe `action` (rótulo acessível do elemento destacado) e
 * `onAdvance`, e decide ela mesma qual elemento destacar — o botão, a linha da
 * tabela, a aba ou o QR code, como no app. Uma tela tem um destaque só.
 */
export type ScreenProps = { action: string; onAdvance: () => void }

export type Screen = (props: ScreenProps) => React.ReactNode

/**
 * Moldura de cada tela: portal do Bitrix24 (menu escuro), app ThinkZap aberto no
 * portal (menu lateral do app) ou tela cheia sem menu (instalação).
 */
export type ScreenFrame =
  | { kind: 'bitrix'; path: string; menu: BitrixMenuItem }
  | { kind: 'app'; path: string; menu: AppMenuItem }
  | { kind: 'bare'; path: string }

export const APP_PATH = 'marketplace/app/thinkzap/'

/** Telas e molduras de um tutorial, indexadas pelo id de tela de `content.ts`. */
export type TutorialView<ScreenId extends string = string> = {
  screens: Record<ScreenId, Screen>
  frames: Record<ScreenId, ScreenFrame>
}

// ─── Destaque ──────────────────────────────────────────────────────────────

/** Anel laranja do elemento a clicar. Laranja é o da logo, não o do tema. */
export const HOTSPOT_RING =
  'relative ring-2 ring-orange-400 ring-offset-2 ring-offset-card focus-visible:outline-none focus-visible:ring-4'

/** Bolinha pulsando no canto do elemento destacado. */
export function PingDot({ className = '-right-1.5 -top-1.5' }) {
  return (
    <span aria-hidden className={`absolute flex size-3.5 ${className}`}>
      <span className="absolute inline-flex size-full rounded-full bg-orange-400 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex size-3.5 rounded-full bg-orange-500" />
    </span>
  )
}

/**
 * Qualquer elemento como destaque: `button` com o rótulo, o anel e a bolinha.
 * O visual fica todo em `className`.
 */
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

/** Botão primário do app (`Button` default do shadcn) com o destaque. */
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

/** `Button` default do app, inerte na simulação. */
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

/** `Button` variant outline do app, inerte na simulação. */
export function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-medium shadow-xs">
      {children}
    </span>
  )
}

// ─── Molduras ──────────────────────────────────────────────────────────────

export const BITRIX_MENU = [
  'CRM',
  'Canais abertos',
  'ThinkZap',
  'Market',
] as const
export type BitrixMenuItem = (typeof BITRIX_MENU)[number]

/** Menu do portal Bitrix24 — só o necessário para situar a tela. */
export function BitrixMenu({ active }: { active: BitrixMenuItem }) {
  return (
    <nav
      aria-hidden
      className="hidden w-36 shrink-0 space-y-1 bg-[#1f2d3d] p-3 text-xs text-white/70 sm:block"
    >
      <p className="mb-3 px-2 text-sm font-bold text-white">Bitrix24</p>
      {BITRIX_MENU.map(item => (
        <p
          key={item}
          className={`rounded-md px-2 py-1.5 ${item === active ? 'bg-white/15 font-semibold text-white' : ''}`}
        >
          {item}
        </p>
      ))}
    </nav>
  )
}

/** Itens do menu do app, na ordem e com os rótulos de `thinkzap/aside.json`. */
export const APP_MENU = [
  'Início',
  'Conexões',
  'Administração',
  'ThinkBot',
  'Logs',
  'Ajuda',
] as const
export type AppMenuItem = (typeof APP_MENU)[number]

const FLAGS = ['br', 'us', 'es'] as const

/**
 * Menu lateral do ThinkZap (`Aside` com `THINKZAP_ASIDE_CONFIG`), em escala menor:
 * no app ele tem 256px fixos, aqui divide a janela com a tela.
 */
export function AppAside({ active }: { active: AppMenuItem }) {
  return (
    <aside
      aria-hidden
      className="hidden w-48 shrink-0 flex-col border-r border-[#e5e7eb] bg-[#F9F9FB] px-3 pt-3 md:flex"
    >
      <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-2">
        <Image
          src="/images/thinkzap/logo.png"
          alt=""
          width={120}
          height={56}
          className="h-auto w-full"
        />
        <span className="text-[9px] font-medium leading-none text-[#6b7280]">
          Desenvolvido por CRMThink
        </span>
        <span className="flex gap-1.5">
          {FLAGS.map(code => (
            <Image
              key={code}
              src={`/images/i18n-icon/4x3/${code}.svg`}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-[2px]"
            />
          ))}
        </span>
      </div>
      <nav className="mt-2 flex flex-1 flex-col gap-1 text-[11px] text-black">
        {APP_MENU.map(item => (
          <span
            key={item}
            className={`rounded-lg px-2.5 py-2 ${item === active ? 'bg-[#d9fce6] font-bold' : ''}`}
          >
            {item}
          </span>
        ))}
      </nav>
      <div className="flex justify-center py-3">
        <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#3b82f6]">
          Versão Beta
        </span>
      </div>
    </aside>
  )
}

// ─── Peças ─────────────────────────────────────────────────────────────────

/** Diálogo do app (`Dialog` do shadcn) sobre um fundo esmaecido e inerte. */
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

/** Campo de formulário preenchido, inerte. */
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

/** `Select` fechado mostrando o valor escolhido. */
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
