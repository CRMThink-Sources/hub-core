import { Request } from 'express'
import { z } from 'zod'

/**
 * Entrada comum das rotas de linha: o id do item vem do path, e a instalação vem
 * do JWT (via `authMiddleware`).
 *
 * `domainId`/`appId` são opcionais no tipo do Express, então o Zod é o que garante
 * presença antes de a resolução rodar. E é de propósito que a instalação **não**
 * venha da request: se viesse, o chamador escolheria o escopo.
 */
const schema = z.object({
  subscriptionItemId: z.string().min(1),
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

export type LineRequestInput = z.infer<typeof schema>

export const parseLineRequest = (req: Request): LineRequestInput =>
  schema.parse({
    subscriptionItemId: req.params.itemId,
    domainId: req.domainId,
    appCode: req.appId,
  })
