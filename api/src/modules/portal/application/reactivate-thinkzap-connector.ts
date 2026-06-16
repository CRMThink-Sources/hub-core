import { prisma } from '@/config/prisma'

export class ThinkzapConnectorNotFoundError extends Error {
  constructor() {
    super('Conector não encontrado')
    this.name = 'ThinkzapConnectorNotFoundError'
  }
}

export class ThinkzapConnectorNotInactiveError extends Error {
  constructor() {
    super('Conector não está inativo')
    this.name = 'ThinkzapConnectorNotInactiveError'
  }
}

export async function reactivateThinkzapConnector(
  connectorId: string,
  appId: string,
): Promise<void> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector || connector.appId !== appId)
    throw new ThinkzapConnectorNotFoundError()
  if (connector.status !== 'INACTIVE')
    throw new ThinkzapConnectorNotInactiveError()

  await prisma.connector.update({
    where: { id: connectorId },
    data: { status: 'ACTIVE' },
  })
}
