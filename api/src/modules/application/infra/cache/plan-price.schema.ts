import z from 'zod'

/**
 * O preço do gateway como ele é cacheado.
 *
 * Compartilhado entre o cache de plano e o de assinatura porque a entrada de
 * assinatura **embute** o plano: duas cópias do schema divergiriam, e a divergência
 * apareceria como plano com preço numa superfície e sem preço na outra.
 *
 * Os degraus são validados item a item, e não como `unknown`: degrau sem valor
 * resolveria `0` no cálculo, e o conector apareceria de graça na tela.
 */
const recurrenceSchema = z.object({
  interval: z.union([
    z.literal('day'),
    z.literal('week'),
    z.literal('month'),
    z.literal('year'),
  ]),
  intervalCount: z.number().int().positive(),
})

export const planPriceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('unit'),
    currency: z.string(),
    recurrence: recurrenceSchema,
    unitAmount: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('tiered'),
    currency: z.string(),
    recurrence: recurrenceSchema,
    mode: z.union([z.literal('graduated'), z.literal('volume')]),
    tiers: z
      .array(
        z.object({
          upTo: z.number().int().positive().nullable(),
          unitAmount: z.number().int().nonnegative(),
        }),
      )
      .min(1),
  }),
])
