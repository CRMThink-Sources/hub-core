import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  DeleteLineSmsProvider,
  GetLineSmsProvider,
  RegisterLineSmsProvider,
} from '@/modules/thinkzap/application/manage-line-sms-provider'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `GET /api/thinkzap/lines/:itemId/sms-provider` — se a linha aparece como provedor
 * de mensagem na campanha de SMS do Bitrix do cliente.
 *
 * Rota própria e não um campo em `/settings`: saber o estado custa uma chamada ao
 * Bitrix (`messageservice.sender.list`), e pendurá-la na leitura de ajustes poria uma
 * ida à rede — e uma falha possível — em toda abertura da aba.
 */
export class GetLineSmsProviderController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      return this.ok(
        await new GetLineSmsProvider(this.getAplicationContext).execute(
          input,
          this.bitrixClient,
        ),
      )
    } catch (error) {
      return mapLineError(error, 'Falha ao ler o provedor de mensagem da linha')
    }
  }
}

/**
 * `POST .../sms-provider` — o cliente registra a própria linha como provedor.
 *
 * O aviso de risco de bloqueio em linha `ZAPI` e a ciência explícita vivem na tela:
 * esta rota não recebe confirmação. Exigir um campo de "li e aceito" no corpo daria
 * a impressão de que a recusa é do servidor, quando a decisão — e o número — são do
 * cliente.
 */
export class RegisterLineSmsProviderController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      return this.ok(
        await new RegisterLineSmsProvider(this.getAplicationContext).execute(
          input,
          this.bitrixClient,
        ),
      )
    } catch (error) {
      return mapLineError(error, 'Falha ao registrar o provedor de mensagem')
    }
  }
}

/** `DELETE .../sms-provider` — tira a linha da lista de provedores da campanha. */
export class DeleteLineSmsProviderController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      return this.ok(
        await new DeleteLineSmsProvider(this.getAplicationContext).execute(
          input,
          this.bitrixClient,
        ),
      )
    } catch (error) {
      return mapLineError(error, 'Falha ao remover o provedor de mensagem')
    }
  }
}
