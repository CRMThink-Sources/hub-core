import Image from 'next/image'
import { Check, InfoIcon, MoreHorizontal, Search } from 'lucide-react'
import type { WalkthroughScreen } from './content'

/**
 * Telas simuladas do passo a passo. Desenhadas em HTML — não são prints — mas
 * copiam a estrutura, as classes e os textos dos componentes reais, para o
 * visitante reconhecer o caminho quando for fazer de verdade:
 *
 * - instalação: `components/bitrix/install/install-form.tsx` + `terms-agreement.tsx`
 * - menu lateral: `components/layouts/shared/aside/aside.tsx` (config do thinkzap)
 * - conexões: `_layout/conexoes-layout.tsx`, `trial-card.tsx`,
 *   `trial-contact-dialog.tsx`, `conexoes-tabela-conectores.tsx`, `conexao-row.tsx`
 * - linha: `conexoes/[subscriptionItemId]/configuracoes/page.tsx`,
 *   `conexao-tab.tsx`, `ajustes-tab.tsx`, `config-card.tsx`
 *
 * Mudou uma dessas telas no app, mude aqui também.
 *
 * Cada tela recebe `action` (rótulo acessível do elemento destacado) e
 * `onAdvance`, e decide ela mesma qual elemento destacar — o botão, a linha da
 * tabela, a aba ou o QR code, como no app.
 */
export type ScreenProps = { action: string; onAdvance: () => void }

/**
 * Moldura de cada tela: portal do Bitrix24 (menu escuro), app ThinkZap aberto no
 * portal (menu lateral do app) ou tela cheia sem menu (instalação).
 */
export type ScreenFrame =
  | { kind: 'bitrix'; path: string; menu: BitrixMenuItem }
  | { kind: 'app'; path: string; menu: AppMenuItem }
  | { kind: 'bare'; path: string }

const APP_PATH = 'marketplace/app/thinkzap/'

export const SCREEN_FRAME: Record<WalkthroughScreen, ScreenFrame> = {
  market: { kind: 'bitrix', path: 'market/', menu: 'Market' },
  install: { kind: 'bare', path: APP_PATH },
  trial: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  contact: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  lines: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  qrcode: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  connected: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  channel: { kind: 'app', path: APP_PATH, menu: 'Conexões' },
  chat: { kind: 'bitrix', path: 'online/', menu: 'Canais abertos' },
}

export const SCREENS: Record<
  WalkthroughScreen,
  (props: ScreenProps) => React.ReactNode
