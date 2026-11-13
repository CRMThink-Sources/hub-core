import { UnrecoverableError } from 'bullmq'
import type { Logger } from 'pino'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { ThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import {
  extractInboundRouting,
  previousFailureIdOf,
  type InboundRouting,
} from '@/modules/thinkzap/domain/inbound-failure-routing'
import type { DeliveryAttemptRecorder } from '@/modules/thinkzap/domain/ports/delivery-attempt-recorder.port'
import type { CreateInboundFailureInput } from '@/modules/thinkzap/infra/persistence/repositories/prisma-inbound-failure.repository'
import { MAX_ATTEMPT_MESSAGE_LENGTH } from '@/modules/thinkzap/infra/persistence/repositories/prisma-delivery-attempt.repository'
import { attemptErrorCodeOf } from '@/shared/infra/log-error'

/** Onde o evento caiu: o que a lista do portal usa para mostrar e filtrar por cliente. */
export type ResolvedInboundOwner = {
  domainId?: string
  domainName?: string
  instanceId?: string
}

export type CaptureInboundFailureDeps = {
  attempts: DeliveryAttemptRecorder
  failures: { create(input: CreateInboundFailureInput): Promise<string> }
  /** Melhor esforço: pode devolver `{}`. Não deve lançar (se lançar, é tratado). */
  resolveOwner: (routing: InboundRouting) => Promise<ResolvedInboundOwner>
  logger: Logger
}

/** O que o `Worker` entrega no evento `failed`, só o que a captura lê. */
export type FailedInboundJob = {
  id?: string
  data: ThinkzapInboundJob
  attemptsMade: number
  opts: { attempts?: number }
}

/**
 * A falha é final quando as tentativas da fila acabaram, ou o erro é
 * `UnrecoverableError` (o BullMQ não retenta, mesmo com tentativa sobrando). O handler
 * `failed` do BullMQ dispara a cada tentativa, e só a final vira falha de recebimento.
 */
export function isFinalInboundFailure(
  job: Pick<FailedInboundJob, 'attemptsMade' | 'opts'>,
  err: unknown,
): boolean {
  return (
    err instanceof UnrecoverableError ||
    job.attemptsMade >= (job.opts.attempts ?? 1)
  )
}

/**
 * Registra a tentativa que falhou e, se for a final, a falha de recebimento
 * (`admin-falhas-recebimento`). **Nunca lança**: roda no handler `failed` do worker, e
 * erro de gravação não pode derrubar o processamento dos demais eventos.
 *
 * Sem `job.id` não há como ligar as tentativas à falha, então nada é gravado.
 */
export async function captureInboundFailure(
  job: FailedInboundJob | undefined,
  err: unknown,
  durationMs: number | undefined,
  deps: CaptureInboundFailureDeps,
): Promise<void> {
  if (!job?.id) return

  const message = err instanceof Error ? err.message : String(err)
  const errorCode = attemptErrorCodeOf(err)
  const jobId = String(job.id)

  try {
    await deps.attempts.recordFailure(
      { kind: 'INBOUND', id: jobId },
      {
        errorCode,
        message,
        ...(durationMs !== undefined ? { durationMs } : {}),
      },
    )

    if (!isFinalInboundFailure(job, err)) return

    const { source, type, traceKey, body } = job.data
    logThinkzapError(
      deps.logger,
      'thinkzap.inbound.event_failed',
      {
        app: 'thinkzap',
        jobId,
        source,
        type,
        traceKey,
        attempts: job.attemptsMade,
        lastError: message,
      },
      { level: 'error', msg: 'Evento recebido esgotou as tentativas' },
    )
    const owner = await deps
      .resolveOwner(extractInboundRouting(source, body))
      .catch(() => ({}) as ResolvedInboundOwner)

    await deps.failures.create({
      jobId,
      source,
      type: type || '',
      traceKey: traceKey || null,
      domainId: owner.domainId ?? null,
      domainName: owner.domainName ?? null,
      instanceId: owner.instanceId ?? null,
      errorCode,
      // O erro de um provider pode trazer o corpo da resposta (com telefone e nome): corta
      // como o log de tentativas, para a falha final nunca deixar de ser gravada por tamanho.
      errorMessage: message.slice(0, MAX_ATTEMPT_MESSAGE_LENGTH),
      attempts: job.attemptsMade,
      payload: body,
      // Evento reprocessado que falha de novo: nova falha, ligada à que o originou.
      previousFailureId: previousFailureIdOf(jobId),
    })
  } catch (captureErr) {
    deps.logger.warn(
      { app: 'thinkzap', jobId, err: captureErr },
      'Falha ao registrar a falha de recebimento; o worker segue',
    )
  }
}
