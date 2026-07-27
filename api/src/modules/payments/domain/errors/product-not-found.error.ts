/** Produto não existe no catálogo. */
export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Produto "${productId}" não encontrado`)
    this.name = 'ProductNotFoundError'
  }
}
