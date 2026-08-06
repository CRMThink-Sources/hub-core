import { Controller } from '@/shared/presentation/controller'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { GetLineStatusForWidget } from '../application/get-line-status-for-widget'
import { GetLineStatusForWidgetController } from '../presentation/controllers/get-line-status-for-widget.controller'
import { makeConnectorProviderResolver } from './make-connector-provider-resolver'
import { makeLineDeps } from './line/make-line-deps'

/**
 * `DisconnectExpiredLine` **não** entra aqui, ao contrário de
 * `makeGetLineConnectionController`: trocar de linha num select do widget não pode
 * agendar desconexão como efeito de leitura.
 *
 * O resolver de providers entrou no lugar do `ZApiClient` direto: a leitura de status
 * vale para as duas famílias de linha desde que o widget passou a compor template em
 * linha oficial. Mesma montagem de `listLinesForWidget` — `instanceGateway` é exigido
 * pelo adapter Z-API para provisionar, caminho que esta leitura nunca percorre.
 */
export const makeGetLineStatusForWidgetController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeLineDeps()

  return new GetLineStatusForWidgetController(
    new GetLineStatusForWidget(
      getAplicationContext,
      makeConnectorProviderResolver({
        zApiClient,
        instanceGateway: new ZApiInstanceGateway(zApiClient),
      }),
    ),
  )
}
