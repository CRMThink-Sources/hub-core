import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import { CreateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/create-bi-connector.repository'
import { BiConnector } from '@/modules/thinkanalise/domain/entities/bi-connector'

const providerMap = {
  asaas: 'ASAAS',
  conta_azul: 'CONTA_AZUL',
  omie: 'OMIE',
} as const

export class PrismaBiConnectorRepository implements CreateBiConnectorRepository {
  async createBiConnector(
    connector: Omit<BiConnector, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    await prisma.biAnalyseConnector.create({
      data: {
        id: randomUUID(),
        appId: connector.appId,
        biconnectorId: connector.biconnectorId,
        label: connector.label,
        provider: providerMap[connector.provider],
        apiKey: connector.apiKey,
      },
    })
  }
}
