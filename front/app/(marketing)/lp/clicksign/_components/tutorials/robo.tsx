import { Bot, ChevronDown, Info, Plus, X } from 'lucide-react'
import { STAGE_IDS, type RoboScreen } from '../content'
import { useLpContent, useTutorialScreens } from '../content/locale-context'
import {
  CrmBoard,
  DealCard,
  DealsHeader,
  GLASS_BUTTON,
  StageArrow,
  StageColumn,
  StageRow,
  TARGET_STAGE,
} from './shared/crm'
import {
  Hotspot,
  HotspotButton,
  OutlineButton,
  type ScreenFrame,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

const CRM: ScreenFrame = {
  kind: 'bitrix',
  path: 'crm/deal/kanban/',
  menu: 'crm',
}
const AUTOMATION: ScreenFrame = { ...CRM, path: 'crm/deal/automation/0/' }

export const ROBO_VIEW: TutorialView<RoboScreen> = {
  frames: {
    kanban: CRM,
    stages: AUTOMATION,
    catalog: AUTOMATION,
    'robot-token': AUTOMATION,
    'robot-group': AUTOMATION,
    'robot-sequence': AUTOMATION,
    'robot-save': AUTOMATION,
    'move-deal': CRM,
  },
  screens: {
    kanban: props => <Board rules={props} />,
    stages: props => <RobotStages add={props} />,
    catalog: CatalogScreen,
    'robot-token': props => <RobotFormScreen {...props} target="token" />,
    'robot-group': props => <RobotFormScreen {...props} target="group" />,
    'robot-sequence': props => <RobotFormScreen {...props} target="sequence" />,
    'robot-save': props => <RobotFormScreen {...props} target="save" />,
    'move-deal': props => <Board deal={props} />,
  },
}

function Board({ rules, deal }: { rules?: ScreenProps; deal?: ScreenProps }) {
  const { sample } = useLpContent().shared
  const { board } = useTutorialScreens('robo')
  const dealCard = <DealCard {...sample.deal} />
  const rulesLabel = (
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
        {rules ? (
          <Hotspot {...rules} className={GLASS_BUTTON}>
            {rulesLabel}
          </Hotspot>
        ) : (
          <span className={GLASS_BUTTON}>{rulesLabel}</span>
        )}
      </DealsHeader>
      <StageRow>
        <StageColumn stage="proposta">
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
        <StageColumn stage="ganho" />
      </StageRow>
    </CrmBoard>
  )
}

const RULE_STAGES = STAGE_IDS.slice(1)

function RobotStages({ add }: { add?: ScreenProps }) {
  const { stages } = useTutorialScreens('robo')

  return (
    <CrmBoard>
      <p className="text-lg font-semibold text-white">{stages.title}</p>
      <div className="overflow-x-auto">
        <div className="grid min-w-105 grid-cols-3 gap-1 border-y border-white/40 p-2">
          {RULE_STAGES.map(stage => (
            <StageArrow key={stage} stage={stage} />
          ))}
          {RULE_STAGES.map(stage =>
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

const ADD_BUTTON =
  'inline-flex h-7 shrink-0 items-center rounded-full border border-[#2fc6f6] px-3 text-xs font-medium text-[#333]'

function CatalogScreen({ action, onAdvance }: ScreenProps) {
  const { crm } = useLpContent().shared
  const { catalog, robot } = useTutorialScreens('robo')

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
            <span className="size-2.5 rounded-sm bg-[#3ff0c8]" />
            {crm.stages[TARGET_STAGE]}
            <ChevronDown aria-hidden className="size-3 text-[#a8adb4]" />
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex h-8 w-28 items-center justify-between rounded-full border border-[#2fc6f6] px-3 text-xs text-[#333] sm:w-36">
              {catalog.search}
              <X aria-hidden className="size-3 text-[#a8adb4]" />
            </span>
            <X aria-hidden className="size-4 text-[#535c69]" />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 bg-[#eef2f4] p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-[#828b95]">
            {catalog.rules}
            <Info aria-hidden className="size-3" />
          </p>
          <div className="rounded-lg bg-white">
            <div className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#333]">{robot}</p>
                <p className="mt-0.5 text-[11px] text-[#828b95]">
                  {catalog.description}
                </p>
              </div>
              <Hotspot
                action={action}
                onAdvance={onAdvance}
                className={`${ADD_BUTTON} bg-[#f0fbff]`}
              >
                {catalog.add}
              </Hotspot>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type FormTarget = 'token' | 'group' | 'sequence' | 'save'

function RobotFormScreen({
  action,
  onAdvance,
  target,
}: ScreenProps & { target: FormTarget }) {
  const { crm, sample } = useLpContent().shared
  const { robotForm: form, robot } = useTutorialScreens('robo')
  const at = (field: FormTarget) =>
    field === target ? { action, onAdvance } : undefined

  return (
    <div className="relative h-full min-h-[inherit]">
      <div aria-hidden className="pointer-events-none opacity-40">
        <RobotStages />
      </div>
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#eef2f4] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-base font-semibold text-[#333]">{robot}</p>
          <X aria-hidden className="size-4 text-[#828b95]" />
        </div>
        <div className="flex-1 overflow-hidden px-4 pb-4">
          <div className="flex flex-col gap-3 rounded-lg bg-white p-3 text-sm">
            <BitrixSelect
              label={form.token}
              value={form.tokenValue}
              hotspot={at('token')}
            />
            <BitrixSelect
              label={form.group}
              value={sample.groupId}
              hotspot={at('group')}
            />
            <BitrixSelect
              label={form.sequence}
              value={form.sequenceValue}
              hotspot={at('sequence')}
            />
            <BitrixSelect label={form.refusable} value={form.refusableValue} />
            <BitrixSelect label={form.company} value={sample.companyName} />
            <p className="text-[11px] text-[#828b95]">
              {form.runWhen(crm.stages[TARGET_STAGE])}
            </p>
            <div className="flex gap-2">
              {target === 'save' ? (
                <HotspotButton
                  action={action}
                  onAdvance={onAdvance}
                  className="bg-[#bbed21] text-[#535c69] hover:bg-[#d2f95f]"
                >
                  {form.save}
                </HotspotButton>
              ) : (
                <span className="inline-flex h-9 items-center rounded-md bg-[#bbed21] px-2.5 text-sm font-medium text-[#535c69]">
                  {form.save}
                </span>
              )}
              <OutlineButton>{form.cancel}</OutlineButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BitrixSelect({
  label,
  value,
  hotspot,
}: {
  label: string
  value: string
  hotspot?: ScreenProps
}) {
  const shape =
    'flex w-full justify-between gap-2 rounded border border-[#c6cdd3] px-2 py-1.5 text-left text-[#333]'
  const content = (
    <>
      <span className="truncate">{value}</span>
      <span aria-hidden className="text-[#828b95]">
        ▾
      </span>
    </>
  )
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-[#828b95]">{label}</p>
      {hotspot ? (
        <Hotspot {...hotspot} className={shape}>
          {content}
        </Hotspot>
      ) : (
        <p className={shape}>{content}</p>
      )}
    </div>
  )
}
