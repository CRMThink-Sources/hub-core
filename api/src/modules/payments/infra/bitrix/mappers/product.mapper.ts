import z from 'zod'
import { Product } from '@/modules/payments/domain/entities/product'
import { InvalidBitrixProductError } from '../errors/invalid-bitrix-product.error'

/** Campo booleano do Bitrix: a API nova devolve boolean, a antiga 'Y'/'N'. */
const bitrixBoolean = z
  .union([z.boolean(), z.literal('Y'), z.literal('N'), z.null()])
  .transform(value => value === true || value === 'Y')

const bitrixProductSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  ufCrm87BillingModel: z.string(),
  ufCrm87Active: bitrixBoolean,
})

export const mapBitrixSpaProductToProduct = (raw: unknown): Product => {
  const parsed = bitrixProductSchema.safeParse(raw)

  if (!parsed.success) {
    throw new InvalidBitrixProductError(parsed.error.issues)
  }

  return {
    id: parsed.data.id,
    name: parsed.data.title,
    billingModel: parsed.data.ufCrm87BillingModel,
    active: parsed.data.ufCrm87Active,
  }
}

export const collectBitrixSpaProductToProduct = (raw: unknown[]): Product[] => {
  return raw.map(mapBitrixSpaProductToProduct)
}
