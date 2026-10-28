import type {
  AplicationMirrorReader,
  AplicationRepository,
} from '@/modules/application/domain/repositories/aplication.repository'
import { apiLogger } from '@/shared/infra/logger'
import type { PortalAppMirror } from '../domain/entities/portal-domain'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalAppReadRepository } from '../domain/repositories/portal-app-read.repository'
import { mirrorState, readMirrors } from './helpers/hydrate-portal-apps'

export type LinkMirrorRefusal =
  | 'already-linked'
  | 'unverified'
  | 'not-found'
  | 'ambiguous'
  | 'taken'

/** Recusa nomeada: vira `409` com o motivo, e nada foi gravado. */
export class LinkMirrorRefusedError extends Error {
  constructor(
    readonly reason: LinkMirrorRefusal,
    readonly ids: string[] = [],
  ) {
    super(`Vincular espelho recusado: ${reason}`)
    this.name = 'LinkMirrorRefusedError'
  }
}

export type LinkAplicationMirrorDeps = {
  apps: PortalAppReadRepository
  mirrors: AplicationMirrorReader
  /** Ids dos itens da SPA 1060 do par (domínio, app code), do menor para o maior. */
  findItems: (domain: string, appCodeId: string) => Promise<string[]>
  aplications: Pick<
    AplicationRepository,
    'getAplicationBySpaId' | 'linkSpaItem'
  >
  /** Limpa o que a SPA 1142 guardou com a aplicação hidratada. Nunca lança. */
  invalidateCache: (spaId: string) => Promise<void>
}

export type LinkAplicationMirrorOutput = {
  spaId: string
  mirror: Extract<PortalAppMirror, 'linked'>
}

/**
 * "Vincular espelho" do backoffice: religa a instalação ao item que **já existe** na
 * SPA 1060, pela mesma busca do backfill de `spa_id` (`findAplicationSpaItems`).
 *
 * Não cria nem apaga item, e não escolhe entre duplicatas — o backfill pega o menor id,
 * mas ele roda com um humano lendo o log; aqui o suporte clicou num botão, e escolher
 * por ele esconderia a duplicata que precisa ser corrigida no CRM.
 *
 * Espelho `unknown` também é recusado: sem saber se o item atual existe, vincular outro
 * por cima poderia trocar um espelho bom por um duplicado.
 */
export class LinkAplicationMirror {
  constructor(private readonly deps: LinkAplicationMirrorDeps) {}

  async execute(appId: string): Promise<LinkAplicationMirrorOutput> {
    const app = await this.deps.apps.findById(appId)
    if (!app) throw new PortalAppNotFoundError()

    const current = mirrorState(
      app.spaId,
      await readMirrors(app.spaId ? [app.spaId] : [], this.deps.mirrors),
    )
    if (current === 'linked') throw new LinkMirrorRefusedError('already-linked')
    if (current === 'unknown') throw new LinkMirrorRefusedError('unverified')

    const ids = await this.deps.findItems(app.domain.name, app.appCodeId)
    if (ids.length === 0) throw new LinkMirrorRefusedError('not-found')
    if (ids.length > 1) throw new LinkMirrorRefusedError('ambiguous', ids)

    const spaId = ids[0] as string

    const owner = await this.deps.aplications.getAplicationBySpaId(spaId)
    if (owner && owner.id !== app.id) {
      throw new LinkMirrorRefusedError('taken', [spaId])
    }

    try {
      await this.deps.aplications.linkSpaItem(app.id, spaId)
    } catch (error) {
      // Corrida com outro vínculo do mesmo item: a restrição única é a última barreira.
      if (isUniqueViolation(error)) {
        throw new LinkMirrorRefusedError('taken', [spaId])
      }
      throw error
    }

    await this.deps.invalidateCache(spaId)

    apiLogger.info(
      {
        app: 'payments',
        aplicationId: app.id,
        spaId,
        previousSpaId: app.spaId,
        domain: app.domain.name,
        appCode: app.appCodeId,
      },
      'Espelho da instalação vinculado pelo backoffice',
    )

    return { spaId, mirror: 'linked' }
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'P2002'
