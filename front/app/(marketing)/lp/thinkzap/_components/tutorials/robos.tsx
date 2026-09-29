import {
  Bot,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Database,
  History,
  Info,
  Plus,
  RefreshCcw,
  Rocket,
  ShoppingCart,
  SlidersHorizontal,
  SquareCheck,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { RobosScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  CrmBoard,
  DEAL_ID,
  DealCard,
  DealsHeader,
  GLASS_BUTTON,
  StageArrow,
  StageColumn,
  StageRow,
  STAGES,
} from './shared/crm'
import {
  Hotspot,
  HotspotButton,
  OutlineButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

/**
 * Tutorial "Robôs de automação". Os robôs são registrados na instalação
 * (`api/src/modules/thinkzap/install/thinkzap.installer.ts`) e configurados no
 * "Regras de automação" nativo do Bitrix24. O de mensagem livre usa o formulário
 * padrão do Bitrix com os parâmetros de `build-thinkzap-robot-add-params.ts`
 * ("Connector", "Destination", "Send to all related contacts", "Message"); o
 * nome em produção vem de `BITRIX_ROBOT_NAME` ("Enviar mensagem"), e o
 * Bitrix24 lista como "[ThinkZap] Enviar mensagem" na janela "Adicionar à
 * etapa". Visual das telas tirado de prints do portal.
 *
 * Mudou um robô ou um parâmetro, mude aqui também.
 */
const CRM: ScreenFrame = {
  kind: 'bitrix',
  path: 'crm/deal/kanban/',
  menu: 'crm',
}

export const ROBOS_VIEW: TutorialView<RobosScreen> = {
  frames: {
    kanban: CRM,
    stages: { ...CRM, path: 'crm/deal/automation/0/' },
    catalog: { ...CRM, path: 'crm/deal/automation/0/' },
    'robot-form': { ...CRM, path: 'crm/deal/automation/0/' },
    'catalog-template': { ...CRM, path: 'crm/deal/automation/0/' },
    'template-form': { ...CRM, path: 'crm/deal/automation/0/' },
    'move-deal': CRM,
    result: { ...CRM, path: `crm/deal/details/${DEAL_ID}/` },
    'result-template': { ...CRM, path: `crm/deal/details/${DEAL_ID}/` },
  },
  screens: {
    kanban: KanbanScreen,
    stages: StagesScreen,
    catalog: props => <CatalogScreen {...props} pick="message" />,
    'robot-form': RobotFormScreen,
    'catalog-template': props => <CatalogScreen {...props} pick="template" />,
    'template-form': TemplateFormScreen,
    'move-deal': MoveDealScreen,
    result: props => <ResultScreen {...props} robot="message" />,
    'result-template': props => <ResultScreen {...props} robot="template" />,
  },
}

/** Robôs do app, pela chave em `screens.robots` do texto. */
type RobotKey = 'message' | 'template'

const TARGET_STAGE = 'proposta'

// ─── Funil ─────────────────────────────────────────────────────────────────

function Board({ robots, deal }: { robots?: ScreenProps; deal?: ScreenProps }) {
  const { shared } = useLpContent()
  const { board } = useTutorialScreens('robos')
  const dealCard = <DealCard {...shared.deal} />
  const rules = (
    <>
      <Bot aria-hidden className="size-3.5" />
      {board.rules}
    </>
  )

  return (
    <CrmBoard>
      <DealsHeader>
        <span className={GLASS_BUTTON}>
          {board.extensions}
          <span className="h-4 w-px bg-white/30" />
          <ChevronDown aria-hidden className="size-3.5" />
        </span>
        {robots ? (
          <Hotspot {...robots} className={GLASS_BUTTON}>
            {rules}
          </Hotspot>
        ) : (
          <span className={GLASS_BUTTON}>{rules}</span>
        )}
      </DealsHeader>
      <StageRow>
        <StageColumn stage="novo">
          {deal ? (
            <Hotspot {...deal} className="block w-full rounded-md">
              {dealCard}
            </Hotspot>
          ) : (
            dealCard
          )}
          <DealCard {...board.otherDeals[0]} />
        </StageColumn>
        <StageColumn stage={TARGET_STAGE}>
          <DealCard {...board.otherDeals[1]} />
        </StageColumn>
        <StageColumn stage="negociacao" />
      </StageRow>
    </CrmBoard>
  )
}

function KanbanScreen(props: ScreenProps) {
  return <Board robots={props} />
}

function MoveDealScreen(props: ScreenProps) {
  return <Board deal={props} />
}

// ─── Regras de automação ───────────────────────────────────────────────────

/**
 * Regras de automação do funil: setas das etapas e, embaixo, a faixa
 * translúcida de robôs de cada etapa com o "+" para adicionar.
 */
function RobotStages({ add }: { add?: ScreenProps }) {
  const { stages } = useTutorialScreens('robos')

  return (
    <CrmBoard>
      <p className="text-lg font-semibold text-white">{stages.title}</p>
      <div className="overflow-x-auto">
        <div className="grid min-w-[420px] grid-cols-3 gap-1 border-y border-white/40 p-2">
          {STAGES.slice(0, 3).map(stage => (
            <StageArrow key={stage} stage={stage} />
          ))}
          {STAGES.slice(0, 3).map(stage =>
            stage === TARGET_STAGE && add ? (
              <Hotspot
                key={stage}
                {...add}
                className="m-1 flex h-8 items-center justify-center rounded bg-white/20 text-white hover:bg-white/30"
              >
                <Plus aria-hidden className="size-4" />
              </Hotspot>
            ) : (
              <span
                key={stage}
                className="m-1 flex h-8 items-center justify-center rounded bg-white/10 text-white/70"
              >
                <Plus aria-hidden className="size-4" />
              </span>
            ),
          )}
        </div>
      </div>
      <p className="text-xs text-white/70">{stages.hint}</p>
    </CrmBoard>
  )
}

function StagesScreen(props: ScreenProps) {
  return <RobotStages add={props} />
}

/** Painel lateral do Bitrix24 (slider) sobre as regras de automação. */
function Slider({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="relative h-full min-h-[inherit]">
      <div aria-hidden className="pointer-events-none opacity-40">
        <RobotStages />
      </div>
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#eef2f4] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-base font-semibold text-[#333]">{title}</p>
          <X aria-hidden className="size-4 text-[#828b95]" />
        </div>
        <div className="flex-1 overflow-hidden px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}

/** Grupos da janela "Adicionar", na ordem do Bitrix24. */
const GROUPS: {
  key: 'products' | 'tasks' | 'data' | 'workflow' | 'other'
  icon: LucideIcon
}[] = [
  { key: 'products', icon: ShoppingCart },
  { key: 'tasks', icon: SquareCheck },
  { key: 'data', icon: Database },
  { key: 'workflow', icon: RefreshCcw },
  { key: 'other', icon: Bot },
]

/**
 * Janela "Adicionar à etapa" que o "+" abre: grupos à esquerda e, à direita, as
 * regras que batem com a busca — aqui "thinkzap", que traz os robôs do app com o
 * nome entre colchetes. `pick` é o robô destacado.
 */
function CatalogScreen({
  action,
  onAdvance,
  pick,
}: ScreenProps & { pick: RobotKey }) {
  const { shared } = useLpContent()
  const { catalog, robots } = useTutorialScreens('robos')
  const add = (robot: RobotKey) =>
    robot === pick ? { action, onAdvance } : undefined
  return (
    <div className="relative h-full min-h-[inherit]">
      <div aria-hidden className="pointer-events-none">
        <RobotStages />
      </div>
      <div className="absolute inset-2 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <p className="text-base font-semibold text-[#333]">{catalog.title}</p>
          <span className="text-sm text-[#a8adb4]">{catalog.toStage}</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#dfe3e6] px-2 py-1 text-xs font-medium text-[#333]">
            <span className="size-2.5 rounded-sm bg-[#10e1f9]" />
            {shared.stages[TARGET_STAGE]}
            <ChevronDown aria-hidden className="size-3 text-[#a8adb4]" />
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex h-8 w-28 items-center justify-between rounded-full border border-[#2fc6f6] px-3 text-xs text-[#333] sm:w-36">
              {catalog.search}
              <X aria-hidden className="size-3 text-[#a8adb4]" />
            </span>
            <SlidersHorizontal
              aria-hidden
              className="hidden size-4 text-[#828b95] sm:block"
            />
            <X aria-hidden className="size-4 text-[#535c69]" />
          </span>
        </div>
        <div className="grid min-h-0 flex-1 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="hidden flex-col gap-2 bg-[#f5f7f8] p-3 text-[11px] text-[#333] sm:flex">
            <p className="flex items-center gap-1 font-semibold uppercase text-[#828b95]">
              {catalog.group}
              <Info aria-hidden className="size-3" />
            </p>
            <GroupCard icon={Rocket} label={catalog.newRules} />
            <GroupCard icon={History} label={catalog.recent} />
            <div className="divide-y divide-[#eef2f4] rounded-lg bg-white px-2">
              {GROUPS.map(group => (
                <GroupRow
                  key={group.key}
                  icon={group.icon}
                  label={catalog.groups[group.key]}
                />
              ))}
            </div>
            <GroupCard icon={Store} label={catalog.market} />
          </div>
          <div className="flex flex-col gap-3 bg-[#eef2f4] p-3">
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase text-[#828b95]">
              <span className="flex items-center gap-1">
                {catalog.rules}
                <Info aria-hidden className="size-3" />
              </span>
              <span className="font-normal normal-case text-[#828b95] underline decoration-dashed">
                {catalog.help}
              </span>
            </p>
            <div className="divide-y divide-[#eef2f4] rounded-lg bg-white">
              <RuleItem
                name={robots.template}
                description={catalog.templateDescription}
                addLabel={catalog.add}
                add={add('template')}
              />
              <RuleItem
                name={robots.message}
                addLabel={catalog.add}
                add={add('message')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupCard({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-lg bg-white px-2">
      <GroupRow icon={Icon} label={label} />
    </div>
  )
}

function GroupRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <p className="flex items-center gap-2 py-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[#2fc6f6] text-[#2fc6f6]">
        <Icon aria-hidden className="size-3" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      <ChevronRight aria-hidden className="size-3 shrink-0 text-[#a8adb4]" />
    </p>
  )
}

const ADD_BUTTON =
  'inline-flex h-7 shrink-0 items-center rounded-full border border-[#2fc6f6] px-3 text-xs font-medium text-[#333]'

function RuleItem({
  name,
  description,
  addLabel,
  add,
}: {
  name: string
  description?: string
  addLabel: string
  add?: ScreenProps
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#333]">{name}</p>
        {description && (
          <p className="mt-0.5 text-[11px] text-[#828b95]">{description}</p>
        )}
      </div>
      {add ? (
        <Hotspot {...add} className={`${ADD_BUTTON} bg-[#f0fbff]`}>
          {addLabel}
        </Hotspot>
      ) : (
        <span className={ADD_BUTTON}>{addLabel}</span>
      )}
    </div>
  )
}

/** Formulário padrão de robô do Bitrix24, com os parâmetros do app. */
function RobotFormScreen({ action, onAdvance }: ScreenProps) {
  const { shared } = useLpContent()
  const { robotForm, robots } = useTutorialScreens('robos')

  return (
    <Slider title={robots.message}>
      <div className="flex flex-col gap-3 rounded-lg bg-white p-3 text-sm">
        <BitrixField
          label={robotForm.connector}
          value={robotForm.connectorValue}
          select
        />
        <BitrixField
          label={robotForm.destination}
          value={robotForm.destinationValue}
        />
        <BitrixField
          label={robotForm.sendToAll}
          value={robotForm.sendToAllValue}
          select
        />
        <BitrixField
          label={robotForm.message}
          value={robotForm.messageValue}
          multiline
        />
        <p className="text-[11px] text-[#828b95]">
          {robotForm.runWhen(shared.stages[TARGET_STAGE])}
        </p>
        <div className="flex gap-2">
          <HotspotButton
            action={action}
            onAdvance={onAdvance}
            className="bg-[#bbed21] text-[#535c69] hover:bg-[#d2f95f]"
          />
          <OutlineButton>{robotForm.cancel}</OutlineButton>
        </div>
      </div>
    </Slider>
  )
}

/**
 * Tela própria do robô de template (`bitrix/bizproc/template/_components/
 * template-robot-form.tsx`), aberta dentro do diálogo do robô no Bitrix24.
 */
function TemplateFormScreen({ action, onAdvance }: ScreenProps) {
  const { templateForm: form, robots } = useTutorialScreens('robos')

  return (
    <Slider title={robots.template}>
      <div className="flex flex-col gap-3 rounded-lg bg-white p-3 text-sm text-slate-800">
        <TemplateField label={form.line}>
          <FormSelect value={form.lineValue} />
        </TemplateField>
        <TemplateField label={form.template}>
          <FormSelect value={form.templateValue} />
        </TemplateField>
        <div className="grid gap-2 rounded-xl border border-slate-200 p-2.5">
          <p className="flex items-start gap-2 text-xs">
            <span className="mt-px size-3.5 shrink-0 rounded-sm border border-slate-300" />
            <span>
              {form.sendToAll}
              <span className="mt-0.5 block text-[11px] text-amber-700">
                {form.sendToAllWarning}
              </span>
            </span>
          </p>
          <TemplateField label={form.destination}>
            <FieldChip label={form.destinationField} change={form.change} />
          </TemplateField>
        </div>
        <TemplateField label={form.variable}>
          <FieldChip label={form.variableField} change={form.change} />
        </TemplateField>
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5">
          <p className="text-[11px] font-medium text-blue-900">
            {form.preview}
          </p>
          <p className="mt-1 text-xs text-blue-950">{form.previewText}</p>
        </div>
        <div className="flex gap-2">
          <HotspotButton
            action={action}
            onAdvance={onAdvance}
            className="bg-[#bbed21] text-[#535c69] hover:bg-[#d2f95f]"
          />
          <OutlineButton>{form.cancel}</OutlineButton>
        </div>
      </div>
    </Slider>
  )
}

function TemplateField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium">{label}</p>
      {children}
    </div>
  )
}

function FormSelect({ value }: { value: string }) {
  return (
    <p className="flex justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
      <span className="truncate">{value}</span>
      <span aria-hidden className="text-slate-400">
        ▾
      </span>
    </p>
  )
}

/** Campo do CRM escolhido no `ValueField`, com o "Trocar". */
function FieldChip({ label, change }: { label: string; change: string }) {
  return (
    <p className="flex justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
      <span className="truncate">{label}</span>
      <span className="text-indigo-600">{change}</span>
    </p>
  )
}

function BitrixField({
  label,
  value,
  select = false,
  multiline = false,
}: {
  label: string
  value: string
  select?: boolean
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-[#828b95]">{label}</p>
      <p
        className={`flex justify-between gap-2 rounded border border-[#c6cdd3] px-2 py-1.5 text-[#333] ${multiline ? 'min-h-16 whitespace-pre-wrap' : 'truncate'}`}
      >
        <span className={multiline ? '' : 'truncate'}>{value}</span>
        {select && (
          <span aria-hidden className="text-[#828b95]">
            ▾
          </span>
        )}
      </p>
    </div>
  )
}

// ─── Resultado ─────────────────────────────────────────────────────────────

function ResultScreen({
  action,
  onAdvance,
  robot,
}: ScreenProps & { robot: RobotKey }) {
  const { shared } = useLpContent()
  const { result, robots } = useTutorialScreens('robos')
  const sent = result.sent[robot]

  return (
    <CrmBoard>
      <div>
        <p className="text-lg font-semibold text-white">{shared.deal.title}</p>
        <p className="text-xs text-white/70">
          {result.dealStage(DEAL_ID, shared.stages[TARGET_STAGE])}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-2 rounded-lg bg-white p-3 text-xs">
          <p className="font-semibold text-[#535c69]">{result.history}</p>
          <div className="border-l-2 border-primary pl-3">
            <p className="font-semibold text-[#333]">{result.sentTitle}</p>
            <p className="mt-1 text-[#535c69]">{sent}</p>
            <p className="mt-1 text-[#a8adb4]">
              {result.robotLine(robots[robot])}
            </p>
            <Hotspot
              action={action}
              onAdvance={onAdvance}
              className="mt-2 rounded px-1 text-xs font-semibold text-[#2067b0] hover:underline"
            >
              {result.openChat}
            </Hotspot>
          </div>
          <div className="border-l-2 border-[#c6cdd3] pl-3 text-[#828b95]">
            {result.stageChanged(
              shared.stages.novo,
              shared.stages[TARGET_STAGE],
            )}
          </div>
        </div>
        {/* Celular do cliente. */}
        <div
          aria-hidden
          className="mx-auto w-full max-w-[200px] rounded-3xl border-4 border-[#333] bg-[#efeae2] p-2"
        >
          <p className="rounded-t-2xl bg-[#075e54] px-3 py-2 text-xs font-semibold text-white">
            {result.store}
          </p>
          <p className="mt-3 flex items-end gap-1 rounded-lg rounded-tl-none bg-white p-2 text-[11px] text-[#111]">
            <span>{sent}</span>
            <CheckCheck className="size-3 shrink-0 text-sky-500" />
          </p>
        </div>
      </div>
    </CrmBoard>
  )
}
