import { PrismaClient } from '@/prisma/client'
import { Customer } from '@/modules/application/domain/entities/customer'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import {
  CustomerProduct,
  CustomerRepository,
} from '@/modules/application/domain/repositories/customer.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'

/**
 * Só a parte do client que este repositório usa. Injetar isso em vez do
 * `PrismaClient` inteiro deixa o teste passar um duplo pequeno, sem banco.
 */
export type CustomerPrismaClient = Pick<PrismaClient, 'domain'>

/** Linha de `core_domains` → domínio. Sem Zod: o Prisma já é tipado na origem. */
const toCustomer = (row: {
  id: string
  name: string
  memberId: string
}): Customer => ({
  id: row.id,
  name: row.name,
  memberId: row.memberId,
})

export class PrismaCustomerRepository implements CustomerRepository {
  /**
   * @param aplications Instalações do portal — a agregação de produtos passa por
   * elas, porque assinatura é vinculada à instalação que ela paga.
   * @param subscriptions Deve vir decorado com `CachedSubscriptionRepository`:
   * `getCustomerProducts` lista as assinaturas de cada aplicação a cada chamada,
   * e essa listagem já tem chave de cache própria, invalidada na escrita.
   */
  constructor(
    private readonly prisma: CustomerPrismaClient,
    private readonly aplications: AplicationRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async getCustomer(id: string): Promise<Customer> {
    const row = await this.prisma.domain.findUnique({ where: { id } })
    if (!row) throw new CustomerNotFoundError(id)

    return toCustomer(row)
  }

  async getCustomers(): Promise<Customer[]> {
    const rows = await this.prisma.domain.findMany()

    return rows.map(toCustomer)
  }

  async getCustomerByMemberId(memberId: string): Promise<Customer | null> {
    const row = await this.prisma.domain.findUnique({ where: { memberId } })

    return row ? toCustomer(row) : null
  }

  async getCustomerByName(name: string): Promise<Customer | null> {
    const row = await this.prisma.domain.findUnique({ where: { name } })

    return row ? toCustomer(row) : null
  }

  async getCustomerProducts(customerId: string): Promise<CustomerProduct[]> {
    // Sem esta leitura, cliente inexistente e cliente sem assinatura
    // devolveriam o mesmo `[]`.
    await this.getCustomer(customerId)

    const aplications =
      await this.aplications.getAplicationsByCustomer(customerId)
    if (aplications.length === 0) return []

    // Aplicação sem espelho na SPA não pode ter assinatura: o campo parent da
    // SPA 1142 guarda o `spaId`, então sem ele não há o que consultar.
    const spaIds = aplications
      .map(aplication => aplication.spaId)
      .filter((spaId): spaId is string => spaId !== null)
    if (spaIds.length === 0) return []

    const perAplication = await Promise.all(
      spaIds.map(spaId =>
        this.subscriptions.getSubscriptionsByAplication(spaId),
      ),
    )

    // `subscription.plan.product` já vem hidratado da camada de assinaturas,
    // então o agrupamento é em memória — nenhuma chamada a plano ou produto.
    // Agrupa pelo produto do **plano**: a assinatura não tem produto próprio,
    // porque a SPA 1142 não tem campo de produto.
    // Assinatura cancelada entra como qualquer outra: filtrar por status é
    // decisão de quem consome.
    const byProductId = new Map<string, CustomerProduct>()

    for (const subscription of perAplication.flat()) {
      const { product } = subscription.plan
      const group = byProductId.get(product.id)

      if (group) {
        group.subscriptions.push(subscription)
        continue
      }

      byProductId.set(product.id, { product, subscriptions: [subscription] })
    }

    return [...byProductId.values()]
  }
}
