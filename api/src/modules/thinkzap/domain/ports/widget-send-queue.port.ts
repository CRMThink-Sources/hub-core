/**
 * Enfileiramento da entrega de uma intenção do outbox.
 *
 * Só o id: tudo que o envio precisa está na row, e repetir os dados no job criaria duas
 * fontes de verdade que divergem na primeira retentativa.
 */
export type WidgetSendQueueJob = {
  outboxId: string
}

export interface WidgetSendQueue {
  enqueue(job: WidgetSendQueueJob): Promise<void>
}

/**
 * Garante que existe um job agendado para a intenção. `true` = o job não existia
 * (ou tinha terminado, falho ou concluído) e foi recriado; `false` = já estava
 * esperando, atrasado ou rodando.
 */
export interface WidgetSendScheduler {
  ensureScheduled(outboxId: string): Promise<boolean>
}
