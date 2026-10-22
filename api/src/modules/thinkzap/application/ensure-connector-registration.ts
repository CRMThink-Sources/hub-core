import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { buildConnectorRegisterParams } from '../install/build-connector-register-params'

export type EnsureConnectorRegistrationResult =
  | 'created'
  | 'updated'
  | 'skipped'

/**
 * `imconnector.list` devolve um mapa `ID → nome`. Falha na leitura não impede o
 * registro: só deixa de distinguir criado de atualizado.
 */
async function hasExistingConnector(
  client: BitrixRestClient,
  connectorId: string,
): Promise<boolean> {
  try {
    const list = await client.callMethod('imconnector.list', {})

    return (
      typeof list === 'object' &&
      list !== null &&
      Object.prototype.hasOwnProperty.call(list, connectorId)
    )
  } catch {
    return false
  }
}

/**
 * Re-registra o conector num portal — o mesmo corpo da instalação e do script de
 * re-registro, então também atualiza o `PLACEMENT_HANDLER` (tela do
 * `SETTING_CONNECTOR`), ícone e flags.
 *
 * Sem `BITRIX_CONNECTOR_URL` não registra: o corpo sairia com `PLACEMENT_HANDLER`
 * vazio e apagaria a tela do conector no portal.
 */
export class EnsureConnectorRegistration {
  async execute(
    client: BitrixRestClient,
  ): Promise<EnsureConnectorRegistrationResult> {
    const params = buildConnectorRegisterParams()

    if (!params.PLACEMENT_HANDLER) {
      return 'skipped'
    }

    const existed = await hasExistingConnector(client, String(params.ID))

    await callBitrixIdempotent(client, 'imconnector.register', params)

    return existed ? 'updated' : 'created'
  }
}

export async function ensureConnectorRegistration(
  client: BitrixRestClient,
): Promise<EnsureConnectorRegistrationResult> {
  return new EnsureConnectorRegistration().execute(client)
}
