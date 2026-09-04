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

// Injetado para o controller não conhecer o Bitrix. `bindLine` grava o `WELCOME_BOT_ID`
// na linha e confirma por leitura de volta.
export type WelcomeBotPort = {
  // `flowName` vai para o perfil do bot no portal: é o que o cliente vê na configuração
  // do canal aberto. Um bot e um fluxo por instalação, então o nome não é ambíguo.
  ensureBot(appId: string, flowName?: string): Promise<{ bitrixBotId: number }>
  bindLine(input: { lineId: string; bitrixBotId: number }): Promise<void>
  unbindLine(input: { lineId: string }): Promise<void>
  // Só quando nenhuma linha usa mais: o bot é um por instalação, e desregistrá-lo com
  // outro canal vinculado pararia aquele atendimento.
  removeBotIfUnused(appId: string): Promise<void>
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

    // Só publicado entra em linha: rascunho não passou pela validação do grafo.
    if (flow.status !== 'PUBLISHED') {
      return this.badRequest(
        new Error('Publique o fluxo antes de vinculá-lo a uma linha'),
      )
    }

    // Antes da `@@unique` estourar: o erro de constraint do MySQL não diz que a linha
    // já está ocupada.
    const ocupada = await this.getBindingByLine.getByLineId(
      appId,
      parsed.data.lineId,
    )
    if (ocupada) {
      return this.badRequest(new Error(LINHA_OCUPADA))
    }

    // Portal antes do banco: gravar primeiro deixaria o vínculo salvo com a linha sem
    // bot (tela mostra fluxo ativo, nada entra). Falhar aqui só custa um bot registrado
    // sem uso, reaproveitado no próximo vínculo.
    const { bitrixBotId } = await this.welcomeBot.ensureBot(appId, flow.name)
    await this.welcomeBot.bindLine({
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

    // Mudança de linha e alternância de `active` precisam chegar ao portal antes de
    // gravar: falha depois do banco deixaria linha antiga com bot sem fluxo (bot mudo)
    // ou bot atendendo por um vínculo que a tela mostra como desligado.
    const desativando = body.data.active === false && existing.active
    const reativando = body.data.active === true && !existing.active

    if (mudouLinha && novaLinha) {
      await this.welcomeBot.unbindLine({ lineId: existing.lineId })

      if (body.data.active ?? existing.active) {
        const { bitrixBotId } = await this.welcomeBot.ensureBot(appId)
        await this.welcomeBot.bindLine({ lineId: novaLinha, bitrixBotId })
      }
    } else if (desativando) {
      await this.welcomeBot.unbindLine({ lineId: existing.lineId })
    } else if (reativando) {
      const { bitrixBotId } = await this.welcomeBot.ensureBot(appId)
      await this.welcomeBot.bindLine({
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

    // Desligar o bot vem antes de apagar o vínculo, por ser o passo que pode falhar:
    // vínculo apagado com bot ainda ativo na linha deixaria o bot mudo (o Bitrix
    // entrega ao bot e não há fluxo para rodar). Nesta ordem a falha é repetível.
    await this.welcomeBot.unbindLine({ lineId: existing.lineId })

    await this.deleteBinding.delete(appId, parsed.data.bindingId)

    // Era o último vínculo: o bot não atende mais nada e sai do portal.
    await this.welcomeBot.removeBotIfUnused(appId)

    return this.ok({ deleted: true })
  }
}
