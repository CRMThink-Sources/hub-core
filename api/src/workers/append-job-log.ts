import { Job } from 'bullmq'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { workerLogger } from '@/shared/infra/logger'

/**
 * Liga o port de log de job ao `job.log()` do BullMQ, que alimenta a **aba Logs** do
 * job no Bull Board.
 *
 * `catch` que só avisa: `job.log()` escreve no Redis, e uma falha ali não pode derrubar
 * a entrega da mensagem que o log estava tentando descrever. Perder a linha é ruim;
 * perder a mensagem por causa da linha é absurdo.
 *
 * Prefixado com o horário porque a aba mostra as linhas em sequência, sem timestamp
 * próprio — e a distância entre duas etapas é metade do diagnóstico.
 *
 * Compartilhado entre os workers: `queueName` sai do próprio job, então não há
 * constante de fila para passar nem uma cópia por entrypoint.
 */
export function makeAppendJobLog(job: Job): AppendJobLog {
  return async line => {
    try {
      await job.log(`[${new Date().toISOString()}] ${line}`)
    } catch (err) {
      workerLogger.warn(
        {
          app: 'thinkzap',
          queue: job.queueName,
          jobId: job.id,
          err,
        },
        'Falha ao gravar log no job; execução segue',
      )
    }
  }
}
