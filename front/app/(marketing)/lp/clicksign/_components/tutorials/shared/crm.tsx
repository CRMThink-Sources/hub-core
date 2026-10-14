// Não importa o crm.tsx do ThinkZap (textos de outra copy); vale a estrutura, não o pixel.

import {
  DEAL_FIELD_IDS,
  STAGE_IDS,
  type DealFieldId,
  type StageId,
} from '../../content'
import { useLpContent } from '../../content/locale-context'

export const DEAL_ID = 1042

export const TARGET_STAGE: StageId = 'contrato'

export function CrmBoard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[inherit] flex-col gap-4 bg-[linear-gradient(135deg,#1b1f6e_0%,#2a2a8c_45%,#4b39b6_100%)] p-4 sm:p-5">
      {children}
    </div>
  )
}

export function DealsHeader({ children }: { children?: React.ReactNode }) {
  const { crm } = useLpContent().shared

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-lg font-semibold text-white">{crm.dealsTitle}</p>
      <span className="h-8 min-w-24 flex-1 rounded-lg border border-white/20 bg-white/10 px-2 text-xs leading-8 text-white/60">
        {crm.filterSearch}
      </span>
      {children}
    </div>
  )
}

export const GLASS_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-medium text-white backdrop-blur-sm'

const STAGE_COLORS = ['#2fb8f6', '#10e1f9', '#3ff0c8', '#47e40f']

export function StageArrow({ stage }: { stage: StageId }) {
  const { stages } = useLpContent().shared.crm
  return (
    <p
      className="truncate py-1.5 pl-4 pr-5 text-[11px] font-medium text-[#1f2a44]"
      style={{
        backgroundColor: STAGE_COLORS[STAGE_IDS.indexOf(stage)],
        clipPath:
          'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)',
      }}
    >
      {stages[stage]}
    </p>
  )
}

export function StageColumn({
  stage,
  children,
}: {
  stage: StageId
  children?: React.ReactNode
}) {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-2 sm:w-auto sm:flex-1">
      <StageArrow stage={stage} />
      {children}
    </div>
  )
}

export function DealCard({
  title,
  contact,
  value,
}: {
  title: string
  contact: string
  value: string
}) {
  return (
    <span className="block rounded-md border-l-2 border-[#2fc6f6] bg-white p-2 text-left text-xs shadow-xs">
      <span className="block truncate font-semibold text-[#2067b0]">
        {title}
      </span>
      <span className="block truncate text-[#828b95]">{contact}</span>
      <span className="block font-medium text-[#333]">{value}</span>
    </span>
  )
}

export function StageRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1 overflow-x-auto p-2">{children}</div>
}

export function CrmDealPage({
  fields = {},
  highlight,
  children,
}: {
  fields?: Partial<Record<DealFieldId, string>>
  highlight?: { field: DealFieldId; node: React.ReactNode }
  children: React.ReactNode
}) {
  const { shared } = useLpContent()
  const { crm, assinatura, sample } = shared
  const stageIndex = STAGE_IDS.indexOf(TARGET_STAGE)

  return (
    <div className="flex flex-col gap-3 bg-[#eef2f4] p-4 sm:p-5">
      <div>
        <p className="text-lg font-semibold text-[#333]">{sample.deal.title}</p>
        <p className="text-xs text-[#828b95]">
          {crm.dealLabel(DEAL_ID, sample.deal.value)}
        </p>
      </div>
      <div className="flex gap-0.5 overflow-hidden rounded-md text-[10px] font-medium text-white">
        {STAGE_IDS.map((stage, index) => (
          <span
            key={stage}
            className={`flex-1 truncate px-2 py-1 ${index <= stageIndex ? 'bg-[#2fc6f6]' : 'bg-[#c6cdd3]'}`}
          >
            {crm.stages[stage]}
          </span>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg bg-white p-3 text-xs">
          <p className="mb-2 font-semibold uppercase text-[#828b95]">
            {crm.about}
          </p>
          <dl className="flex flex-col gap-2">
            {DEAL_FIELD_IDS.map(id => (
              <div key={id} className="min-w-0">
                <dt className="text-[#828b95]">
                  {assinatura.fields[id].label}
                </dt>
                <dd className="truncate text-[#333]">
                  {highlight?.field === id ? (
                    highlight.node
                  ) : fields[id] ? (
                    fields[id]
                  ) : (
                    <span className="text-[#a8adb4]">{crm.empty}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-[#828b95]">
            {crm.timeline}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
