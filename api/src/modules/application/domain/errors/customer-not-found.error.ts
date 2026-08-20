/** Cliente não existe em `core_domains`. */
export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Cliente "${customerId}" não encontrado`)
    this.name = 'CustomerNotFoundError'
  }
}
