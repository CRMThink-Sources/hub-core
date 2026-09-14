import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import {
  createResolveGroupMentions,
  type ResolveGroupMentions,
} from '@/modules/thinkzap/application/resolve-group-mentions'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export function makeResolveGroupMentions(): ResolveGroupMentions {
  return createResolveGroupMentions({
    redis: redisConnection,
    zApiClient: new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
  })
}
