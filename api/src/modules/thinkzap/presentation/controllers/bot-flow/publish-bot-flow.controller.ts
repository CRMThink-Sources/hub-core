import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { validateFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type {
  GetBotFlowRepository,
  PublishBotFlowRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import type { ListBotFlowBindingsRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { WelcomeBotPort } from './bot-flow-binding.controllers'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

export class PublishBotFlowController extends Controller {
  constructor(
    private readonly publishFlow: PublishBotFlowRepository,
    private readonly getFlow: GetBotFlowRepository,
    private readonly welcomeBot?: WelcomeBotPort,
    private readonly listBindings?: ListBotFlowBindingsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = z.object({ flowId: z.string().min(1) }).safeParse(req.params)
    if (!parsed.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    const existing = await this.getFlow.getById(appId, parsed.data.flowId)
    if (!existing) {
      return this.notFound(new Error('Flow not found'))
    }

    // Portão: nó órfão ou ciclo sem espera deixaria o cliente falando sozinho.
    const issues = validateFlowGraph(existing.graph)
    if (issues.length > 0) {
      // À mão e não `badRequest`: o editor precisa das `issues` para marcar os cards.
      return {
        status: 400,
        result: {
          error: 'O fluxo tem problemas que impedem a publicação',
          issues,
        },
      }
    }

    const flow = await this.publishFlow.publish(appId, parsed.data.flowId)

    await this.sincronizarNomeNoPortal(appId, flow.id, flow.name)

    return this.ok({ flow })
  }

  /**
   * Leva o nome do fluxo ao perfil do bot, que é o rótulo que o cliente vê na
   * configuração do canal aberto.
   *
   * Aqui e não no `update`: renomear é edição de rascunho, e depender do portal ali faria
   * salvar falhar com o Bitrix fora. Publicar já é o momento de "vai ao ar".
   *
   * Só com vínculo do fluxo: sem canal ligado não existe bot registrado, e criar um para
   * renomear poria um bot no portal do cliente sem nada para atender.
   *
   * Falha não sobe: o fluxo **foi** publicado, e recusar a resposta faria o usuário
   * republicar atrás de um erro que é só cosmético no portal.
   */
  private async sincronizarNomeNoPortal(
    appId: string,
    flowId: string,
    flowName: string,
  ): Promise<void> {
    if (!this.welcomeBot || !this.listBindings) return

    try {
      const vinculos = await this.listBindings.listByAppId(appId)
      if (!vinculos.some(binding => binding.flowId === flowId)) return

      await this.welcomeBot.ensureBot(appId, flowId, flowName)
    } catch (error) {
      logThinkzapError(
        log,
        'thinkzap.bot.register_failed',
        { appId, err: error instanceof Error ? error.message : String(error) },
        { level: 'warn' },
      )
    }
  }
}
