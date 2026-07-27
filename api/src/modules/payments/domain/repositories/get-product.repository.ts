import { Product } from '@/modules/payments/domain/entities/product'

export interface ProductRepository {
  getProduct(id: string): Promise<Product>
  getProducts(): Promise<Product[]>
}
