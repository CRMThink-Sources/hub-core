import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { GetLogsController } from '@/shared/presentation/controllers/get-logs.controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import type { LogApp } from '@/shared/infra/logger'

/** Gera a factory da rota GET /logs de um app, com o label Loki fixo. */
export function makeGetLogsControllerFactory(appLabel: LogApp) {
  return (_req: Request): Controller =>
    new GetLogsController(appLabel, new PrismaDomainRepository())
}
