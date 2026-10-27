import { Controller } from '@/shared/presentation/controller'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import {
  GetOutboxFailure,
  ListOutboxFailures,
  ReprocessOutboxFailures,
} from '../../application/outbox-failures'
import {
  GetOutboxFailureController,
  ListOutboxFailuresController,
  ReprocessOutboxFailureController,
  ReprocessOutboxFailuresBatchController,
} from '../../presentation/controllers/outbox-failures-controller'

const makeReprocess = () =>
  new ReprocessOutboxFailures(
    new PrismaWidgetOutboxRepository(),
    new BullMqWidgetSendQueue(),
  )

export const createListOutboxFailuresController = (): Controller =>
  new ListOutboxFailuresController(
    new ListOutboxFailures(new PrismaWidgetOutboxRepository()),
  )

export const createGetOutboxFailureController = (): Controller =>
  new GetOutboxFailureController(
    new GetOutboxFailure(new PrismaWidgetOutboxRepository()),
  )

export const createReprocessOutboxFailureController = (): Controller =>
  new ReprocessOutboxFailureController(makeReprocess())

export const createReprocessOutboxFailuresBatchController = (): Controller =>
  new ReprocessOutboxFailuresBatchController(makeReprocess())
