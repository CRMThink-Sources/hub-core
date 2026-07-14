import {
  OmieClient,
  omieToday,
  parseOmieCredentials,
} from '@/shared/infra/clients/omie.client'
import {
  moduleByTable,
  tables as omieTables,
} from '../presentation/controllers/callbacks/schemas/omie'

type OmieModule = 'estoque' | 'compras'

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, { expires: number; enabled: Set<OmieModule> }>()

// Probe barato (1 registro) por módulo — erro = módulo indisponível no plano do cliente
const PROBES: Record<OmieModule, (client: OmieClient) => Promise<unknown>> = {
  estoque: client =>
    client.list(
      'estoque/consulta',
      'ListarPosEstoque',
      'produtos',
      { dDataPosicao: omieToday() },
      1,
      'nPagina',
    ),
  compras: client =>
    client.list(
      'produtos/pedidocompra',
      'PesquisarPedCompra',
      'pedidos_pesquisa',
      {},
      1,
      'nPaginaRegs',
    ),
}

async function getEnabledModules(apiKey: string): Promise<Set<OmieModule>> {
  const { appKey, appSecret } = parseOmieCredentials(apiKey)

  const cached = cache.get(appKey)
  if (cached && cached.expires > Date.now()) return cached.enabled

  const client = new OmieClient(appKey, appSecret)
  const enabled = new Set<OmieModule>()

  // Sequencial — rate limit OMIE
  for (const [mod, probe] of Object.entries(PROBES)) {
    try {
      await probe(client)
      enabled.add(mod as OmieModule)
    } catch {
      // módulo não habilitado, sem permissão ou call inválido — oculta as tabelas
    }
  }

  cache.set(appKey, { expires: Date.now() + CACHE_TTL_MS, enabled })
  return enabled
}

export async function listOmieTables(
  apiKey: string,
): Promise<{ code: string; title: string }[]> {
  const enabled = await getEnabledModules(apiKey)
  return omieTables.filter(t => {
    const mod = moduleByTable[t.code]
    return !mod || enabled.has(mod)
  })
}