> = {
  market: MarketScreen,
  install: InstallScreen,
  trial: TrialScreen,
  contact: ContactScreen,
  lines: LinesScreen,
  qrcode: QrCodeScreen,
  connected: ConnectedScreen,
  channel: ChannelScreen,
  chat: ChatScreen,
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

/** Botão primário do app (`Button` default do shadcn) com o destaque. */
function HotspotButton({
  action,
  onAdvance,
  children,
  className = '',
}: ScreenProps & { children?: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      data-hotspot
      aria-label={action}
      onClick={onAdvance}
      className={`inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 ${HOTSPOT_RING} ${className}`}
    >
      {children ?? action}
      <PingDot />
    </button>
  )
}

/** `Button` variant outline do app, inerte na simulação. */
function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border bg-background px-2.5 text-sm font-medium shadow-xs">
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

// ─── Telas do Bitrix24 ─────────────────────────────────────────────────────

function MarketScreen({ action, onAdvance }: ScreenProps) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="text-base font-semibold">Market</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <Search aria-hidden className="size-4 text-muted-foreground" />
        <span>ThinkZap</span>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-background p-4 sm:flex-row sm:items-center">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1.5">
          <Image
            src="/images/thinkzap/logo.png"
            alt=""
            width={90}
            height={42}
            className="h-auto w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ThinkZap</p>
          <p className="text-sm text-muted-foreground">
            WhatsApp Web e API oficial integrados ao Bitrix24
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Comunicação</p>
        </div>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

function ChatScreen({ action, onAdvance }: ScreenProps) {
  return (
    <div className="grid h-full min-h-[inherit] gap-3 p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-6">
      <div className="hidden space-y-1 rounded-xl border border-border bg-background p-2 sm:block">
        <div className="rounded-lg bg-accent px-2 py-2">
          <p className="truncate text-sm font-semibold">Maria Clara</p>
          <p className="truncate text-xs text-muted-foreground">
            WhatsApp · Vendas
          </p>
        </div>
        <div className="px-2 py-2">
          <p className="truncate text-sm text-muted-foreground">Rafael Souza</p>
          <p className="truncate text-xs text-muted-foreground">
            WhatsApp · Vendas
          </p>
        </div>
      </div>
      <div className="flex flex-col rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-2">
          <p className="text-sm font-semibold">Maria Clara</p>
          <p className="text-xs text-muted-foreground">
            WhatsApp · Canal Vendas · Contato no CRM
          </p>
        </div>
        <div className="flex-1 space-y-2 px-4 py-4 text-sm">
          <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
            Oi! Vi o anúncio de vocês. Tem horário amanhã?
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center">
          <p className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">
            Temos sim, Maria! Às 10h ou às 15h?
          </p>
          <HotspotButton
            action={action}
            onAdvance={onAdvance}
            className="self-end sm:self-auto"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Instalação (install-form) ─────────────────────────────────────────────

const TERMS = [
  'Termos de uso do Bitrix24 Market',
  'Contrato de licença (EULA)',
  'Política de privacidade',
]

function InstallScreen({ action, onAdvance }: ScreenProps) {
  return (
    <div className="flex h-full min-h-[inherit] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/50">
        <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-center text-white">
          <p className="text-lg font-bold tracking-tight">
            Instalação do aplicativo
          </p>
          <p className="mt-1 text-xs text-indigo-100">
            Preencha os dados e aceite os termos para concluir.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              E-mail de instalação (opcional)
            </p>
            <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-400">
              seu@empresa.com
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Termos e aceite
            </p>
            <div className="space-y-1 rounded-xl bg-slate-50/80 p-2">
              {TERMS.map(term => (
                <p
                  key={term}
                  className="flex gap-2 p-1.5 text-xs text-slate-600"
                >
                  <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded bg-indigo-600 text-white">
                    <Check aria-hidden className="size-3" />
                  </span>
                  <span>
                    Li e aceito{' '}
                    <span className="font-medium text-indigo-600 underline">
                      {term}
                    </span>
                    .
                  </span>
                </p>
              ))}
            </div>
          </div>
          <button
            type="button"
            data-hotspot
            aria-label={action}
            onClick={onAdvance}
            className={`w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 ${HOTSPOT_RING}`}
          >
            Concluir instalação
            <PingDot />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App ThinkZap: Conexões ────────────────────────────────────────────────

/** Casca da tela de conexões (`conexoes-layout`) com o cabeçalho real. */
function ConexoesPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-lg font-bold tracking-tight text-foreground">
          Configurações
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os números de WhatsApp conectados ao Bitrix24
        </p>
      </div>
      {children}
    </div>
  )
}

/** `ProviderOption` do `trial-card`. */
function ProviderOption({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function TrialInvite({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold text-foreground">
        Teste o ThinkZap por 3 dias
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha um tipo de conector para criar sua primeira linha. O teste é
        único por instalação e vale 3 dias.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">{children}</div>
    </div>
  )
}

const OFICIAL_HINT = 'Canal oficial da Meta, com número verificado e templates.'
const WEB_HINT =
  'Conecta lendo o QR code no seu celular. Mais rápido de começar.'

function TrialScreen({ action, onAdvance }: ScreenProps) {
  return (
    <ConexoesPage>
      <TrialInvite>
        <ProviderOption label="WhatsApp Web" hint={WEB_HINT}>
          <HotspotButton action={action} onAdvance={onAdvance} />
        </ProviderOption>
        <ProviderOption label="WhatsApp Oficial" hint={OFICIAL_HINT}>
          <span className="inline-flex h-9 w-fit items-center rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground">
            Começar teste
          </span>
        </ProviderOption>
      </TrialInvite>
    </ConexoesPage>
  )
}

const CONTACT_FIELDS = [
  ['Seu nome', 'Joana Silva'],
  ['E-mail', 'joana@empresa.com.br'],
  ['Telefone', '(11) 99999-8888'],
  ['Empresa', 'Acme LTDA'],
] as const

/** `trial-contact-dialog` sobre a tela de conexões esmaecida. */
function ContactScreen({ action, onAdvance }: ScreenProps) {
  return (
    <div className="relative h-full min-h-[inherit]">
      <div aria-hidden className="pointer-events-none opacity-40">
        <ConexoesPage>
          <TrialInvite />
        </ConexoesPage>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 p-4">
        <div className="w-full max-w-sm rounded-xl bg-background p-5 shadow-xl ring-1 ring-foreground/10">
          <p className="text-base font-medium">
            Confirme seus dados de contato
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usamos esses dados para falar com você durante o teste. Confira e
            corrija se precisar.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {CONTACT_FIELDS.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="h-8 truncate rounded-lg border border-input px-2.5 py-1 text-sm">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <OutlineButton>Cancelar</OutlineButton>
            <HotspotButton action={action} onAdvance={onAdvance} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LinesScreen({ action, onAdvance }: ScreenProps) {
  return (
    <ConexoesPage>
      <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <p className="text-sm font-medium">Teste em andamento</p>
        <p className="mt-1 text-sm">
          Seu período de teste vai até sexta-feira. Depois disso a linha
          continua visível, mas para de enviar e receber mensagens.
        </p>
      </div>
      <div className="inline-flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
        <InfoIcon aria-hidden className="size-4" />
        Linhas ativas: 1/1
      </div>
      <div className="w-full rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 rounded-t-xl border-b border-border bg-muted px-4 py-2.5">
          <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nome
          </span>
          <span className="flex flex-1 justify-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <span className="w-10" />
        </div>
        {/* A linha inteira é o botão, como no `conexao-row`. */}
        <button
          type="button"
          data-hotspot
          aria-label={action}
          onClick={onAdvance}
          className={`block w-full rounded-b-xl bg-accent/60 p-4 text-left transition-colors hover:bg-accent ${HOTSPOT_RING}`}
        >
          <span className="flex items-center justify-between gap-4">
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-base font-semibold text-foreground">
                  Linha 1
                </span>
                <ProviderBadge />
              </span>
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                Período de teste
              </span>
            </span>
            <span className="flex flex-1 justify-center">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Ativo
              </span>
            </span>
            <span className="inline-flex size-8 w-10 items-center justify-center rounded-md border border-border bg-background">
              <MoreHorizontal aria-hidden className="size-4" />
            </span>
          </span>
          <PingDot className="-left-1.5 -top-1.5" />
        </button>
      </div>
    </ConexoesPage>
  )
}

function ProviderBadge() {
  return (
    <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      WhatsApp Web
    </span>
  )
}

// ─── App ThinkZap: configuração da linha ───────────────────────────────────

type LineTab = 'Conexão' | 'Grupos' | 'Ajustes'

/**
 * Casca de `configuracoes/page.tsx`: voltar, título com selos e abas. `tabHotspot`
 * transforma uma aba no elemento destacado.
 */
function LinhaPage({
  connected,
  activeTab,
  tabHotspot,
  children,
}: {
  connected: boolean
  activeTab: LineTab
  tabHotspot?: ScreenProps & { tab: LineTab }
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <span className="w-fit text-sm text-primary">
          ← Voltar para conexões
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold tracking-tight text-foreground">
            Linha 1
          </p>
          <ProviderBadge />
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              connected
                ? 'bg-primary/10 text-primary'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {connected ? 'Conectada' : 'Desconectada'}
          </span>
        </div>
        {connected && (
          <p className="text-sm text-muted-foreground">
            Aparelho conectado: Joana Silva
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['Conexão', 'Grupos', 'Ajustes'] as const).map(tab => {
          const active = tab === activeTab
          const base = `relative rounded-t-lg px-3 py-2 text-sm ${
            active
              ? 'bg-card font-semibold text-primary'
              : 'font-medium text-muted-foreground'
          }`
          if (tabHotspot?.tab === tab) {
            return (
              <button
                key={tab}
                type="button"
                data-hotspot
                aria-label={tabHotspot.action}
                onClick={tabHotspot.onAdvance}
                className={`${base} hover:bg-accent hover:text-foreground ${HOTSPOT_RING}`}
              >
                {tab}
                <PingDot />
              </button>
            )
          }
          return (
            <span key={tab} className={base}>
              {tab}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </span>
          )
        })}
      </div>

      {children}
    </div>
  )
}

/** `ConfigCard`: moldura das seções da configuração. */
function ConfigCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="w-full rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="flex flex-col px-5 py-4">{children}</div>
    </section>
  )
}

function QrCodeScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage connected={false} activeTab="Conexão">
      <ConfigCard
        title="Conexão"
        description="Leia o QR code com o WhatsApp do número desta linha."
      >
        <div className="flex flex-col items-center gap-3">
          {/* O QR é o destaque: "ler" é clicar nele. */}
          <button
            type="button"
            data-hotspot
            aria-label={action}
            onClick={onAdvance}
            className={`rounded-lg ${HOTSPOT_RING}`}
          >
            <FakeQrCode />
            <PingDot />
          </button>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            No WhatsApp: Aparelhos conectados → Conectar um aparelho, e aponte
            para o código.
          </p>
          <OutlineButton>Atualizar QR code</OutlineButton>
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

const DEVICE_FIELDS = [
  ['Nome', 'Joana Silva'],
  ['Telefone', '+55 11 99999-8888'],
  ['Aparelho', 'iPhone'],
  ['Conta', 'Business'],
] as const

function ConnectedScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage
      connected
      activeTab="Conexão"
      tabHotspot={{ tab: 'Ajustes', action, onAdvance }}
    >
      <ConfigCard
        title="Conexão"
        description="Esta linha está conectada ao WhatsApp."
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-lg font-bold text-primary">
            JS
          </span>
          <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {DEVICE_FIELDS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Desconectar encerra a sessão do WhatsApp desta linha. A assinatura
            não é afetada.
          </p>
          <OutlineButton>Desconectar</OutlineButton>
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

function ChannelScreen({ action, onAdvance }: ScreenProps) {
  return (
    <LinhaPage connected activeTab="Ajustes">
      <ConfigCard
        title="Canal aberto do Bitrix"
        description="É o vínculo que faz a mensagem chegar ao CRM."
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nenhum canal vinculado. Sem vínculo, a mensagem não chega ao CRM.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-full max-w-60 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
              Vendas
              <span aria-hidden className="text-muted-foreground">
                ▾
              </span>
            </span>
            <HotspotButton action={action} onAdvance={onAdvance} />
          </div>
        </div>
      </ConfigCard>
      <ConfigCard title="Comportamento">
        <div className="flex flex-col gap-3 text-sm">
          <FakeToggle
            label="Prefixar nome do operador"
            hint="Inclui o nome de quem atende antes da mensagem enviada."
            on
          />
          <FakeToggle
            label="Enviar para canal aberto"
            hint="Vincule um canal aberto para habilitar."
          />
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

// ─── Peças ─────────────────────────────────────────────────────────────────

function FakeToggle({
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

function SkeletonCard() {
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

const QR_SIZE = 21

/**
 * Padrão com cara de QR code: três marcadores de canto e módulos pseudoaleatórios
 * de semente fixa (mesmo desenho no servidor e no cliente, sem mismatch de
 * hidratação). Não codifica nada — é ilustração.
 */
export function qrModules(size = QR_SIZE, seed = 7): boolean[][] {
  let state = seed
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const inFinder = (row: number, col: number) =>
    [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ].some(
      ([top, left]) =>
        row >= top && row < top + 7 && col >= left && col < left + 7,
    )
  const finderOn = (row: number, col: number) => {
    const r = row < 7 ? row : row - (size - 7)
    const c = col < 7 ? col : col - (size - 7)
    const ring = Math.min(r, c, 6 - r, 6 - c)
    return ring !== 1
  }

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) =>
      inFinder(row, col) ? finderOn(row, col) : random() > 0.55,
    ),
  )
}

/** Mesmo tamanho do QR real (`size-64`), menor em telas estreitas. */
function FakeQrCode() {
  const modules = qrModules()
  return (
    <svg
      aria-hidden
      viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`}
      className="block size-48 rounded-lg border border-border bg-white p-1 sm:size-56"
      shapeRendering="crispEdges"
    >
      {modules.flatMap((line, row) =>
        line.map((on, col) =>
          on ? (
            <rect
              key={`${row}-${col}`}
              x={col}
              y={row}
              width={1}
              height={1}
              fill="#1f2a26"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
