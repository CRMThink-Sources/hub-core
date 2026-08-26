import type { Request } from 'express'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { createAgent } from '../application/create-agent'
import {
  reconcileAgents,
  type ReconciliationReport,
} from '../application/reconcile-agents'
import type { Agent, CreateAgentInput } from '../domain/entities/agent'
import { gptmakerError } from '../errors/catalog'
import { GptMakerClient } from '../infra/clients/gptmaker.client'
import {
  forAgent,
  type ScopedAgentClient,
} from '../infra/clients/scoped-agent.client'
import { ImbotGateway } from '../infra/bitrix/imbot.gateway'
import { PrismaAgentRepository } from '../infra/persistence/repositories/prisma-agent.repository'

const installedApps = new PrismaInstalledAppRepository()

export const agentRepository = new PrismaAgentRepository()
export const gptmakerLogger = apiLogger

/**
 * A instância do client cru é **privada deste módulo**, de propósito.
 *
 * Exportá-la daria a qualquer controller um objeto capaz de `updateAgent(id)` e
 * `deleteAgent(id)` com um id arbitrário — e o workspace é compartilhado, então
 * esse id pode ser o agente de outro cliente. Quem precisa do vendor por agente
 * usa `scopeTo`; quem precisa criar (operação que ainda não tem agente para
 * escopar) usa `createAgentForApp`.
 */
const client = new GptMakerClient()

/**
 * O `core_apps.id` da instalação que está fazendo a requisição.
 *
 * `req.appId` é o **appCode** (`crmthink.gptmaker`), não a instalação — quem
 * identifica a instalação é o par appCode + domínio. Este id é o que escopa
 * tudo em `core_gpt_agents`.
 */
export async function resolveAppId(req: Request): Promise<string> {
  const { appId: appCodeId, domainId } = req

  if (!appCodeId || !domainId) {
    throw gptmakerError('gptmaker.app.context_missing')
  }

  const app = await installedApps.getByAppCodeAndDomainId(appCodeId, domainId)

  if (!app) throw gptmakerError('gptmaker.app.context_missing')

  return app.id
}

/**
 * Constrói o cliente escopado de um agente, provando a posse antes.
 *
 * É a única forma de o módulo alcançar o vendor por agente — ver
 * `agent-isolation.test.ts`.
 */
export function scopeTo(
  appId: string,
  gptMakerAgentId: string,
): Promise<ScopedAgentClient> {
  return forAgent(agentRepository, client, appId, gptMakerAgentId)
}

/**
 * Cria um agente para a instalação.
 *
 * Envolve `createAgent` aqui para que o client cru não precise atravessar a
 * camada de apresentação: criar é a única operação que não tem um agente para
 * escopar — ele ainda não existe.
 */
export function createAgentForApp(
  appId: string,
  input: CreateAgentInput,
): Promise<Agent> {
  return createAgent(
    { agents: agentRepository, client, logger: gptmakerLogger },
    appId,
    input,
  )
}

/** Compara o workspace compartilhado com `core_gpt_agents`. */
export function runReconciliation(): Promise<ReconciliationReport> {
  return reconcileAgents({ agents: agentRepository, client })
}

export async function makeImbotGateway(req: Request): Promise<ImbotGateway> {
  // Sem cast: `BitrixClient` devolve o envelope (`{ result, time }`) e o
  // gateway o desembrulha. Fingir que era `BitrixRestClient`, que já devolve
  // `result`, fazia `imbot.register` ler NaN de um bot recém-criado.
  return new ImbotGateway(await makeBitrixClient(req))
}

/**
 * URL que o Bitrix chama nos eventos de mensagem do bot.
 *
 * Declarada no `EVENT_HANDLER` de **cada bot**, na criação dele — é por isso
 * que o installer da aplicação não registra evento nenhum.
 */
export function botEventHandlerUrl(): string {
  return `${env.apiUrl}/gptmaker/webhooks/message`
}
