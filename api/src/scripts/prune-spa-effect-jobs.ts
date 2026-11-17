import 'dotenv/config'
import { spaItemProvisioningQueue } from '@/queue/spa-item-provisioning.queue'
import { spaItemResourceSyncQueue } from '@/queue/spa-item-resource-sync.queue'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Remove os jobs concluídos que ficaram retidos antes de as filas da SPA terem
 * retenção. Roda uma vez depois do deploy; idempotente.
 *
 * Os jobs de id fixo (`spa-item-status-<id>`, ...) já não bloqueiam evento nenhum —
 * os novos usam id automático —, então isto só devolve a memória do Redis. Falhos
 * ficam: são a evidência de linha que não provisionou.
 *
 * `--dry-run` só conta.
 */
const BATCH = 1000

async function prune(
  queue: typeof spaItemResourceSyncQueue | typeof spaItemProvisioningQueue,
  dryRun: boolean,
): Promise<{ queue: string; before: number; removed: number }> {
  const before = (await queue.getJobCounts('completed')).completed ?? 0
  if (dryRun) return { queue: queue.name, before, removed: 0 }

  let removed = 0
  for (;;) {
    const ids = await queue.clean(0, BATCH, 'completed')
    removed += ids.length
    if (ids.length < BATCH) break
  }

  return { queue: queue.name, before, removed }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  for (const queue of [spaItemResourceSyncQueue, spaItemProvisioningQueue]) {
    apiLogger.info(
      { app: 'thinkzap', dryRun, ...(await prune(queue, dryRun)) },
      'Limpeza dos jobs concluídos retidos na fila da SPA',
    )
    await queue.close()
  }
}

main()
  .then(async () => {
    await redisConnection.quit()
    process.exit(0)
  })
  .catch((err: unknown) => {
    apiLogger.error(
      { app: 'thinkzap', err },
      'Falha na limpeza dos jobs retidos da fila da SPA',
    )
    process.exit(1)
  })
