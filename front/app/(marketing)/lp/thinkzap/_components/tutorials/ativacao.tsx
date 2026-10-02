import type { AtivacaoScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  ActiveLinesBadge,
  ConexoesPage,
  ConfigCard,
  LinesTable,
  LinhaPage,
  ProviderOption,
} from './shared/app-pages'
import {
  APP_PATH,
  DialogOver,
  FakeField,
  FakeSelect,
  FakeToggle,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'
import { OpenChannelChat } from './shared/open-channel-chat'

/**
 * Tutorial "Ativação". Espelha:
 * - conexões: `trial-card.tsx`, `trial-contact-dialog.tsx`,
 *   `conexoes-tabela-conectores.tsx`, `conexao-row.tsx`
 * - linha: `conexoes/[subscriptionItemId]/configuracoes/page.tsx`,
 *   `conexao-tab.tsx`, `ajustes-tab.tsx`, `config-card.tsx`
 *
 * Mudou uma dessas telas no app, mude aqui também.
 */
const APP = { kind: 'app', path: APP_PATH, menu: 'conexoes' } as const

export const ATIVACAO_VIEW: TutorialView<AtivacaoScreen> = {
  frames: {
    trial: APP,
    contact: APP,
    lines: APP,
    qrcode: APP,
    connected: APP,
    channel: APP,
    chat: { kind: 'bitrix', path: 'online/', menu: 'openChannels' },
  },
  screens: {
    trial: TrialScreen,
    contact: ContactScreen,
    lines: LinesScreen,
    qrcode: QrCodeScreen,
    connected: ConnectedScreen,
    channel: ChannelScreen,
    chat: ChatScreen,
  },
}

function TrialInvite({ children }: { children?: React.ReactNode }) {
  const { trial } = useTutorialScreens('ativacao')

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5">
      <p className="text-base font-semibold text-foreground">{trial.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{trial.description}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">{children}</div>
    </div>
  )
}

function TrialScreen({ action, onAdvance }: ScreenProps) {
  const { shared } = useLpContent()
  const { trial } = useTutorialScreens('ativacao')

  return (
    <ConexoesPage>
      <TrialInvite>
        <ProviderOption label={shared.providerLabel.web} hint={shared.webHint}>
          <HotspotButton action={action} onAdvance={onAdvance} />
        </ProviderOption>
        <ProviderOption label={trial.oficialLabel} hint={shared.oficialHint}>
          <PrimaryButton>{trial.start}</PrimaryButton>
        </ProviderOption>
      </TrialInvite>
    </ConexoesPage>
  )
}

/** `trial-contact-dialog` sobre a tela de conexões esmaecida. */
function ContactScreen({ action, onAdvance }: ScreenProps) {
  const { contact } = useTutorialScreens('ativacao')

  return (
    <DialogOver
      background={
        <ConexoesPage>
          <TrialInvite />
        </ConexoesPage>
      }
    >
      <p className="text-base font-medium">{contact.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {contact.description}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {contact.fields.map(({ label, value }) => (
          <FakeField key={label} label={label} value={value} />
        ))}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OutlineButton>{contact.cancel}</OutlineButton>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
    </DialogOver>
  )
}

function LinesScreen({ action, onAdvance }: ScreenProps) {
  const { shared } = useLpContent()
  const { lines } = useTutorialScreens('ativacao')

  return (
    <ConexoesPage>
      <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <p className="text-sm font-medium">{lines.trialTitle}</p>
        <p className="mt-1 text-sm">{lines.trialDescription}</p>
      </div>
      <ActiveLinesBadge count="1/1" />
      <LinesTable
        rows={[
          {
            name: shared.defaultLineName,
            provider: 'web',
            subtitle: lines.rowSubtitle,
            status: lines.rowStatus,
          },
        ]}
        hotspot={{ index: 0, action, onAdvance }}
      />
    </ConexoesPage>
  )
}

function QrCodeScreen({ action, onAdvance }: ScreenProps) {
  const { line, qrcode } = useTutorialScreens('ativacao')

  return (
    <LinhaPage connected={false} activeTab="conexao">
      <ConfigCard title={line.connectionTitle} description={qrcode.description}>
        <div className="flex flex-col items-center gap-3">
          {/* O QR é o destaque: "ler" é clicar nele. */}
          <Hotspot action={action} onAdvance={onAdvance} className="rounded-lg">
            <FakeQrCode />
          </Hotspot>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {qrcode.instruction}
          </p>
          <OutlineButton>{qrcode.refresh}</OutlineButton>
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

function ConnectedScreen({ action, onAdvance }: ScreenProps) {
  const { line, connected } = useTutorialScreens('ativacao')

  return (
    <LinhaPage
      connected
      device={line.device}
      activeTab="conexao"
      tabHotspot={{ tab: 'ajustes', action, onAdvance }}
    >
      <ConfigCard
        title={line.connectionTitle}
        description={connected.description}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-lg font-bold text-primary">
            {connected.initials}
          </span>
          <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {connected.fields.map(({ label, value }) => (
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
            {connected.disconnectHint}
          </p>
          <OutlineButton>{connected.disconnect}</OutlineButton>
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

function ChannelScreen({ action, onAdvance }: ScreenProps) {
  const { line, channel } = useTutorialScreens('ativacao')

  return (
    <LinhaPage connected device={line.device} activeTab="ajustes">
      <ConfigCard title={channel.title} description={channel.description}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{channel.empty}</p>
          <div className="flex flex-wrap items-center gap-3">
            <FakeSelect value={channel.selected} />
            <HotspotButton action={action} onAdvance={onAdvance} />
          </div>
        </div>
      </ConfigCard>
      <ConfigCard title={channel.behaviorTitle}>
        <div className="flex flex-col gap-3 text-sm">
          <FakeToggle
            label={channel.prefixLabel}
            hint={channel.prefixHint}
            on
          />
          <FakeToggle
            label={channel.openChannelLabel}
            hint={channel.openChannelHint}
          />
        </div>
      </ConfigCard>
    </LinhaPage>
  )
}

function ChatScreen(props: ScreenProps) {
  const { chat } = useTutorialScreens('ativacao')

  return (
    <OpenChannelChat
      {...props}
      chats={chat.chats}
      title={chat.title}
      subtitle={chat.subtitle}
      messages={[{ from: 'in', text: chat.incoming }]}
      reply={chat.reply}
    />
  )
}

// ─── QR code ───────────────────────────────────────────────────────────────

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
