import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type {
  BotFlowBinding,
  CreateBotFlowBindingRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { ListBotFlowsRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

const log = createWorkerSourceLogger('bitrix')

/**
 * Cria o vínculo do canal que o cliente ligou pelo painel do Bitrix, e não pela nossa tela.
 *
 * O bot é um por instalação e o cliente pode pôr o mesmo bot como bot de saudação de
 * qualquer canal aberto pelo Contact Center. Antes disso, esse canal caía em `sem-vinculo`
 * e a conversa ia para a fila: o bot entrava, não tinha fluxo para rodar e saía. Do lado do
 * cliente parecia defeito — ele configurou o bot e o bot não atendeu.
 *
 * O Bitrix não tem evento de mudança de configuração de linha, então não há como reagir ao
 * clique dele. O gancho é o próprio `JOINCHAT`: o portal só convoca o bot num canal onde
 * ele **está** configurado, e é isso que autoriza a adoção — não inventamos vínculo, só
 * registramos o que o cliente já decidiu no painel.
 *
 * Um fluxo publicado é a condição, e não uma escolha nossa: com dois, qualquer um que
 * rodássemos seria um palpite sobre a intenção do cliente, e o palpite errado atende o
 * cliente dele com o fluxo errado. Nenhum ou vários → fila, o mesmo desfecho de antes.
 *
 * O vínculo nasce igual ao da tela — aparece na lista, e desvincular por lá desliga o bot
 * do canal no portal. Recolocá-lo pelo painel readota: é a mesma decisão do cliente, de
 * novo.
 */
export async function adoptLineBinding(
  appId: string,
  lineId: string,
  deps: {
    flows: ListBotFlowsRepository
    bindings: CreateBotFlowBindingRepository
  },
): Promise<BotFlowBinding | null> {
  const publicados = (await deps.flows.listByAppId(appId)).filter(
    flow => flow.status === 'PUBLISHED',
  )

  if (publicados.length !== 1) {
    log.warn(
      { appId, lineId, publicados: publicados.length },
      publicados.length === 0
        ? 'Canal configurado no painel e nenhum fluxo publicado para adotar'
        : 'Canal configurado no painel e mais de um fluxo publicado — sem como escolher',
    )
    return null
  }

  const flow = publicados[0]!

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
