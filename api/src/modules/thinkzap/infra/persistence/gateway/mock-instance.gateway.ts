import { randomUUID } from 'node:crypto'

import type { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import type { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import type { CreateZApiInstanceResponse } from '@/modules/thinkzap/infra/clients/types/z-api.types'

/**
 * Gateway mock para desenvolvimento: evita consumo/limite de instâncias reais na Z-API.
 */
export class MockZApiInstanceGateway
  implements CreateInstanceGateway, UpdateInstanceGateway
{
  create(name: string): Promise<CreateZApiInstanceResponse> {
    const id = `mock-${randomUUID()}`
    const token = `mock-token-${randomUUID()}`

    console.log('[thinkzap] mock z-api instance created', {
      id,
      name,
    })

    return Promise.resolve({
      id,
      token,
      due: 0,
    })
  }

  update(id: string, name: string, token: string): Promise<void> {
    console.log('[thinkzap] mock z-api instance updated', {
      id,
      name,
      hasToken: Boolean(token),
    })

    return Promise.resolve()
  }
}
