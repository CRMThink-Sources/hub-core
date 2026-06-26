import { redisConnection } from '@/queue/redis-connection'

const DONE_TTL_S = 7 * 24 * 60 * 60

const doneKey = (scope: string, id: string): string =>
  `clicksign:done:${scope}:${id}`

export async function isProcessed(scope: string, id: string): Promise<boolean> {
  return (await redisConnection.exists(doneKey(scope, id))) === 1
}

// Chamar só após o efeito colateral concluir.
export async function markProcessed(scope: string, id: string): Promise<void> {
  await redisConnection.set(doneKey(scope, id), '1', 'EX', DONE_TTL_S)
}
