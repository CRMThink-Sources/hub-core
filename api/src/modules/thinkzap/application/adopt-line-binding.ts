import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type {
  BotFlowBinding,
  CreateBotFlowBindingRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { GetBotFlowRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

const log = createWorkerSourceLogger('bitrix')

/**
 * Cria o vínculo do canal que o cliente ligou pelo painel do Bitrix, e não pela nossa tela.
 *
 * O Bitrix não avisa mudança de configuração de linha; o gancho é o `JOINCHAT`, que só
 * chega de canal onde o bot **está** configurado. O fluxo adotado é o dono do bot.
 * Bot órfão ou fluxo fora do ar → fila.
 */
export async function adoptLineBinding(
  appId: string,
  lineId: string,
  botFlowId: string | null,
  deps: {
    flows: GetBotFlowRepository
    bindings: CreateBotFlowBindingRepository
  },
): Promise<BotFlowBinding | null> {
  const flow = botFlowId ? await deps.flows.getById(appId, botFlowId) : null

  if (!flow || flow.status !== 'PUBLISHED') {
    log.warn(
      { appId, lineId, botFlowId, status: flow?.status ?? null },
      'Canal configurado no painel com bot sem fluxo publicado para adotar',
    )
    return null
  }

  // `priority` e `condition` no default: os dois são reservados (um fluxo por canal), e
  // adivinhar condição aqui esconderia do cliente uma regra que ele não escreveu.
  const binding = await deps.bindings.create({
    appId,
    flowId: flow.id,
    lineId,
    priority: 100,
    active: true,
    condition: null,
  })

  log.info(
    { appId, lineId, flowId: flow.id, bindingId: binding.id },
    'Canal adotado: bot configurado pelo painel do Bitrix ganhou vínculo',
  )

  return binding
}
