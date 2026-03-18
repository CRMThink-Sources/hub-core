import { Controller } from '@/shared/presentation/controller'
import { ZApiClient } from '../infra/clients/z-api.client'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { GetQrCodeController } from '../presentation/controllers/get-qr-code.controller'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'

export const makeGetQrCodeController = (): Controller => {
  const zApiClient = new ZApiClient(
    process.env.Z_API_PARTNER_TOKEN as string,
    process.env.Z_API_CLIENT_TOKEN as string,
  )
  const getInstanceRepository = new PrismaInstanceRepository()
  const getConnectorRepository = new PrismaConnectorRepository()
  return new GetQrCodeController(
    zApiClient,
    getConnectorRepository,
    getInstanceRepository,
  )
}
