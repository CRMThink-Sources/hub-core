import type { ProductUpdate } from '../entities/product-update'

export interface ProductUpdateRepository {
  findById(id: string): Promise<ProductUpdate | null>
  /** Todas as novidades, mais recentes primeiro. A lista é pequena: sem paginação. */
  list(): Promise<ProductUpdate[]>
  /** Pelo índice único de `bitrix_task_id` — o filtro barato do webhook. */
  findByBitrixTaskId(taskId: number): Promise<ProductUpdate | null>
  /** Com tarefa vinculada e ainda não disponíveis: o que a reconciliação relê. */
  listReconcilable(): Promise<ProductUpdate[]>
  /**
   * Cria ou substitui pelo `id` e devolve o gravado (com `updatedAt` do banco).
   * Lança `TaskAlreadyLinkedError` quando a tarefa já é de outra novidade.
   */
  save(update: ProductUpdate): Promise<ProductUpdate>
  delete(id: string): Promise<void>
}
