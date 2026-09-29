import {
  Clock,
  Flag,
  Headset,
  ListChecks,
  MessageSquare,
  Split,
} from 'lucide-react'
import type { FlowNodeKind } from '@/shared/thinkzap-bot-flow'

/** Num só lugar: com tabelas duplicadas, o ícone do menu divergia do do bloco. */
export const KIND_ICON: Record<FlowNodeKind, typeof MessageSquare> = {
  message: MessageSquare,
  question: ListChecks,
  // `Split` e não `GitBranch`: aquele é ícone de versionamento, e o caminho que se abre
  // em dois é o que o bloco faz — mesma leitura que n8n e Make dão ao condicional.
  condition: Split,
  schedule: Clock,
  handoff: Headset,
  finish: Flag,
}

/** Só o traço colorido: cartão com fundo colorido virava mosaico em canvas grande. */
export const KIND_ICON_COLOR: Record<FlowNodeKind, string> = {
  message: 'text-sky-600',
  question: 'text-violet-600',
  condition: 'text-slate-600',
  schedule: 'text-amber-600',
  handoff: 'text-primary',
  finish: 'text-emerald-600',
}

export const KIND_ACCENT: Record<FlowNodeKind, string> = {
  message: 'bg-sky-100 text-sky-700',
  question: 'bg-violet-100 text-violet-700',
  condition: 'bg-slate-200 text-slate-700',
  schedule: 'bg-amber-100 text-amber-700',
  handoff: 'bg-primary/15 text-primary',
  finish: 'bg-emerald-100 text-emerald-700',
}
