import type { InsightsSourceResolver } from '../application/insights/resolve-insights-source'
import { ClassicInsightsDataSource } from '../infra/insights/classic-insights-data-source'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

// Tokens do Bitrix são renovados por job à parte; reler a credencial a cada
// chamada pesaria no banco, mas segurá-la para sempre serviria token vencido.
const CREDENTIAL_TTL_MS = 60_000

type AppAccess = { domain: string; client: Pick<BitrixClient, 'callMethod'> }

/**
 * Cliente que relê a credencial do app de tempos em tempos. A fonte (e o cache
 * de conversas dela) vive por app, então ela não pode prender a credencial
 * lida na primeira chamada.
 */
async function makeAppAccess(appId: string): Promise<AppAccess> {
  const app = await new PrismaInstalledAppRepository().getById(appId)
  if (!app) throw new Error('Instalação não encontrada.')
  const domain = await new PrismaDomainRepository().getDomainById(app.domainId)
  if (!domain) throw new Error('Domínio da instalação não encontrado.')

  const credentials = new PrismaCredentialRepository()
  let cached: { client: BitrixClient; expiresAt: number } | undefined
  const client: Pick<BitrixClient, 'callMethod'> = {
    callMethod: async <T = unknown>(
      method: string,
      params: Record<string, unknown>,
    ): Promise<T> => {
      if (!cached || cached.expiresAt <= Date.now()) {
        const credential = await credentials.get({ appId })
        if (!credential) {
          throw new Error('Credencial da instalação não encontrada.')
        }
        cached = {
          client: new BitrixClient({
            bitrixCredential: credential,
            domain: domain.name,
          }),
          expiresAt: Date.now() + CREDENTIAL_TTL_MS,
        }
      }
      return cached.client.callMethod<T>(method, params)
    },
  }
  return { domain: domain.name, client }
}

/**
 * Nesta fase todo portal lê pelo REST clássico (`lean`). Uma instância por app:
 * o cache de conversas carregadas dela é por instância e só ajuda se reusada.
 */
export function makeInsightsSourceResolver(): InsightsSourceResolver {
  const sources = new Map<string, ClassicInsightsDataSource>()
  const pending = new Map<string, Promise<ClassicInsightsDataSource>>()
  return appId => {
    const hit = sources.get(appId)
    if (hit) return Promise.resolve(hit)
    // Duas aberturas simultâneas não podem criar duas fontes (e dois caches).
    let building = pending.get(appId)
    if (!building) {
      building = makeAppAccess(appId)
        .then(({ domain, client }) => {
          const source = new ClassicInsightsDataSource(client, domain)
          sources.set(appId, source)
          return source
        })
        .finally(() => pending.delete(appId))
      pending.set(appId, building)
    }
    return building
  }
}
