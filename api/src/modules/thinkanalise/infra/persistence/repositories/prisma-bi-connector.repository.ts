import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import { CreateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/create-bi-connector.repository'
import { ListBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/list-bi-connector.repository'
import { DeleteBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/delete-bi-connector.repository'
import { UpdateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/update-bi-connector.repository'
import {
  BiConnector,
  BiAnalyseProvider,
} from '@/modules/thinkanalise/domain/entities/bi-connector'

const providerMap = {
  asaas: 'ASAAS',
  bling: 'BLING',
  conta_azul: 'CONTA_AZUL',
  omie: 'OMIE',
  sonax: 'SONAX',
} as const

const reverseProviderMap = {
  ASAAS: 'asaas',
  BLING: 'bling',
  CONTA_AZUL: 'conta_azul',
  OMIE: 'omie',
  SONAX: 'sonax',
} as const satisfies Record<string, BiAnalyseProvider>

export class PrismaBiConnectorRepository
  implements
    CreateBiConnectorRepository,
    ListBiConnectorRepository,
    DeleteBiConnectorRepository,
    UpdateBiConnectorRepository
{
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

  async listBiConnectors(appId: string): Promise<BiConnector[]> {
    const rows = await prisma.biAnalyseConnector.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(r => ({
      id: r.id,
      appId: r.appId,
      biconnectorId: r.biconnectorId,
      label: r.label,
      provider: reverseProviderMap[r.provider],
      apiKey: r.apiKey,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  async deleteBiConnector(biconnectorId: number): Promise<void> {
    await prisma.biAnalyseConnector.deleteMany({
      where: { biconnectorId },
    })
  }

  async updateBiConnector(
    biconnectorId: number,
    data: { label?: string; apiKey?: string },
  ): Promise<void> {
    await prisma.biAnalyseConnector.updateMany({
      where: { biconnectorId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
      },
    })
  }
}
