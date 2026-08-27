import z from 'zod'

/**
 * A assinatura do gateway como ela é cacheada.
 *
 * `quantity` é validado como inteiro não-negativo, e não como `number` solto: é o
 * divisor de águas entre "cobrada" e "bonificada", e um valor quebrado ou negativo
 * vindo de uma entrada velha não viraria erro visível — viraria linha contada como
 * cortesia na tela do cliente.
 *
 * As datas vão e voltam como string ISO. `JSON.stringify` já serializa `Date` assim,
 * e `z.coerce.date()` desfaz na leitura — sem isso a entrada cacheada devolveria
 * string onde o domínio declara `Date`, e o erro só apareceria na formatação.
 */
export const gatewaySubscriptionSchema = z.object({
  status: z.union([
    z.literal('active'),
    z.literal('past_due'),
    z.literal('cancelled'),
    z.literal('trialing'),
    z.literal('unknown'),
  ]),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  items: z.array(
    z.object({
      priceId: z.string().min(1),
      quantity: z.number().int().nonnegative(),
    }),
  ),
})
