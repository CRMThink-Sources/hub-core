import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  Destination,
  ENTITY_TYPE_ID,
  resolveRelatedDestinations,
} from './related-destinations.resolver'

export { ENTITY_TYPE_ID }

type ListDestinationsInput = {
  contextId: string
  placement: string
}

export class ListDestinationsService {
  constructor(private readonly bitrix: BitrixClient) {}

  async execute(input: ListDestinationsInput): Promise<{
    destinations: Destination[]
    entity: Record<string, unknown>
  }> {
    return resolveRelatedDestinations(
      this.bitrix,
      input.placement,
      input.contextId,
    )
  }
}
