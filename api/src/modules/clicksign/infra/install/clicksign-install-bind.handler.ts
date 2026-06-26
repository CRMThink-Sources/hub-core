import type {
  BitrixInstallBind,
  BitrixInstallBindHandler,
} from '@/shared/domain/bitrix-install-bind'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import {
  CLICKSIGN_APP_CODE_ID,
  CLICKSIGN_CANCEL_HANDLER_PATH,
} from '../../clicksign.constants'
import { buildClicksignRobotAddParams } from '../../application/build-robot-params'
import {
  SIGNER_PART_FIELD,
  buildSignerPartFieldParams,
} from '../../application/build-signer-part-field-params'

export class ClicksignInstallBindHandler implements BitrixInstallBindHandler {
  appCode = CLICKSIGN_APP_CODE_ID

  getBinds(): BitrixInstallBind[] {
    return [
      {
        method: 'bizproc.robot.add',
        params: buildClicksignRobotAddParams(),
      },
      {
        method: 'event.bind',
        params: {
          event: 'onCrmTimelineItemAction',
          handler: `${env.apiUrl}${CLICKSIGN_CANCEL_HANDLER_PATH}`,
        },
      },
    ]
  }

  async onInstall(client: BitrixRestClient): Promise<void> {
    const exists = await this.signerPartFieldExists(client)
    if (exists) return
    await client.callMethod(
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
