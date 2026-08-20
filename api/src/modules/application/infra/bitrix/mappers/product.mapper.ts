import z from 'zod'
import { Product } from '@/modules/application/domain/entities/product'
import { InvalidBitrixProductError } from '../errors/invalid-bitrix-product.error'

/** Campo booleano do Bitrix: a API nova devolve boolean, a antiga 'Y'/'N'. */
const bitrixBoolean = z
  .union([z.boolean(), z.literal('Y'), z.literal('N'), z.null()])
  .transform(value => value === true || value === 'Y')

const bitrixProductSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  /**
   * `UF_CRM_87_BILLING_MODEL` é `type: "enumeration"`, então o Bitrix devolve o
   * **id numérico** da opção (`13605` Padrão, `13607` Por unidade), não um rótulo
   * — confirmado em `crm.item.fields` da SPA 1134. Por isso aceita número: o
   * `z.string()` anterior rejeitava todo produto real.
   *
   * União em vez de `z.coerce.string()` de propósito: a coerção transformaria
   * campo ausente na string `"undefined"` e `null` em `"null"`, e um produto sem
   * modelo de cobrança passaria como se tivesse um.
   *
   * O valor segue cru no domínio, sem tradução para vocabulário próprio, porque
   * nada consome `billingModel` semanticamente hoje.
   */
  ufCrm87BillingModel: z
    .union([z.string().min(1), z.number()])
    .transform(String),
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
