import type { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { deleteAgent } from '@/modules/gptmaker/application/delete-agent'
import { listAgents } from '@/modules/gptmaker/application/list-agents'
import {
  agentRepository,
  createAgentForApp,
  gptmakerLogger,
  resolveAppId,
  scopeTo,
} from '@/modules/gptmaker/main/make-gptmaker-deps'

/** O `:agentId` da rota — id do agente no vendor, vindo do cliente. */
const agentIdSchema = z.string().min(1, 'Informe o agente')

const communicationType = z.enum(['FORMAL', 'NORMAL', 'RELAXED'])
const agentType = z.enum(['SUPPORT', 'SALE', 'PERSONAL'])

const createAgentSchema = z.object({
  name: z.string().min(1, 'Informe o nome do agente'),
  avatar: z.string().url().optional(),
  behavior: z.string().optional(),
  jobName: z.string().optional(),
  jobSite: z.string().optional(),
  // Obrigatorio no vendor: sem ele a criacao volta
  // 400 {"error":"jobDescription is required"}. Barrar aqui troca esse erro de
  // integracao por uma mensagem de validacao, sem gastar a ida ao GPT Maker.
  jobDescription: z.string().min(1, 'Informe a descricao do trabalho'),
  communicationType: communicationType.optional(),
  type: agentType.optional(),
})

export class ListAgentsController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)

    return this.ok(
      await listAgents(
        { agents: agentRepository, logger: gptmakerLogger, scopeTo },
        appId,
      ),
    )
  }
}

export class CreateAgentController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const input = createAgentSchema.parse(req.body)

    return this.ok(await createAgentForApp(appId, input))
  }
}

export class GetAgentController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))

    return this.ok({ ...scoped.local, vendor: await scoped.fetch() })
  }
}

export class DeleteAgentController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))

    await deleteAgent({ agents: agentRepository }, scoped)

    return this.ok({ deleted: true })
  }
}
