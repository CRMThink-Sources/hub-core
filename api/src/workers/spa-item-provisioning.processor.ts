import { makeProvisionLineFromSpaItem } from '@/modules/thinkzap/main/make-provision-line-from-spa-item'
import {
  SPA_ITEM_PROVISIONING,
  type SpaItemProvisioningJob,
} from '@/queue/spa-item-provisioning.queue'
import { workerLogger } from '@/shared/infra/logger'

/**
 * `workerLogger` direto, e não `createWorkerSourceLogger`: `WorkerSource` nomeia de
 * qual provider a **mensagem** chegou (`z-api`, `bitrix`, `hubmessage`), e este job não
 * processa mensagem nenhuma. Alargar aquele tipo para caber uma fila misturaria dois
 * eixos no mesmo campo do log.
 */
const log = workerLogger.child({ queue: SPA_ITEM_PROVISIONING })

/**
 * Executa o provisionamento de um item criado à mão na SPA 1146.
 *
 * A fábrica é chamada **por job**, e não uma vez no módulo, pelo mesmo motivo dos
 * processors do inbound: ela monta cliente HTTP e decorators de cache, e prender uma
 * instância no escopo do módulo faria a conexão viver enquanto o worker vive — sem que
 * nada a reconstrua se a credencial do portal interno mudar.
 *
 * O desfecho vem estruturado do caso de uso, que já logou o detalhe com o código de erro
 * do catálogo. Aqui só o resumo: o que ficou registrado é o que o suporte lê.
 */
export async function processSpaItemProvisioning(
  job: SpaItemProvisioningJob,
): Promise<void> {
  const result = await makeProvisionLineFromSpaItem().execute({
    itemId: job.itemId,
    traceKey: job.traceKey,
  })

  log.info(
    {
      app: 'thinkzap',
      itemId: job.itemId,
      traceKey: job.traceKey,
      outcome: result.outcome,
      billingAdjusted: result.billingAdjusted,
    },
    'Provisionamento de item da SPA concluído',
  )
}
