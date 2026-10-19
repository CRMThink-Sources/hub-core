import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { bindingConditionSchema } from '@/modules/thinkzap/domain/bot-flow/binding-condition'
import type {
  CreateBotFlowBindingRepository,
  DeleteBotFlowBindingRepository,
  GetBotFlowBindingByLineRepository,
  GetBotFlowBindingRepository,
  ListBotFlowBindingsRepository,
  UpdateBotFlowBindingRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { GetBotFlowRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'

// `bindLine` grava o `WELCOME_BOT_ID` na linha e confirma por leitura.
export type WelcomeBotPort = {
  // `flowName` vira o nome do bot no canal aberto.
  ensureBot(
    appId: string,
    flowId: string,
    flowName?: string,
  ): Promise<{ bitrixBotId: number }>
  bindLine(input: {
    appId: string
    lineId: string
    bitrixBotId: number
  }): Promise<void>
  unbindLine(input: { lineId: string }): Promise<void>
  // Só sem outra linha usando o bot.
  removeBotIfUnused(appId: string, flowId: string): Promise<void>
  removeBot(appId: string, flowId: string): Promise<void>
}

export type ConnectorAtivoPort = () => Promise<boolean>

// Só ao atrelar: desligar/remover seguem livres para não prender o bot no canal.
async function exigirConnectorAtivo(connectorAtivo: ConnectorAtivoPort) {
  if (!(await connectorAtivo())) {
    throw thinkzapError('thinkzap.bot.connector_inactive')
  }
}

export class ListBotFlowBindingsController extends Controller {
  constructor(private readonly listBindings: ListBotFlowBindingsRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    const bindings = await this.listBindings.listByAppId(appId)
    return this.ok({ bindings })
  }
}

/** Um fluxo por canal aberto: o Bitrix só guarda um `WELCOME_BOT_ID` por linha. */
const LINHA_OCUPADA =
  'Este canal aberto já tem um fluxo vinculado. Remova o vínculo atual antes de vincular outro.'

export class CreateBotFlowBindingController extends Controller {
  constructor(
    private readonly createBinding: CreateBotFlowBindingRepository,
    private readonly getFlow: GetBotFlowRepository,
    private readonly getBindingByLine: GetBotFlowBindingByLineRepository,
    private readonly welcomeBot: WelcomeBotPort,
    private readonly connectorAtivo: ConnectorAtivoPort,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    const parsed = z
      .object({
        flowId: z.string().min(1),
        lineId: z.string().min(1),
        priority: z.number().int().min(0).max(9999).default(100),
        active: z.boolean().default(true),
        condition: bindingConditionSchema.nullable().default(null),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const flow = await this.getFlow.getById(appId, parsed.data.flowId)
    if (!flow) {
      return this.notFound(new Error('Flow not found'))
    }

    // Rascunho não passou pela validação do grafo.
    if (flow.status !== 'PUBLISHED') {
      return this.badRequest(
        new Error('Publique o fluxo antes de vinculá-lo a uma linha'),
      )
    }

    // Antes da `@@unique`, cujo erro não diz que a linha está ocupada.
    const ocupada = await this.getBindingByLine.getByLineId(
      appId,
      parsed.data.lineId,
    )
    if (ocupada) {
      return this.badRequest(new Error(LINHA_OCUPADA))
    }

    await exigirConnectorAtivo(this.connectorAtivo)

    // Portal antes do banco: o inverso deixaria vínculo salvo com linha sem bot.
    const { bitrixBotId } = await this.welcomeBot.ensureBot(
      appId,
      flow.id,
      flow.name,
    )
    await this.welcomeBot.bindLine({
      appId,
      lineId: parsed.data.lineId,
      bitrixBotId,
    })

    const binding = await this.createBinding.create({
      appId,
      flowId: parsed.data.flowId,
      lineId: parsed.data.lineId,
      priority: parsed.data.priority,
      active: parsed.data.active,
      condition: parsed.data.condition,
    })

    return this.ok({ binding })
  }
}

export class UpdateBotFlowBindingController extends Controller {
  constructor(
    private readonly updateBinding: UpdateBotFlowBindingRepository,
    private readonly getBinding: GetBotFlowBindingRepository,
    private readonly getBindingByLine: GetBotFlowBindingByLineRepository,
    private readonly welcomeBot: WelcomeBotPort,
    private readonly connectorAtivo: ConnectorAtivoPort,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    const params = z
      .object({ bindingId: z.string().min(1) })
      .safeParse(req.params)
    const body = z
      .object({
        lineId: z.string().min(1).optional(),
        priority: z.number().int().min(0).max(9999).optional(),
        active: z.boolean().optional(),
        condition: bindingConditionSchema.nullable().optional(),
      })
      .safeParse(req.body)

    if (!params.success || !body.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    const existing = await this.getBinding.getById(appId, params.data.bindingId)
    if (!existing) {
      return this.notFound(new Error('Binding not found'))
    }

    // Repetir o `lineId` atual no corpo é no-op, não conflito.
    const novaLinha = body.data.lineId
    const mudouLinha = Boolean(novaLinha && novaLinha !== existing.lineId)

    if (novaLinha && mudouLinha) {
      const ocupada = await this.getBindingByLine.getByLineId(appId, novaLinha)
      if (ocupada) {
        return this.badRequest(new Error(LINHA_OCUPADA))
      }
    }

    // Portal antes do banco, como na criação.
    const desativando = body.data.active === false && existing.active
    const deveEstarAtivo = body.data.active ?? existing.active

    // Vínculo ativo sempre reatrela o bot.
    if (deveEstarAtivo) {
      await exigirConnectorAtivo(this.connectorAtivo)
    }

    if (mudouLinha && novaLinha) {
      await this.welcomeBot.unbindLine({ lineId: existing.lineId })

      if (deveEstarAtivo) {
        const { bitrixBotId } = await this.welcomeBot.ensureBot(
          appId,
          existing.flowId,
        )
        await this.welcomeBot.bindLine({
          appId,
          lineId: novaLinha,
          bitrixBotId,
        })
      }
    } else if (desativando) {
      await this.welcomeBot.unbindLine({ lineId: existing.lineId })
    } else if (deveEstarAtivo) {
      // Reatrela mesmo sem transição: o painel do Bitrix pode ter limpado o
      // `WELCOME_BOT_ID` em silêncio. `bindWelcomeBot` é idempotente.
      const { bitrixBotId } = await this.welcomeBot.ensureBot(
        appId,
        existing.flowId,
      )
      await this.welcomeBot.bindLine({
        appId,
        lineId: existing.lineId,
        bitrixBotId,
      })
    }

    const binding = await this.updateBinding.update(
      appId,
      params.data.bindingId,
      body.data,
    )
    return this.ok({ binding })
  }
}

export class DeleteBotFlowBindingController extends Controller {
  constructor(
    private readonly deleteBinding: DeleteBotFlowBindingRepository,
    private readonly getBinding: GetBotFlowBindingRepository,
    private readonly welcomeBot: WelcomeBotPort,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    const parsed = z
      .object({ bindingId: z.string().min(1) })
      .safeParse(req.params)
    if (!parsed.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    const existing = await this.getBinding.getById(appId, parsed.data.bindingId)
    if (!existing) {
      return this.notFound(new Error('Binding not found'))
    }

    // Desliga antes de apagar: o inverso deixaria bot mudo na linha se falhar.
    await this.welcomeBot.unbindLine({ lineId: existing.lineId })

    await this.deleteBinding.delete(appId, parsed.data.bindingId)

    await this.welcomeBot.removeBotIfUnused(appId, existing.flowId)

    return this.ok({ deleted: true })
  }
}
