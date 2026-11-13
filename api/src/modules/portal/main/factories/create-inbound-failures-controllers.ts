import { Controller } from '@/shared/presentation/controller'
import { PrismaDeliveryAttemptRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-delivery-attempt.repository'
import { PrismaInboundFailureRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-inbound-failure.repository'
import {
  GetInboundFailure,
  InboundReenqueuer,
  ListInboundFailures,
  ReprocessInboundFailures,
} from '../../application/inbound-failures'
import {
  GetInboundFailureController,
  ListInboundFailuresController,
  ReprocessInboundFailureController,
  ReprocessInboundFailuresBatchController,
} from '../../presentation/controllers/inbound-failures-controller'

/**
 * Recoloca o evento na fila de entrada, com o `jobId` do reprocesso.
 *
 * A fila é importada na hora do uso: o módulo dela cria a `Queue` (conexão Redis) ao ser
 * carregado, e o `routes.ts` do portal é carregado por muitos testes e comandos que não
 * reprocessam nada.
 */
const inboundQueue: InboundReenqueuer = {
  enqueue: async (job, jobId) => {
    const { enqueueThinkzapInboundJob } =
      await import('@/queue/thinkzap-inbound.queue')
    await enqueueThinkzapInboundJob(job, { jobId })
  },
}

const makeReprocess = () =>
  new ReprocessInboundFailures(
    new PrismaInboundFailureRepository(),
    inboundQueue,
  )

export const createListInboundFailuresController = (): Controller =>
  new ListInboundFailuresController(
    new ListInboundFailures(new PrismaInboundFailureRepository()),
  )

export const createGetInboundFailureController = (): Controller =>
  new GetInboundFailureController(
    new GetInboundFailure(
      new PrismaInboundFailureRepository(),
      new PrismaDeliveryAttemptRepository(),
    ),
  )

export const createReprocessInboundFailureController = (): Controller =>
  new ReprocessInboundFailureController(makeReprocess())

export const createReprocessInboundFailuresBatchController = (): Controller =>
  new ReprocessInboundFailuresBatchController(makeReprocess())
