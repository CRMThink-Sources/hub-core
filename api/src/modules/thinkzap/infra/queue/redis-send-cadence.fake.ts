import type IORedis from 'ioredis'
import {
  CadenceMachineState,
  EMPTY_CADENCE_STATE,
  ordersByDestination,
  registerExternalStep,
  releaseStep,
  reserveStep,
} from '@/modules/thinkzap/domain/send-cadence-machine'
import {
  DEQUEUE_SCRIPT,
  ENQUEUE_SCRIPT,
  PEEK_TURN_SCRIPT,
  REGISTER_EXTERNAL_SCRIPT,
  RELEASE_SCRIPT,
  RESERVE_SCRIPT,
} from './redis-send-cadence'

/** Mesmo prefixo que `queuedLines()` varre: as filas por destinatário ficam de fora. */
const LINE_QUEUE_PREFIX = 'thinkzap:cadence-queue:'

/**
 * Redis de mentira: cada script roda a função equivalente de
 * `send-cadence-machine.ts`, de forma síncrona dentro da chamada — como o Redis,
 * que roda um script por vez. A fila é um mapa id → score ordenado na leitura.
 *
 * Os scripts de fila (`ENQUEUE`, `RESERVE`, `PEEK_TURN`, `DEQUEUE`) espelham o Lua
 * também nas estruturas por destinatário: a fila do destinatário (um `ZSET` por
 * destino) e o mapa ticket → destino (um `HASH` por linha).
 */
export function fakeCadenceRedis() {
  const hashes = new Map<string, CadenceMachineState>()
  const zsets = new Map<string, Map<string, number>>()
  const counters = new Map<string, number>()
  /** `thinkzap:cadence-ticketdest:{linha}`: outboxId → destino. */
  const destMaps = new Map<string, Map<string, string>>()

  const zset = (key: string) => {
    let z = zsets.get(key)
    if (!z) {
      z = new Map()
      zsets.set(key, z)
    }
    return z
  }
  const destMap = (key: string) => {
    let m = destMaps.get(key)
    if (!m) {
      m = new Map()
      destMaps.set(key, m)
    }
    return m
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
      const [seqKey, queueKey, destKey, ticketDestKey, id, , destination] =
        a as [string, string, string, string, string, string, string]
      const seq = (counters.get(seqKey) ?? 0) + 1
      counters.set(seqKey, seq)
      if (!zset(queueKey).has(id)) zset(queueKey).set(id, seq)
      if (destination !== '') {
        if (!zset(destKey).has(id)) zset(destKey).set(id, seq)
        destMap(ticketDestKey).set(id, destination)
      }
      return Promise.resolve(seq)
    }
    if (script === RESERVE_SCRIPT) {
      const [stateKey, queueKey, destKey, ticketDestKey, now, ...rest] = a as [
        string,
        string,
        string,
        string,
        string,
        ...string[],
      ]
      const cfg = cfgOf(rest)
      const [ticketId, ticketSeq, notHeadRetryMs, , destination, perDest] =
        rest.slice(4) as [string, string, string, string, string, string]
      const hasDest = destination !== ''

      if (!zset(queueKey).has(ticketId)) {
        zset(queueKey).set(ticketId, Number(ticketSeq))
      }
      if (hasDest) {
        if (!zset(destKey).has(ticketId)) {
          zset(destKey).set(ticketId, Number(ticketSeq))
        }
        destMap(ticketDestKey).set(ticketId, destination)
      }

      const state = load(stateKey)
      const relaxed =
        hasDest &&
        perDest === '1' &&
        ordersByDestination(state, cfg, Number(now))
      const isHead =
        (relaxed ? ordered(destKey) : ordered(queueKey))[0] === ticketId
      const result = reserveStep(
        state,
        cfg,
        Number(now),
        isHead,
        Number(notHeadRetryMs),
      )
      if (result.outcome.allowed) {
        zset(queueKey).delete(ticketId)
        if (hasDest) {
          zset(destKey).delete(ticketId)
          destMap(ticketDestKey).delete(ticketId)
        }
      }
      hashes.set(stateKey, result.state)
      return Promise.resolve(
        result.outcome.allowed
          ? [1, result.outcome.windowId]
          : [0, result.outcome.retryAt, result.outcome.reason],
      )
    }
    if (script === PEEK_TURN_SCRIPT) {
      const [queueKey, ticketDestKey, id, perDest, destPrefix] = a as [
        string,
        string,
        string,
        string,
        string,
      ]
      if (!zset(queueKey).has(id)) return Promise.resolve(0)
      if (perDest === '1') {
        const dest = destMap(ticketDestKey).get(id)
        if (dest !== undefined && zset(`${destPrefix}${dest}`).has(id)) {
          return Promise.resolve(
            ordered(`${destPrefix}${dest}`)[0] !== id ? 1 : 0,
          )
        }
      }
      return Promise.resolve(ordered(queueKey)[0] !== id ? 1 : 0)
    }
    if (script === DEQUEUE_SCRIPT) {
      const [queueKey, ticketDestKey, id, destPrefix] = a as [
        string,
        string,
        string,
        string,
      ]
      zset(queueKey).delete(id)
      const dest = destMap(ticketDestKey).get(id)
      if (dest !== undefined) {
        zset(`${destPrefix}${dest}`).delete(id)
        destMap(ticketDestKey).delete(id)
      }
      return Promise.resolve(1)
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
    zrange: (key: string, start: number, stop: number) =>
      Promise.resolve(
        ordered(key).slice(start, stop === -1 ? undefined : stop + 1),
      ),
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
        [...zsets.entries()]
          .filter(([key, z]) => key.startsWith(LINE_QUEUE_PREFIX) && z.size > 0)
          .map(([key]) => key),
      ]),
  } as unknown as IORedis

  return { redis, hashes, zsets, destMaps, ordered }
}
