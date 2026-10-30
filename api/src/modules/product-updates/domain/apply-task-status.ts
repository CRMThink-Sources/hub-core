import type { ProductUpdate } from './entities/product-update'

/**
 * Status de tarefa do Bitrix que a regra distingue. Os demais (1 nova, 2 pendente,
 * 3 em andamento, 6 adiada, 7 recusada) contam todos como "não concluída".
 */
export const CRMTHINK_TASK_STATUS = {
  /** "Aguardando controle": concluída pelo responsável, falta a aprovação do criador. */
  AWAITING_CONTROL: 4,
  /** "Concluída", já aprovada. */
  COMPLETED: 5,
} as const

/** O que a regra precisa da tarefa — sempre o estado atual lido do Bitrix. */
export type CrmthinkTaskSnapshot = {
  id: number
  title: string
  status: number
  groupId: number | null
}

export type TaskStatusPatch = Pick<
  ProductUpdate,
  | 'progress'
  | 'doneAt'
  | 'completedBy'
  | 'bitrixTaskId'
  | 'bitrixTaskTitle'
  | 'bitrixTaskStatus'
  | 'bitrixTaskGroupId'
  | 'bitrixTaskSyncedAt'
>

export type ApplyTaskStatusOptions = {
  now: Date
  /**
   * Usuário do portal que concluiu, quando a conclusão parte do backoffice ("Marcar
   * como concluída"). Ausente = veio da tarefa (webhook, reconciliação, vínculo).
   */
  completedBy?: string | null
}

/**
 * Regra de conclusão pela tarefa vinculada (D3) — a única, usada pelo vínculo, pelo
 * worker do webhook, pela reconciliação e por "Marcar como concluída":
 *
 * - **disponível** (`availableAt` preenchido): a tarefa não muda mais a novidade, só o
 *   cache do status;
 * - **5 (concluída)**: `DONE`;
 * - **4 (aguardando controle)**: mantém a conclusão como está — a tela mostra
 *   "aguardando aprovação no Bitrix";
 * - **qualquer outro**: volta para `PENDING`.
 *
 * Pura e idempotente: aplicar de novo com o mesmo status devolve o mesmo patch
 * (a conclusão já existente mantém `doneAt` e `completedBy`). Nunca toca a
 * visibilidade — concluir não publica.
 */
export function applyTaskStatus(
  update: Pick<
    ProductUpdate,
    'progress' | 'doneAt' | 'completedBy' | 'availableAt'
  >,
  task: CrmthinkTaskSnapshot,
  options: ApplyTaskStatusOptions,
): TaskStatusPatch {
  const cache = {
    bitrixTaskId: task.id,
    bitrixTaskTitle: task.title,
    bitrixTaskStatus: task.status,
    bitrixTaskGroupId: task.groupId,
    bitrixTaskSyncedAt: options.now,
  }
  const unchanged = {
    progress: update.progress,
    doneAt: update.doneAt,
    completedBy: update.completedBy,
  }

  if (update.availableAt) return { ...unchanged, ...cache }

  if (task.status === CRMTHINK_TASK_STATUS.COMPLETED) {
    if (update.progress === 'DONE') return { ...unchanged, ...cache }
    return {
      progress: 'DONE',
      doneAt: options.now,
      completedBy: options.completedBy ?? null,
      ...cache,
    }
  }

  if (task.status === CRMTHINK_TASK_STATUS.AWAITING_CONTROL) {
    return { ...unchanged, ...cache }
  }

  return { progress: 'PENDING', doneAt: null, completedBy: null, ...cache }
}

/** Conclusão enviada ao Bitrix e parada na aprovação do criador da tarefa. */
export function isAwaitingTaskApproval(
  update: Pick<ProductUpdate, 'progress' | 'bitrixTaskId' | 'bitrixTaskStatus'>,
): boolean {
  return (
    update.bitrixTaskId !== null &&
    update.progress === 'PENDING' &&
    update.bitrixTaskStatus === CRMTHINK_TASK_STATUS.AWAITING_CONTROL
  )
}
