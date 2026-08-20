import { Customer } from '@/modules/application/domain/entities/customer'
import { Product } from '@/modules/application/domain/entities/product'
import { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Um produto que o cliente usa, com as assinaturas que o pagam. Não vive na
 * entidade `Customer`: hidratar isso em toda leitura faria `getCustomers()`
 * puxar as assinaturas do portal inteiro.
 */
export interface CustomerProduct {
  product: Product
  subscriptions: Subscription[]
}

/**
 * Contrato **somente leitura** sobre `core_domains`.
 *
 * Não há `createCustomer`/`updateCustomer`: quem escreve `core_domains` é o
 * fluxo de instalação do app (`PrismaDomainRepository`). Um segundo caminho de
 * escrita a partir de billing criaria portal sem app instalado e concorreria
 * com as restrições únicas de `name` e `member_id`.
 *
 * Lookup por instalação (`domain` + `appCode`) não está aqui de propósito: essa
 * pergunta é sobre instalação, e é respondida por
 * `AplicationRepository.getAplicationByInstall`.
 *
 * Os lookups devolvem `null` em vez de lançar — perguntar "este portal já está
 * registrado?" é o caso de uso normal, e forçar `try/catch` transformaria fluxo
 * de controle em exceção. `getCustomer(id)` lança, porque pedir um id
 * específico e não achar é inconsistência de dados.
 */
export interface CustomerRepository {
  getCustomer(id: string): Promise<Customer>
  getCustomers(): Promise<Customer[]>
  getCustomerByMemberId(memberId: string): Promise<Customer | null>
  /** `name` é o host do portal — coluna única `core_domains.name`. */
  getCustomerByName(name: string): Promise<Customer | null>
  /**
   * Agregação derivada: as aplicações do cliente → as assinaturas de cada uma →
   * agrupadas por `subscription.plan.product`. Passa pelas aplicações porque a
   * assinatura é vinculada à instalação que ela paga, não ao portal, e agrupa
   * pelo produto do plano porque a assinatura não tem produto próprio — a SPA
   * 1142 não tem campo de produto.
   */
  getCustomerProducts(customerId: string): Promise<CustomerProduct[]>
}
