import z from 'zod'
import { SpaItemResourceMirror } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'

/**
 * Chave e schema do **espelho do recurso** de um item da SPA 1146.
 *
 * Fica ao lado de `keys.ts` porque mora no mesmo Redis, mas não é cache: cache tem TTL e
 * é reconstruível a partir da fonte. Este não é nenhum dos dois — ele **é** a fonte, para
 * as duas perguntas que nada mais responde:
 *
 * 1. *Qual recurso pertencia ao item que já não existe.* O item da SPA é a fonte única da
 *    credencial desde `move-connector-settings-to-spa`, então apagá-lo apaga a credencial,
 *    e o webhook de exclusão recebe um id e nada mais.
 * 2. *Se aquele recurso já foi desassinado.* É a ausência que
 *    `provider-resource-billing-lifecycle` cita como razão de não haver gatilho de
 *    cobrança fora do gateway — "não há estado registrando se o recurso está assinado".
 *
 * Redis, e não tabela: a restrição apurada em `retire-instance-table` vale aqui — nenhum
 * DDL em produção.
 */

/**
 * Versão do shape do espelho. Sobe junto com qualquer mudança no valor.
 *
 * Diferente das versões de `keys.ts`, subir esta **perde dado**: as entradas antigas ficam
 * órfãs sem ninguém para apagá-las, e os itens que elas descreviam voltam a ser
 * irresolvíveis na exclusão. Subir a versão exige rodar o backfill junto.
 */
export const SPA_ITEM_RESOURCE_MIRROR_VERSION = 'v1'

export const spaItemResourceMirrorKey = (itemId: string) =>
  `payments:spa-item-resource:${SPA_ITEM_RESOURCE_MIRROR_VERSION}:${itemId}`

/** Padrão de `SCAN` do espelho inteiro — usado só por script de operação. */
export const SPA_ITEM_RESOURCE_MIRROR_SCAN_PATTERN = `payments:spa-item-resource:${SPA_ITEM_RESOURCE_MIRROR_VERSION}:*`

/**
 * Validação do valor lido.
 *
 * Entrada que não casa é tratada como **ausente**, não como erro: espelho corrompido e
 * item legado levam ao mesmo lugar — o registro de recurso irresolvível —, e distingui-los
 * não mudaria nenhuma decisão.
 */
export const spaItemResourceMirrorSchema: z.ZodType<SpaItemResourceMirror> =
  z.object({
    provider: z.union([z.literal('ZAPI'), z.literal('HUBMESSAGE')]),
    instanceId: z.string().min(1),
    zApiToken: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    subscriptionId: z.string().min(1),
    unsubscribedAt: z.string().min(1).optional(),
  })
