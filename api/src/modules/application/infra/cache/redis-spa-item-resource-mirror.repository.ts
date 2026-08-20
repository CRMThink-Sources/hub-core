import type IORedis from 'ioredis'
import {
  SaveSpaItemResourceMirrorInput,
  SpaItemResourceMirror,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  spaItemResourceMirrorKey,
  spaItemResourceMirrorSchema,
} from './spa-item-resource-mirror.keys'

/**
 * O espelho do recurso em Redis, **sem TTL**.
 *
 * Sem TTL de propósito, e é a diferença que separa este repositório dos decorators de
 * cache ao lado: o espelho tem que valer no dia em que a linha for apagada, que pode ser
 * um ano depois de ela nascer. Quem o apaga é a limpeza da exclusão, não o tempo.
 *
 * Chave sem expiração num Redis compartilhado com o BullMQ é dado que ninguém recolhe. É
 * aceitável pelo tamanho — uma chave por linha viva, ordem de centenas — e o `remove` do
 * job de limpeza é o recolhedor.
 */
export class RedisSpaItemResourceMirrorRepository implements SpaItemResourceMirrorRepository {
  constructor(private readonly redis: IORedis) {}

  async find(itemId: string): Promise<SpaItemResourceMirror | null> {
    const raw = await this.redis.get(spaItemResourceMirrorKey(itemId))
    if (!raw) return null

    const parsed = spaItemResourceMirrorSchema.safeParse(safeJsonParse(raw))
    if (!parsed.success) {
      /**
       * `warn`, e tratado como ausente: o consumidor cai no caminho de recurso
       * irresolvível, que é o mesmo do item legado. Lançar aqui transformaria uma entrada
       * estragada num job em retry infinito.
       */
      apiLogger.warn(
        { app: 'payments', itemId },
        'Espelho do recurso do item com shape inválido — tratando como ausente',
      )
      return null
    }

    return parsed.data
  }

  async save(
    itemId: string,
    mirror: SaveSpaItemResourceMirrorInput,
  ): Promise<void> {
    await this.redis.set(
      spaItemResourceMirrorKey(itemId),
      JSON.stringify(mirror),
    )
  }

  /**
   * Lê, muda a marca, regrava.
   *
   * Não é atômico, e não precisa ser: os dois escritores desta chave são jobs com `jobId`
   * determinístico por item, então duas marcações concorrentes do **mesmo** item não
   * acontecem pelo caminho normal. Se acontecerem, as duas escrevem o mesmo valor.
   */
  async setUnsubscribed(itemId: string, unsubscribed: boolean): Promise<void> {
    const current = await this.find(itemId)

    // Espelho ausente: nada a marcar. Criá-lo aqui gravaria um recurso cuja credencial
    // este repositório não tem.
    if (!current) {
      apiLogger.debug(
        { app: 'payments', itemId, unsubscribed },
        'Espelho do recurso ausente — marca de desassinado não gravada',
      )
      return
    }

    const next: SpaItemResourceMirror = unsubscribed
      ? { ...current, unsubscribedAt: new Date().toISOString() }
      : withoutMark(current)

    await this.redis.set(spaItemResourceMirrorKey(itemId), JSON.stringify(next))
  }

  async remove(itemId: string): Promise<void> {
    await this.redis.del(spaItemResourceMirrorKey(itemId))
  }
}

/** `delete` num objeto novo: o campo tem que **sair**, não virar `undefined` no JSON. */
function withoutMark(mirror: SpaItemResourceMirror): SpaItemResourceMirror {
  const next = { ...mirror }
  delete next.unsubscribedAt

  return next
}

/** Entrada corrompida no Redis não pode derrubar o chamador — vira ausência. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
