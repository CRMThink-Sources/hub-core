import { CreateZApiInstanceResponse } from '@/modules/thinkzap/infra/clients/types/z-api.types'

export interface CreateInstanceGateway {
  create(name: string): Promise<CreateZApiInstanceResponse>
}
