import { PrismaClient } from '@/prisma/client'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import {
  AplicationRepository,
  AplicationTitleReader,
} from '@/modules/application/domain/repositories/aplication.repository'
import { apiLogger } from '@/shared/infra/logger'

/** Só a parte do client que este repositório usa — duplo pequeno no teste. */
export type AplicationPrismaClient = Pick<PrismaClient, 'app'>

/**
 * As duas relações saem na mesma query: o cliente e o app code fazem parte da
 * entidade, e buscá-los depois seria N+1 numa listagem.
 */
const INCLUDE_RELATIONS = { domain: true, appCode: true } as const

/** Linha de `core_apps` com as relações incluídas. */
type AppRow = {
  id: string
  spaId: string | null
  status: string
  installedAt: Date
  updatedAt: Date
  domain: { id: string; name: string; memberId: string }
  appCode: { id: string; code: string; name: string }
}

/**
 * `appCode` sai de `core_app_codes.id` (`crmthink.thinkzap`), **não** de `.code`
 * (`local.6a070b9ee9dfb9.18692076`). Motivo: o `id` é o identificador estável da
 * plataforma — é o que `appIdResolver` usa e o que o install grava no campo
 * `APP_CODE` do item da SPA 1060. O `.code` é o id do app no marketplace do
 * Bitrix e muda por ambiente, então casar por ele não resolveria a instalação.
 */
const toAplication = (row: AppRow, title: string): Aplication => ({
  id: row.id,
  spaId: row.spaId,
  customer: {
    id: row.domain.id,
    name: row.domain.name,
    memberId: row.domain.memberId,
  },
  appCode: row.appCode.id,
  title,
  active: row.status === 'ACTIVE',
  createdAt: row.installedAt,
  updatedAt: row.updatedAt,
})

export class PrismaAplicationRepository implements AplicationRepository {
  constructor(
    private readonly prisma: AplicationPrismaClient,
    private readonly titles: AplicationTitleReader,
  ) {}

  async getAplication(id: string): Promise<Aplication> {
    const row = await this.prisma.app.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    })
    if (!row) throw new AplicationNotFoundError(id)

    return this.hydrateOne(row)
  }

  async getAplicationBySpaId(spaId: string): Promise<Aplication | null> {
    const row = await this.prisma.app.findUnique({
      where: { spaId },
      include: INCLUDE_RELATIONS,
    })

    return row ? this.hydrateOne(row) : null
  }

  /**
   * Consulta o banco, não a SPA: a restrição única `(domain_id, app_code_id)`
   * garante instalação única para o par, o que um filtro na SPA não garante.
   */
  async getAplicationByInstall(params: {
    domain: string
    appCode: string
  }): Promise<Aplication | null> {
    const row = await this.prisma.app.findFirst({
      where: {
        domain: { name: params.domain },
        // `app_code_id`, não `code`: ver o comentário de `toAplication`.
        appCodeId: params.appCode,
      },
      include: INCLUDE_RELATIONS,
    })

    return row ? this.hydrateOne(row) : null
  }

  async getAplicationsByCustomer(customerId: string): Promise<Aplication[]> {
    const rows = await this.prisma.app.findMany({
      where: { domainId: customerId },
      include: INCLUDE_RELATIONS,
    })

    return this.hydrate(rows)
  }

  /**
   * Uma das duas escritas do repositório. A violação da restrição única propaga:
   * um item da SPA representando duas instalações é erro de dados, não caso a
   * tratar.
   */
  async linkSpaItem(id: string, spaId: string): Promise<Aplication> {
    const existing = await this.prisma.app.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    })
    if (!existing) throw new AplicationNotFoundError(id)

    // Reinstalação revincula o mesmo item: nada a escrever. Sem esse atalho a
    // instalação faria um UPDATE por reinstalação só para gravar o valor que já
    // está lá.
    if (existing.spaId === spaId) return this.hydrateOne(existing)

    const row = await this.prisma.app.update({
      where: { id },
      data: { spaId },
      include: INCLUDE_RELATIONS,
    })

    return this.hydrateOne(row)
  }

  /**
   * A outra escrita: anula `spa_id`, e **só** ele. A linha de `core_apps`
   * permanece com o mesmo `status` e `installed_at` — quem apagou foi o espelho
   * de CRM, não a instalação, e deletar a instalação a partir de um evento de CRM
   * inverteria a direção da verdade.
   */
  async unlinkSpaItem(id: string): Promise<Aplication> {
    const existing = await this.prisma.app.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    })
    if (!existing) throw new AplicationNotFoundError(id)

    // Já nulo: nada a escrever. Reentrega do evento de exclusão pelo Bitrix é
    // esperada, e ela não pode custar um UPDATE por entrega.
    if (existing.spaId === null) return this.hydrateOne(existing)

    const row = await this.prisma.app.update({
      where: { id },
      data: { spaId: null },
      include: INCLUDE_RELATIONS,
    })

    return this.hydrateOne(row)
  }

  private async hydrateOne(row: AppRow): Promise<Aplication> {
    const [aplication] = await this.hydrate([row])
    // `hydrate` devolve um item por linha recebida, então o array nunca é vazio
    // aqui — o `throw` existe só para o tipo, sob `noUncheckedIndexedAccess`.
    if (!aplication) throw new AplicationNotFoundError(row.id)

    return aplication
  }

  /**
   * Uma chamada ao reader para o lote inteiro, e não uma por linha. Título
   * ausente no `Map` cai para o nome do app: instalação sem espelho é estado
   * normal, e falha no CRM não pode derrubar leitura que o banco já respondeu.
   */
  private async hydrate(rows: AppRow[]): Promise<Aplication[]> {
    const spaIds = rows
      .map(row => row.spaId)
      .filter((spaId): spaId is string => spaId !== null)

    const titles =
      spaIds.length > 0
        ? await this.titles.getTitlesBySpaIds(spaIds)
        : new Map<string, string>()

    return rows.map(row => {
      if (row.spaId === null) {
        return toAplication(row, row.appCode.name)
      }

      const title = titles.get(row.spaId)
      if (title === undefined) {
        apiLogger.warn(
          { app: 'payments', aplicationId: row.id, spaId: row.spaId },
          'Item da SPA de aplicação sem título — usando o nome do app',
        )
        return toAplication(row, row.appCode.name)
      }

      return toAplication(row, title)
    })
  }
}
