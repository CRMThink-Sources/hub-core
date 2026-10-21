import type IORedis from 'ioredis'
import {
  CadenceMachineState,
  EMPTY_CADENCE_STATE,
  registerExternalStep,
  releaseStep,
  reserveStep,
} from '@/modules/thinkzap/domain/send-cadence-machine'
import {
  ENQUEUE_SCRIPT,
  REGISTER_EXTERNAL_SCRIPT,
  RELEASE_SCRIPT,
  RESERVE_SCRIPT,
} from './redis-send-cadence'

/**
 * Redis de mentira: cada script roda a função equivalente de
 * `send-cadence-machine.ts`, de forma síncrona dentro da chamada — como o Redis,
 * que roda um script por vez. A fila é um mapa id → score ordenado na leitura.
 */
export function fakeCadenceRedis() {
  const hashes = new Map<string, CadenceMachineState>()
  const zsets = new Map<string, Map<string, number>>()
  const counters = new Map<string, number>()

  const zset = (key: string) => {
    let z = zsets.get(key)
    if (!z) {
      z = new Map()
      zsets.set(key, z)
    }
    return z
  }
  const ordered = (key: string) =>
    [...zset(key).entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)
  const load = (key: string) => hashes.get(key) ?? { ...EMPTY_CADENCE_STATE }

  const cfgOf = (args: string[]) => ({
    enabled: args[0] === '1',
    maxMessages: Number(args[1]),
    windowMs: Number(args[2]),
    pauseMs: Number(args[3]),
  })

  const evalScript = (script: string, _n: number, ...a: string[]) => {
    if (script === ENQUEUE_SCRIPT) {
      const [seqKey, queueKey, id] = a as [string, string, string]
      const seq = (counters.get(seqKey) ?? 0) + 1
      counters.set(seqKey, seq)
      if (!zset(queueKey).has(id)) zset(queueKey).set(id, seq)
      return Promise.resolve(seq)
    }
    if (script === RESERVE_SCRIPT) {
      const [stateKey, queueKey, now, ...rest] = a
      const cfg = cfgOf(rest)
      const [ticketId, ticketSeq, notHeadRetryMs] = rest.slice(4) as [
        string,
        string,
        string,
      ]
      if (!zset(queueKey!).has(ticketId)) {
        zset(queueKey!).set(ticketId, Number(ticketSeq))
      }
      const isHead = ordered(queueKey!)[0] === ticketId
      const { state, outcome } = reserveStep(
        load(stateKey!),
        cfg,
        Number(now),
        isHead,
        Number(notHeadRetryMs),
      )
      if (outcome.allowed) zset(queueKey!).delete(ticketId)
      hashes.set(stateKey!, state)
      return Promise.resolve(
        outcome.allowed
          ? [1, outcome.windowId]
          : [0, outcome.retryAt, outcome.reason],
      )
    }
    if (script === REGISTER_EXTERNAL_SCRIPT) {
      const [stateKey, now, ...rest] = a
      hashes.set(
        stateKey!,
        registerExternalStep(load(stateKey!), cfgOf(rest), Number(now)),
      )
      return Promise.resolve(1)
    }
    if (script === RELEASE_SCRIPT) {
      const [stateKey, windowId] = a as [string, string]
      hashes.set(stateKey, releaseStep(load(stateKey), Number(windowId)))
      return Promise.resolve(1)
    }
    throw new Error('script desconhecido')
  }

  const redis = {
    eval: evalScript,
    zrem: (key: string, id: string) => {
      zset(key).delete(id)
      return Promise.resolve(1)
    },
    zrange: (key: string) => Promise.resolve(ordered(key)),
    zcard: (key: string) => Promise.resolve(zset(key).size),
    hgetall: (key: string) => {
      const s = hashes.get(key)
      if (!s) return Promise.resolve({})
      return Promise.resolve(
        Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])),
      )
    },
    scan: () =>
      Promise.resolve([
        '0',
        [...zsets.entries()].filter(([, z]) => z.size > 0).map(([key]) => key),
      ]),
  } as unknown as IORedis

  return { redis, hashes, zsets, ordered }
}
