import {
  insightsResultCache,
  type InsightsResultCache,
} from '../application/insights/insights-result-cache'
import {
  getKeyProblem,
  markKeyRevoked,
} from '../application/insights/key-health'
import type {
  InsightsSourceFailureHandler,
  InsightsSourceResolver,
} from '../application/insights/resolve-insights-source'
import type { InsightsDataSource } from '../domain/ports/insights-data-source.port'
import { VibecodeClient } from '../infra/clients/vibecode.client'
import { ClassicInsightsDataSource } from '../infra/insights/classic-insights-data-source'
import {
  isVibecodeKeyRevoked,
  VibeInsightsDataSource,
} from '../infra/insights/vibe-insights-data-source'
import { PrismaInsightsSettingsRepository } from '../infra/persistence/repositories/prisma-insights-settings.repository'
import { decryptToken } from '@/shared/infra/crypto/token-cipher'
import { apiLogger } from '@/shared/infra/logger'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

// Tokens do Bitrix são renovados por job à parte; reler a credencial a cada
// chamada pesaria no banco, mas segurá-la para sempre serviria token vencido.
const CREDENTIAL_TTL_MS = 60_000

/** Domínio Bitrix da instalação (portal do clássico e reserva do Vibe). */
async function loadDomain(appId: string): Promise<string> {
  const app = await new PrismaInstalledAppRepository().getById(appId)
  if (!app) throw new Error('Instalação não encontrada.')
  const domain = await new PrismaDomainRepository().getDomainById(app.domainId)
  if (!domain) throw new Error('Domínio da instalação não encontrado.')
  return domain.name
}

/**
 * Cliente que relê a credencial do app de tempos em tempos. A fonte (e o cache
 * de conversas dela) vive por app, então ela não pode prender a credencial
 * lida na primeira chamada.
 */
function makeAppClient(
  appId: string,
  domain: string,
): Pick<BitrixClient, 'callMethod'> {
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
            domain,
          }),
          expiresAt: Date.now() + CREDENTIAL_TTL_MS,
        }
      }
      return cached.client.callMethod<T>(method, params)
    },
  }
  return client
}

export type InsightsSources = {
  resolve: InsightsSourceResolver
  /**
   * Descarta a fonte guardada do app e o cache de resultados do painel.
   * Chamado ao gravar ou remover a chave: sem isso o app seguiria no modo
   * antigo (e o painel em cache) até reiniciar o processo.
   */
  invalidate: (appId: string) => void
  onSourceFailure: InsightsSourceFailureHandler
}

/**
 * Fonte do Insights por app: com chave Vibecode guardada (e não recusada),
 * Vibe API (`full`); sem chave, REST clássico (`lean`). Uma instância por app:
 * o cache de conversas carregadas dela é por instância e só ajuda se reusada.
 */
export function makeInsightsSourceResolver(
  deps: { resultCache?: InsightsResultCache } = {},
): InsightsSources {
  const resultCache = deps.resultCache ?? insightsResultCache
  const settings = new PrismaInsightsSettingsRepository()
  const sources = new Map<string, InsightsDataSource>()
  const pending = new Map<string, Promise<InsightsDataSource>>()
  // Invalidar no meio de uma montagem não pode deixar a fonte velha guardada.
  const generation = new Map<string, number>()

  async function build(appId: string): Promise<InsightsDataSource> {
    const [row, domain] = await Promise.all([
      settings.get(appId),
      loadDomain(appId),
    ])
    // Chave já recusada nesta execução: vai direto ao clássico em vez de
    // tentar (e falhar) de novo em toda abertura. Regravar a chave limpa isso.
    if (row?.keyEnc && getKeyProblem(appId) !== 'revoked') {
      let key: string | null = null
      try {
        key = decryptToken(row.keyEnc)
      } catch (e) {
        // Só o nome do erro: a mensagem não deve carregar nada da chave.
        apiLogger.warn(
          { appId, errorName: e instanceof Error ? e.name : 'unknown' },
          'Insights: chave Vibecode ilegível, seguindo pelo REST clássico',
        )
      }
      if (key) {
        const source = new VibeInsightsDataSource(
          new VibecodeClient(key),
          domain,
        )
        await source.loadPortal()
        return source
      }
    }
    return new ClassicInsightsDataSource(makeAppClient(appId, domain), domain)
  }

  const invalidate = (appId: string) => {
    generation.set(appId, (generation.get(appId) ?? 0) + 1)
    sources.delete(appId)
    pending.delete(appId)
    resultCache.invalidate(appId)
  }

  const resolve: InsightsSourceResolver = appId => {
    const hit = sources.get(appId)
    if (hit) return Promise.resolve(hit)
    // Duas aberturas simultâneas não podem criar duas fontes (e dois caches).
    let building = pending.get(appId)
    if (!building) {
      const gen = generation.get(appId) ?? 0
      const p: Promise<InsightsDataSource> = build(appId)
        .then(source => {
          if ((generation.get(appId) ?? 0) === gen) sources.set(appId, source)
          return source
        })
        .finally(() => {
          if (pending.get(appId) === p) pending.delete(appId)
        })
      building = p
      pending.set(appId, building)
    }
    return building
  }

  // Só 401/403 dão a chave por revogada: 5xx e rede são instabilidade da
  // Vibecode e sobem como falha de leitura, sem derrubar o modo completo.
  const onSourceFailure: InsightsSourceFailureHandler = (appId, error) => {
    if (!isVibecodeKeyRevoked(error)) return false
    apiLogger.warn(
      { appId },
      'Insights: Vibecode recusou a chave, servindo pelo REST clássico',
    )
    markKeyRevoked(appId)
    invalidate(appId)
    return true
  }

  return { resolve, invalidate, onSourceFailure }
}
