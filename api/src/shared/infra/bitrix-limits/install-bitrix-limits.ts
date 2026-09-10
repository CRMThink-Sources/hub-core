import { createLogger } from '@/shared/infra/logger'
import { redisConnection } from '@/queue/redis-connection'
import { setBitrixLimits } from './bitrix-limits.port'
import { RedisBitrixLimits } from './redis-bitrix-limits'

/**
 * Liga o controle de limites no processo.
 *
 * Módulo separado porque importar `redisConnection` de dentro do cliente Bitrix faria
 * toda suíte de teste unitária exigir Redis. Aqui a dependência é explícita e só os
 * entrypoints (`index.ts`, workers) a puxam; sem esta chamada o app roda com o
 * controle desligado, como antes.
 */
export function installBitrixLimits(): void {
  setBitrixLimits(new RedisBitrixLimits(redisConnection))

  createLogger({ service: 'hubthink-shared', source: 'bitrix-limits' }).info(
    { bitrixLimitsInstalled: true },
    'Controle de limites do Bitrix ativo (balde por portal + pausa por método)',
  )
}
