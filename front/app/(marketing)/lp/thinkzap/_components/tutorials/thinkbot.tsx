import {
  ArrowLeft,
  Bot,
  Flag,
  Headset,
  LayoutGrid,
  Link2,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Split,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react'
import type { ThinkbotScreen } from '../content'
import { useTutorialScreens } from '../content/locale-context'
import type { ThinkbotCopy } from '../content/pt/tutorials/thinkbot'
import {
  APP_PATH,
  DialogOver,
  FakeField,
  FakeSelect,
  Hotspot,
  HotspotButton,
  OutlineButton,
  PrimaryButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'
import { OpenChannelChat } from './shared/open-channel-chat'

/**
 * Tutorial "ThinkBot". Espelha:
 * - lista: `_layout/bots-layout.tsx`, `bots/bot-flow-list.tsx`, `bots/canal-cell.tsx`
 * - criação: `bots/novo-fluxo-dialog.tsx` e o fluxo inicial de
 *   `api/src/modules/thinkzap/domain/bot-flow/empty-flow.ts`
 * - editor: `bots/bot-flow-editor.tsx`, `bots/canvas/flow-block.tsx`,
 *   `bots/canvas/kind-menu.tsx`, `bots/canvas/kind-visual.ts`, `bots/block-panel.tsx`
 * - simulador: `bots/bot-flow-simulator.tsx`
 * - textos: `messages/pt/thinkzap/bots/*.json`
 *
 * O canvas real é React Flow; aqui os blocos são desenhados em linha, só para
 * reconhecer o formato. Mudou uma dessas telas no app, mude aqui também.
 */
const APP: ScreenFrame = { kind: 'app', path: APP_PATH, menu: 'thinkbot' }

export const THINKBOT_VIEW: TutorialView<ThinkbotScreen> = {
  frames: {
    empty: APP,
    'new-flow': APP,
    editor: APP,
    'kind-menu': APP,
    'block-panel': APP,
    'simulator-start': APP,
    'simulator-chat': APP,
    publish: APP,
    bind: APP,
    'bot-chat': { kind: 'bitrix', path: 'online/', menu: 'openChannels' },
  },
  screens: {
    empty: EmptyScreen,
    'new-flow': NewFlowScreen,
    editor: EditorScreen,
    'kind-menu': KindMenuScreen,
    'block-panel': BlockPanelScreen,
    'simulator-start': SimulatorStartScreen,
    'simulator-chat': SimulatorChatScreen,
    publish: PublishScreen,
    bind: BindScreen,
    'bot-chat': BotChatScreen,
  },
}

type FlowCopy = ThinkbotCopy['screens']['flow']

/** A pergunta do menu com as opções numeradas, como o bot envia. */
function questionWithOptions(flow: FlowCopy) {
  const { support, finish } = flow.options
  return `${flow.question}\n1. ${support.label}\n2. ${finish.label}`
}

// ─── Lista ─────────────────────────────────────────────────────────────────

/** Casca de `bots-layout`: cabeçalho com ícone, título e subtítulo. */
function BotsPage({ children }: { children: React.ReactNode }) {
  const { list } = useTutorialScreens('thinkbot')
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bot aria-hidden className="size-6 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-foreground">
            {list.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{list.subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function EmptyList({ children }: { children?: React.ReactNode }) {
  const { list } = useTutorialScreens('thinkbot')
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-xl bg-muted">
        <Bot aria-hidden className="size-7 text-muted-foreground" />
      </span>
      <p className="text-sm font-semibold text-foreground">{list.emptyTitle}</p>
      {children}
    </div>
  )
}

function EmptyScreen({ action, onAdvance }: ScreenProps) {
  const { list } = useTutorialScreens('thinkbot')
  return (
    <BotsPage>
      <EmptyList>
        <HotspotButton action={action} onAdvance={onAdvance}>
          <Plus aria-hidden className="size-4" />
          {list.create}
        </HotspotButton>
      </EmptyList>
    </BotsPage>
  )
}

function NewFlowScreen({ action, onAdvance }: ScreenProps) {
  const { newFlow, flow } = useTutorialScreens('thinkbot')
  return (
    <DialogOver
      background={
        <BotsPage>
          <EmptyList />
        </BotsPage>
      }
    >
      <p className="text-base font-medium">{newFlow.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {newFlow.description}
      </p>
      <div className="mt-4">
        <FakeField label={newFlow.nameLabel} value={flow.name} />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OutlineButton>{newFlow.cancel}</OutlineButton>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
    </DialogOver>
  )
}

function BindScreen({ action, onAdvance }: ScreenProps) {
  const { bind, flow } = useTutorialScreens('thinkbot')
  return (
    <BotsPage>
      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
        {bind.inert(flow.name)}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-muted-foreground [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
              <th>{bind.columns.flow}</th>
              <th>{bind.columns.status}</th>
              <th>{bind.columns.servesOn}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className="[&>td]:px-4 [&>td]:py-3 [&>td]:align-middle">
              <td className="font-medium text-foreground">{flow.name}</td>
              <td>
                <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {bind.published}
                </span>
              </td>
              <td>
                <div className="flex items-center gap-2 py-1">
                  <FakeSelect
                    value={bind.channel}
                    className="h-8 w-32 text-xs"
                  />
                  <Hotspot
                    action={action}
                    onAdvance={onAdvance}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    <Link2 aria-hidden className="size-3" />
                    {bind.activate}
                  </Hotspot>
                </div>
              </td>
              <td>
                <span className="flex justify-end gap-1 text-muted-foreground">
                  <Pencil aria-hidden className="size-4" />
                  <Trash2 aria-hidden className="size-4 text-destructive" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BotsPage>
  )
}

// ─── Editor ────────────────────────────────────────────────────────────────

type EditorHotspot = ScreenProps & { target: 'simulador' | 'Publicar' }

/** Barra do `bot-flow-editor`, canvas e painel lateral (empilhado aqui). */
function EditorShell({
  saved = false,
  panel,
  hotspot,
  problem = false,
  children,
}: {
  saved?: boolean
  panel?: 'simulador' | 'bloco'
  hotspot?: EditorHotspot
  problem?: boolean
  children: React.ReactNode
}) {
  const { editor, flow } = useTutorialScreens('thinkbot')
  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground">
          <ArrowLeft aria-hidden className="size-4" />
        </span>
        <span className="flex h-8 items-center rounded-md border border-input px-2.5 text-sm font-medium">
          {flow.name}
        </span>
        {!saved && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {editor.unsaved}
          </span>
        )}
        <span className="flex gap-1.5">
          <SmallOutline>
            <Plus aria-hidden className="size-3.5" />
            {editor.newBlock}
          </SmallOutline>
          <SmallOutline>
            <LayoutGrid aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">{editor.rearrange}</span>
          </SmallOutline>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="flex gap-1 rounded-lg bg-muted p-1">
            {hotspot?.target === 'simulador' ? (
              <Hotspot
                action={hotspot.action}
                onAdvance={hotspot.onAdvance}
                className="rounded-md bg-background px-2 py-1 text-xs font-medium capitalize"
              >
                {editor.tabs.simulador}
              </Hotspot>
            ) : (
              <PanelToggle active={panel === 'simulador'}>
                {editor.tabs.simulador}
              </PanelToggle>
            )}
            <PanelToggle>{editor.tabs.ajustes}</PanelToggle>
          </span>
          <SmallOutline>
            <Save aria-hidden className="size-3.5" />
            {editor.save}
          </SmallOutline>
          {hotspot?.target === 'Publicar' ? (
            <HotspotButton
              action={hotspot.action}
              onAdvance={hotspot.onAdvance}
              className="h-8"
            >
              <Upload aria-hidden className="size-3.5" />
              {editor.publish}
            </HotspotButton>
          ) : (
            <PrimaryButton className="h-8">
              <Upload aria-hidden className="size-3.5" />
              {editor.publish}
            </PrimaryButton>
          )}
        </span>
      </div>
      {problem && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {editor.problem}
        </p>
      )}
      {children}
    </div>
  )
}

function SmallOutline({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-md border border-foreground/20 bg-background px-2 text-xs font-medium">
      {children}
    </span>
  )
}

function PanelToggle({
  active = false,
  children,
}: {
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
        active
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground'
      }`}
    >
      {children}
    </span>
  )
}

/** Fundo pontilhado do canvas com a legenda do app. */
function Canvas({ children }: { children: React.ReactNode }) {
  const { editor } = useTutorialScreens('thinkbot')
  return (
    <div className="rounded-xl border border-border bg-[radial-gradient(circle,_var(--color-border)_1px,_transparent_1px)] bg-[length:16px_16px] p-4">
      <div className="flex flex-wrap items-center gap-y-4">{children}</div>
      <p className="mt-4 text-[10px] text-muted-foreground">{editor.legend}</p>
    </div>
  )
}

const KIND = {
  message: { icon: MessageSquare, color: 'text-sky-600' },
  question: { icon: ListChecks, color: 'text-violet-600' },
  input: { icon: Type, color: 'text-amber-600' },
  condition: { icon: Split, color: 'text-slate-600' },
  handoff: { icon: Headset, color: 'text-primary' },
  finish: { icon: Flag, color: 'text-emerald-600' },
} as const

type Kind = keyof typeof KIND

/** Cartão do `flow-block`: ícone, nome e fala, centrados. */
function FlowBlock({
  kind,
  name,
  text,
  entry = false,
  selected = false,
}: {
  kind: Kind
  name: string
  text: string
  entry?: boolean
  selected?: boolean
}) {
  const { editor } = useTutorialScreens('thinkbot')
  const { icon: Icon, color } = KIND[kind]
  return (
    <span
      className={`relative flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2.5 pt-3 text-center shadow-xs ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      {entry && (
        <span className="absolute left-2 top-1.5 rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase text-primary">
          {editor.entry}
        </span>
      )}
      <span className="flex size-7 items-center justify-center rounded-xl bg-muted/60">
        <Icon aria-hidden className={`size-3.5 ${color}`} />
      </span>
      <span className="line-clamp-1 w-full text-[11px] font-semibold leading-tight">
        {name}
      </span>
      <span className="line-clamp-2 w-full text-[9px] leading-snug text-muted-foreground">
        {text}
      </span>
    </span>
  )
}

function Edge() {
  return <span aria-hidden className="h-0.5 w-6 shrink-0 bg-primary/60" />
}

/** Bolinha âmbar da saída sem destino, com o `+` ao lado. */
function PendingPort({ hotspot }: { hotspot?: ScreenProps }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="-ml-1.5 size-3 rounded-full bg-amber-500" />
      {hotspot ? (
        <Hotspot
          action={hotspot.action}
          onAdvance={hotspot.onAdvance}
          className="flex size-6 items-center justify-center rounded-md border border-dashed border-primary/60 bg-card text-primary hover:border-solid hover:bg-primary hover:text-primary-foreground"
        >
          <Plus aria-hidden className="size-3.5" />
        </Hotspot>
      ) : (
        <span className="flex size-6 items-center justify-center rounded-md border border-dashed border-primary/60 bg-card text-primary">
          <Plus aria-hidden className="size-3.5" />
        </span>
      )}
    </span>
  )
}

function WelcomeBlock() {
  const { flow } = useTutorialScreens('thinkbot')
  return (
    <FlowBlock
      kind="message"
      name={flow.blocks.welcome}
      text={flow.welcome}
      entry
    />
  )
}

/** Fluxo montado: boas-vindas → pergunta → transferir / encerrar. */
function FullFlow({ selected = false }: { selected?: boolean }) {
  const { flow } = useTutorialScreens('thinkbot')
  return (
    <>
      <WelcomeBlock />
      <Edge />
      <FlowBlock
        kind="question"
        name={flow.blocks.menu}
        text={flow.question}
        selected={selected}
      />
      <Edge />
      <span className="flex flex-col gap-2">
        <FlowBlock
          kind="handoff"
          name={flow.blocks.agent}
          text={flow.blocks.agentText}
        />
        <FlowBlock
          kind="finish"
          name={flow.blocks.bye}
          text={flow.blocks.byeText}
        />
      </span>
    </>
  )
}

function EditorScreen({ action, onAdvance }: ScreenProps) {
  return (
    <EditorShell problem>
      <Canvas>
        <WelcomeBlock />
        <PendingPort hotspot={{ action, onAdvance }} />
      </Canvas>
    </EditorShell>
  )
}

const KIND_GROUPS: { id: 'conversa' | 'acoes'; kinds: Kind[] }[] = [
  { id: 'conversa', kinds: ['message', 'question', 'input'] },
  { id: 'acoes', kinds: ['condition', 'handoff', 'finish'] },
]

function KindMenuScreen({ action, onAdvance }: ScreenProps) {
  const { kindMenu, kinds } = useTutorialScreens('thinkbot')
  return (
    <EditorShell problem>
      <Canvas>
        <WelcomeBlock />
        <PendingPort />
        {/* `kind-menu`: grade de dois por grupo e a coluna de prontos. */}
        <span className="ml-3 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <span className="flex items-center gap-2 px-3 pb-1 pt-2.5">
            <span className="flex-1 text-[12px] font-semibold text-foreground">
              {kindMenu.title}
            </span>
            <X aria-hidden className="size-3.5 text-muted-foreground" />
          </span>
          <span className="block px-2 pb-2.5">
            {KIND_GROUPS.map(group => (
              <span key={group.id} className="block">
                <span className="block px-1 pb-1.5 pt-2 text-[10px] font-medium text-primary">
                  {kindMenu.groups[group.id]}
                </span>
                <span className="grid grid-cols-2 gap-1.5">
                  {group.kinds.map(kind => {
                    const { icon: Icon, color } = KIND[kind]
                    const chip =
                      'flex items-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-left text-[11px]'
                    const content = (
                      <>
                        <Icon
                          aria-hidden
                          className={`size-3.5 shrink-0 ${color}`}
                        />
                        <span className="truncate">{kinds[kind]}</span>
                      </>
                    )
                    return kind === 'question' ? (
                      <Hotspot
                        key={kind}
                        action={action}
                        onAdvance={onAdvance}
                        className={`${chip} bg-primary/5`}
                      >
                        {content}
                      </Hotspot>
                    ) : (
                      <span key={kind} className={chip}>
                        {content}
                      </span>
                    )
                  })}
                </span>
              </span>
            ))}
            <span className="block px-1 pb-1.5 pt-2 text-[10px] font-medium text-primary">
              {kindMenu.ready}
            </span>
            <span className="flex flex-col gap-1.5">
              {kindMenu.recipes.map(recipe => (
                <span
                  key={recipe}
                  className="flex items-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-[11px]"
                >
                  <Split
                    aria-hidden
                    className="size-3.5 shrink-0 text-slate-600"
                  />
                  {recipe}
                </span>
              ))}
            </span>
          </span>
        </span>
      </Canvas>
    </EditorShell>
  )
}

function BlockPanelScreen({ action, onAdvance }: ScreenProps) {
  const { blockPanel, flow, kinds } = useTutorialScreens('thinkbot')
  const options = [
    { ...flow.options.support, target: flow.blocks.agent },
    { ...flow.options.finish, target: flow.blocks.bye },
  ]
  return (
    <EditorShell
      panel="bloco"
      hotspot={{ target: 'simulador', action, onAdvance }}
    >
      <Canvas>
        <FullFlow selected />
      </Canvas>
      {/* `block-panel` da Pergunta. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks aria-hidden className="size-4 text-violet-600" />
          {kinds.question}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FakeField label={blockPanel.blockName} value={flow.blocks.menu} />
          <FakeField label={blockPanel.questionLabel} value={flow.question} />
        </div>
        <p className="text-sm font-medium">{blockPanel.options}</p>
        <div className="flex flex-col gap-2">
          {options.map(option => (
            <div
              key={option.label}
              className="grid gap-2 rounded-lg border border-border p-2.5 text-xs sm:grid-cols-3"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-muted-foreground">
                {blockPanel.keywords} {option.keywords}
              </span>
              <span>
                {blockPanel.leadsTo} <strong>{option.target}</strong>
              </span>
            </div>
          ))}
          <span className="w-fit text-xs font-medium text-primary">
            {blockPanel.addOption}
          </span>
        </div>
      </div>
    </EditorShell>
  )
}

// ─── Simulador ─────────────────────────────────────────────────────────────

type Bubble = { from: 'cliente' | 'bot' | 'sistema'; text: string }

/** O começo da conversa: boas-vindas e a pergunta com as opções. */
function conversation(flow: FlowCopy): Bubble[] {
  return [
    { from: 'bot', text: flow.welcome },
    { from: 'bot', text: questionWithOptions(flow) },
  ]
}

/** `bot-flow-simulator`: bolhas e caixa de resposta. */
function Simulator({
  bubbles,
  typed = '',
  start,
  send,
}: {
  bubbles: Bubble[]
  typed?: string
  start?: ScreenProps
  send?: ScreenProps
}) {
  const { simulator } = useTutorialScreens('thinkbot')
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <p className="text-sm font-semibold text-foreground">
          {simulator.title}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {simulator.notice}
        </span>
        <span className="ml-auto flex gap-2 text-muted-foreground">
          <RotateCcw aria-hidden className="size-4" />
          <X aria-hidden className="size-4" />
        </span>
      </div>
      <div className="flex min-h-44 flex-col gap-2 rounded-lg bg-muted/40 p-3">
        {bubbles.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="max-w-56 text-xs text-muted-foreground">
              {simulator.empty}
            </p>
            {start && (
              <HotspotButton {...start} className="h-8 text-xs">
                {simulator.start}
              </HotspotButton>
            )}
          </div>
        ) : (
          bubbles.map((bubble, index) => (
            <p
              key={index}
              className={
                bubble.from === 'cliente'
                  ? 'max-w-[85%] self-end whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground'
                  : bubble.from === 'bot'
                    ? 'max-w-[85%] self-start whitespace-pre-wrap rounded-lg rounded-bl-sm bg-background px-3 py-2 text-xs text-foreground shadow-xs'
                    : 'inline-flex items-center gap-1 self-center rounded-full bg-foreground/5 px-3 py-1 text-[11px] text-muted-foreground'
              }
            >
              {bubble.from === 'sistema' && (
                <Headset aria-hidden className="size-3" />
              )}
              {bubble.text}
            </p>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <p
          className={`flex h-9 flex-1 items-center rounded-lg border border-input px-2.5 text-xs ${typed ? '' : 'text-muted-foreground'}`}
        >
          {typed || simulator.placeholder}
        </p>
        {send ? (
          <Hotspot
            {...send}
            className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Send aria-hidden className="size-3.5" />
          </Hotspot>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/50 text-primary-foreground">
            <Send aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  )
}

function SimulatorStartScreen(props: ScreenProps) {
  return (
    <EditorShell panel="simulador">
      <Canvas>
        <FullFlow />
      </Canvas>
      <Simulator bubbles={[]} start={props} />
    </EditorShell>
  )
}

function SimulatorChatScreen(props: ScreenProps) {
  const { flow } = useTutorialScreens('thinkbot')
  return (
    <EditorShell panel="simulador">
      <Canvas>
        <FullFlow />
      </Canvas>
      <Simulator
        bubbles={conversation(flow)}
        typed={flow.options.support.label}
        send={props}
      />
    </EditorShell>
  )
}

function PublishScreen({ action, onAdvance }: ScreenProps) {
  const { flow } = useTutorialScreens('thinkbot')
  return (
    <EditorShell
      panel="simulador"
      saved
      hotspot={{ target: 'Publicar', action, onAdvance }}
    >
      <Canvas>
        <FullFlow />
      </Canvas>
      <Simulator
        bubbles={[
          ...conversation(flow),
          { from: 'cliente', text: flow.options.support.label },
          { from: 'sistema', text: flow.handoff },
        ]}
      />
    </EditorShell>
  )
}

// ─── Chat do canal aberto ──────────────────────────────────────────────────

function BotChatScreen(props: ScreenProps) {
  const { botChat, flow } = useTutorialScreens('thinkbot')
  return (
    <OpenChannelChat
      {...props}
      chats={botChat.chats}
      title={botChat.title}
      subtitle={botChat.subtitle}
      messages={[
        { from: 'in', text: botChat.incoming },
        { from: 'bot', text: flow.welcome },
        { from: 'bot', text: questionWithOptions(flow) },
        { from: 'in', text: flow.options.support.label },
        { from: 'system', text: flow.handoff },
      ]}
      reply={botChat.reply}
    />
  )
}
