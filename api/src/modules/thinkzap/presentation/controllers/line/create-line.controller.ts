import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  CreateAdditionalLine,
  ManualModalityCannotCreateLineError,
  NoLineToExtendError,
  PlanDoesNotPriceProviderError,
} from '@/modules/thinkzap/application/create-additional-line'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
} from '@/modules/thinkzap/application/helpers/build-contract-line-items'
import { ProvisionedResourceWithoutCredentialError } from '@/modules/thinkzap/application/helpers/line-resource-metadata'

/**
 * `strict()` e não `object()`: preço, quantidade, período e credencial são derivados
 * no servidor, e um corpo que os traga é **recusado** em vez de ignorado.
 *
 * Ignorar seria funcionalmente equivalente hoje, e mentiroso amanhã: no dia em que
 * um campo homônimo entrar no schema, um corpo antigo passaria a ser aceito com
 * significado novo. A recusa é o que torna "o cliente não escolhe quanto paga"
 * verificável.
 *
 * Também **não** aceita a intenção nem o caminho de cobrança: quem decide entre
 * ajustar a assinatura existente e abrir checkout é o estado da instalação. Aceitar
 * pelo corpo deixaria o cliente pedir "acrescenta sem cobrar".
 */
const bodySchema = z.strictObject({
  provider: z.union([z.literal('ZAPI'), z.literal('HUBMESSAGE')]),
  planId: z.string().min(1),
})

const installationSchema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `POST /api/thinkzap/lines` — cria uma linha adicional.
 *
 * Duas respostas possíveis, e a tela distingue pelo campo presente: `line` quando a
 * linha nasceu no mesmo request (o contrato já existia no gateway), e `clientSecret`
 * quando falta pagar — aí a tela monta o checkout embedado.
 *
 * A credencial da linha criada **não** volta aqui: o mapper de linha existe para
 * isso, e a tela só precisa saber que a linha apareceu.
 */
export class CreateLineController extends Controller {
  constructor(private readonly createLine: CreateAdditionalLine) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const installation = installationSchema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!installation.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    const body = bodySchema.safeParse(req.body ?? {})
    if (!body.success) {
      return this.badRequest(
        new Error(
          'Corpo inválido: informe apenas o conector (ZAPI ou HUBMESSAGE) e o id do ' +
            'plano — preço, quantidade e período são definidos no servidor',
        ),
      )
    }

    try {
      const result = await this.createLine.execute({
        ...installation.data,
        provider: body.data.provider,
        planId: body.data.planId,
      })

      if (result.kind === 'checkout') {
        return this.ok({ clientSecret: result.clientSecret })
      }

      return this.ok({
        line: {
          id: result.item.id,
          name: result.item.name,
          status: result.item.status,
          provider: result.item.metadata.provider,
        },
      })
    } catch (error) {
      if (error instanceof PlanDoesNotPriceProviderError) {
        return this.badRequest(error)
      }
      /**
       * `409` para os três: são conflito com o estado da instalação ou com a
       * configuração do catálogo, e nenhum se resolve mandando outro corpo — que é o
       * que um `400` sugeriria.
       */
      if (
        error instanceof NoLineToExtendError ||
        error instanceof ManualModalityCannotCreateLineError ||
        error instanceof PlanForProviderMissingError ||
        error instanceof PlanForProviderAmbiguousError
      ) {
        return this.conflict(error)
      }
      /**
       * `502`, e não o `500` genérico: o provider respondeu sem o dado que a linha
       * exige. É falha de terceiro, esperada e nomeada — cair no `500` registraria
       * "erro inesperado" e responderia `Internal server error`, que esconde do
       * cliente a única informação que importa aqui: **nada foi cobrado**.
       */
      if (error instanceof ProvisionedResourceWithoutCredentialError) {
        return this.badGateway(error)
      }
      throw error
    }
  }
}
