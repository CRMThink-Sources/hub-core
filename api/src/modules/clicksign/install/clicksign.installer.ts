import type {
  AppInstallContext,
  AppInstaller,
} from '@/shared/domain/app-installer'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { ensureEventBindings } from '@/shared/infra/clients/ensure-event-bindings'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import {
  CLICKSIGN_APP_CODE_ID,
  CLICKSIGN_CANCEL_HANDLER_PATH,
} from '../clicksign.constants'
import { buildClicksignRobotAddParams } from '../application/build-robot-params'
import {
  SIGNER_PART_FIELD,
  buildSignerPartFieldParams,
} from '../application/build-signer-part-field-params'

export class ClicksignInstaller implements AppInstaller {
  readonly appCode = CLICKSIGN_APP_CODE_ID

  async install({ client }: AppInstallContext): Promise<void> {
    await callBitrixIdempotent(
      client,
      'bizproc.robot.add',
      buildClicksignRobotAddParams(),
    )

    await ensureEventBindings(client, [
      {
        event: 'onCrmTimelineItemAction',
        handler: `${env.apiUrl}${CLICKSIGN_CANCEL_HANDLER_PATH}`,
      },
    ])

    await this.ensureSignerPartField(client)
  }

  /**
   * `crm.contact.userfield.add` não devolve erro distinguível para campo já
   * existente, então a checagem prévia continua sendo a única forma de tornar
   * este passo idempotente.
   */
  private async ensureSignerPartField(client: BitrixRestClient): Promise<void> {
    if (await this.signerPartFieldExists(client)) return

    await callBitrixIdempotent(
      client,
      'crm.contact.userfield.add',
      buildSignerPartFieldParams(),
    )
  }

  private async signerPartFieldExists(
    client: BitrixRestClient,
  ): Promise<boolean> {
    const res = (await client.callMethod('crm.contact.userfield.list', {})) as
      | { result?: Array<{ FIELD_NAME?: string }> }
      | Array<{ FIELD_NAME?: string }>
    const list = Array.isArray(res) ? res : (res.result ?? [])

    return list.some(field => field.FIELD_NAME === SIGNER_PART_FIELD)
  }
}
