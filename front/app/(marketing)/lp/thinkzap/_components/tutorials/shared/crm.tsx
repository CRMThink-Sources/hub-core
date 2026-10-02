/**
 * Telas do CRM do Bitrix24 simplificadas: card de um negócio com abas e o funil
 * (kanban) de Negócios. Só o necessário para situar a tela — o Bitrix24 muda o
 * visual com frequência, então aqui vale a estrutura, não o pixel. Título,
 * contato e valor do negócio de exemplo ficam em `shared.deal` da copy.
 */

import {
  DEAL_TAB_IDS,
  STAGE_IDS,
  type DealTabId,
  type StageId,
} from '../../content'
import { useLpContent } from '../../content/locale-context'

export const DEAL_ID = 1042

/** Card do negócio com cabeçalho, etapas e a aba aberta. */
export function CrmDealPage({
  tab,
  children,
}: {
  tab: DealTabId
  children: React.ReactNode
}) {
  const { shared } = useLpContent()

  return (
    <div className="flex flex-col gap-3 bg-[#eef2f4] p-4 sm:p-5">
      <div>
        <p className="text-lg font-semibold text-[#333]">{shared.deal.title}</p>
        <p className="text-xs text-[#828b95]">
          {shared.dealLabel(DEAL_ID, shared.deal.value)}
        </p>
      </div>
      <div className="flex gap-0.5 overflow-hidden rounded-md text-[10px] font-medium text-white">
        {STAGE_IDS.map((stage, index) => (
          <span
            key={stage}
            className={`flex-1 truncate px-2 py-1 ${index <= 1 ? 'bg-[#2fc6f6]' : 'bg-[#c6cdd3]'}`}
          >
            {shared.stages[stage]}
          </span>
        ))}
      </div>
      <div className="flex gap-4 border-b border-[#dfe3e6] text-sm">
        {DEAL_TAB_IDS.map(item => (
          <span
            key={item}
            className={`pb-1.5 ${item === tab ? 'border-b-2 border-[#2fc6f6] font-semibold text-[#333]' : 'text-[#828b95]'}`}
          >
            {shared.dealTabs[item]}
          </span>
        ))}
      </div>
      <div className="rounded-lg bg-card p-4">{children}</div>
    </div>
  )
}

export const STAGES = STAGE_IDS
export type Stage = StageId

/** Cabeçalho da página de Negócios com a barra de ações sobre o papel de parede. */
export function DealsHeader({ children }: { children?: React.ReactNode }) {
  const { shared } = useLpContent()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-lg font-semibold text-white">{shared.dealsTitle}</p>
      <span className="h-8 min-w-24 flex-1 rounded-lg border border-white/20 bg-white/10 px-2 text-xs leading-8 text-white/60">
        {shared.filterSearch}
      </span>
      {children}
    </div>
  )
}

/** Botão translúcido da barra do Bitrix24 ("Extensões", "Regras de automação"). */
export const GLASS_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-medium text-white backdrop-blur-sm'

/**
 * Faixa da etapa em forma de seta, como no kanban e nas regras de automação do
 * Bitrix24.
 */
export function StageArrow({ stage }: { stage: Stage }) {
  const { stages } = useLpContent().shared
  const index = STAGES.indexOf(stage)
  return (
    <p
      className="truncate py-1.5 pl-4 pr-5 text-[11px] font-medium text-[#1f2a44]"
      style={{
        backgroundColor: STAGE_COLORS[index],
        clipPath:
          'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)',
      }}
    >
      {stages[stage]}
    </p>
  )
}

/** Coluna do kanban com a seta da etapa. */
export function StageColumn({
  stage,
  children,
}: {
  stage: Stage
  children?: React.ReactNode
}) {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-2 sm:w-auto sm:flex-1">
      <StageArrow stage={stage} />
      {children}
    </div>
  )
}

const STAGE_COLORS = ['#2fb8f6', '#10e1f9', '#3ff0c8', '#47e40f']

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

/** Papel de parede roxo padrão do Bitrix24 atrás do CRM. */
export function CrmBoard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[inherit] flex-col gap-4 bg-[linear-gradient(135deg,#1b1f6e_0%,#2a2a8c_45%,#4b39b6_100%)] p-4 sm:p-5">
      {children}
    </div>
  )
}

/** Rolagem horizontal do funil no celular. */
export function StageRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1 overflow-x-auto p-2">{children}</div>
}
