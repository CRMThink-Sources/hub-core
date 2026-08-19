import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { resolveLineEntitlement } from '@/modules/thinkzap/domain/connector-trial'

/**
 * O mínimo que a tela de configuração do robô precisa por linha.
 *
 * Shape próprio, como `WidgetTemplate` e `WidgetLineStatus` fazem: a rota é aberta a
 * qualquer usuário Bitrix com JWT, e `WidgetLine` carrega `channelId`, `instanceId`,
 * `settings` e o aparelho da Z-API — nada disso configura automação, e tudo isso é
 * superfície que não precisa sair daqui.
 */
export type TemplateLineOption = {
  /** Id do item de assinatura: é este valor que a propriedade `connector` guarda. */
  id: string
  name: string
}

export type ListTemplateLinesInput = {
  domainId: string
  appCode: string
}

/**
 * As linhas da instalação **capazes de enviar template**, para a tela do robô.
 *
 * Três filtros, e cada um evita uma automação que nasceria quebrada:
 *
 * 1. **Assinatura ativa.** Linha bloqueada ou de trial vencido é recusada pelo
 *    disparo; oferecê-la aqui é entregar ao usuário uma automação que só falha na
 *    primeira execução, longe da tela onde ele poderia entender o motivo.
 * 2. **Provider HubMessage.** Template não existe na Z-API. O resolver já recusa sem
 *    tocar no provider, mas a recusa chegaria como erro de disparo em vez de linha
 *    ausente da lista.
 * 3. **Canal conectado (`wabaId`).** Canal criado e número ainda não conectado não
 *    tem catálogo de template para listar — a ação do cliente é concluir a conexão,
 *    não configurar automação.
 *
 * Sem consulta ao provider: a tela precisa dos nomes para montar o select, e o estado
 * de conexão ao vivo custaria uma chamada por linha na abertura do slider. Quem
 * confere o estado real é a listagem de templates, logo em seguida.
 */
export class ListTemplateLinesUseCase {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(input: ListTemplateLinesInput): Promise<TemplateLineOption[]> {
    /**
     * O escopo sai daqui: `GetAplicationContext` resolve a instalação pelo par
     * (`domainId`, `appCode`) do JWT e só devolve as assinaturas dela. Linha de outra
     * instalação não está na árvore, então não há como alcançá-la.
     */
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const now = new Date()

    return context.subscriptions.flatMap(subscription =>
      resolveLineEntitlement(subscription, now) === 'active'
        ? subscription.items
            .filter(
              item =>
                item.metadata.provider === 'HUBMESSAGE' &&
                Boolean(item.metadata.wabaId),
            )
            .map(item => ({ id: item.id, name: item.name }))
        : [],
    )
  }
}
