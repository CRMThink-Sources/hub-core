import { Product } from '@/modules/application/domain/entities/product'

export interface ProductRepository {
  getProduct(id: string): Promise<Product>
  getProducts(): Promise<Product[]>
}
