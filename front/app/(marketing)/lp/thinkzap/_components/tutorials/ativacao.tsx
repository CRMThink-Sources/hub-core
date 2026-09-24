import type { AtivacaoScreen } from '../content'
import {
  ActiveLinesBadge,
  ConexoesPage,
  ConfigCard,
  LinesTable,
  LinhaPage,
  OFICIAL_HINT,
  ProviderOption,
  WEB_HINT,
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
const APP = { kind: 'app', path: APP_PATH, menu: 'Conexões' } as const

export const ATIVACAO_VIEW: TutorialView<AtivacaoScreen> = {
  frames: {
    trial: APP,
    contact: APP,
    lines: APP,
    qrcode: APP,
    connected: APP,
    channel: APP,
    chat: { kind: 'bitrix', path: 'online/', menu: 'Canais abertos' },
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

const DEVICE = 'Aparelho conectado: Joana Silva'

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

function TrialScreen({ action, onAdvance }: ScreenProps) {
  return (
    <ConexoesPage>
      <TrialInvite>
        <ProviderOption label="WhatsApp Web" hint={WEB_HINT}>
          <HotspotButton action={action} onAdvance={onAdvance} />
        </ProviderOption>
        <ProviderOption label="WhatsApp Oficial" hint={OFICIAL_HINT}>
          <PrimaryButton>Começar teste</PrimaryButton>
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
    <DialogOver
      background={
        <ConexoesPage>
          <TrialInvite />
        </ConexoesPage>
      }
    >
      <p className="text-base font-medium">Confirme seus dados de contato</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Usamos esses dados para falar com você durante o teste. Confira e
        corrija se precisar.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {CONTACT_FIELDS.map(([label, value]) => (
          <FakeField key={label} label={label} value={value} />
        ))}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OutlineButton>Cancelar</OutlineButton>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
    </DialogOver>
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
      <ActiveLinesBadge count="1/1" />
      <LinesTable
        rows={[
          {
            name: 'Linha 1',
            provider: 'web',
            subtitle: 'Período de teste',
            status: 'Ativo',
          },
        ]}
        hotspot={{ index: 0, action, onAdvance }}
      />
    </ConexoesPage>
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
          <Hotspot action={action} onAdvance={onAdvance} className="rounded-lg">
            <FakeQrCode />
          </Hotspot>
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
      device={DEVICE}
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
    <LinhaPage connected device={DEVICE} activeTab="Ajustes">
      <ConfigCard
        title="Canal aberto do Bitrix"
        description="É o vínculo que faz a mensagem chegar ao CRM."
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nenhum canal vinculado. Sem vínculo, a mensagem não chega ao CRM.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <FakeSelect value="Vendas" />
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

function ChatScreen(props: ScreenProps) {
  return (
    <OpenChannelChat
      {...props}
      chats={[
        { name: 'Maria Clara', detail: 'WhatsApp · Vendas' },
        { name: 'Rafael Souza', detail: 'WhatsApp · Vendas' },
      ]}
      title="Maria Clara"
      subtitle="WhatsApp · Canal Vendas · Contato no CRM"
      messages={[
        { from: 'in', text: 'Oi! Vi o anúncio de vocês. Tem horário amanhã?' },
      ]}
      reply="Temos sim, Maria! Às 10h ou às 15h?"
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
