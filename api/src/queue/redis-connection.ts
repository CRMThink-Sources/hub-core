import { env } from '@/config/env'
import IORedis from 'ioredis'

const redisUrl = env.redisUrl
if (!redisUrl) throw new Error('REDIS_URL is required')

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
})
