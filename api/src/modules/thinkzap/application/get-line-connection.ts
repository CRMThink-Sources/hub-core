import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import type {
  InstanceDataResponse,
  PhoneDataResponse,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { resolveLineBySubscriptionItem } from './helpers/resolve-line-by-subscription-item'

/**
 * Leitura combinada do estado da conexão de uma linha.
 *
 * `instance` carrega `token` (é a resposta crua da Z-API) — por isso o resultado
 * deste caso de uso **não** pode ser serializado direto. Quem decide o que sai é
 * o mapper de apresentação.
 */
export type LineConnectionReading = {
  instance: InstanceDataResponse
  /** `null` quando não conectado, ou quando a leitura do aparelho degradou. */
  phone: PhoneDataResponse | null
}

export class GetLineConnection {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
  }): Promise<LineConnectionReading> {
    const line = await resolveLineBySubscriptionItem(
      input,
      this.getAplicationContext,
    )

    /**
     * Falha aqui **não** degrada. Sem esta leitura não se sabe se a linha está
     * conectada, e responder "desconectada" mandaria o usuário ler um QR code
     * desnecessário. O erro sobe e o controller responde `502`.
     */
    const instance = await this.zApiClient.getInstance(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )

    /**
     * Só quando conectado, e degradando: dados do aparelho são cosméticos.
     * `getPhoneData` já devolve `null` em falha em vez de lançar.
     */
    const phone = instance.connected
      ? await this.zApiClient.getPhoneData(
          line.zApiInstanceId,
          line.zApiInstanceToken,
        )
      : null

    return { instance, phone }
  }
}
