import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { deleteSmsSenderByCode } from '@/modules/thinkzap/application/delete-sms-sender'
import type { DeleteSmsSenderResult } from '@/modules/thinkzap/application/delete-sms-sender'
import {
  listSmsSenders,
  type RegisteredSmsSender,
} from '@/modules/thinkzap/application/list-sms-senders.service'
import {
  listLineItemsForApp,
  type AppContextDeps,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { fromSmsSenderCode } from '@/modules/thinkzap/application/helpers/sms-sender-code'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { AdminAppNotFoundError } from './helpers/resolve-admin-line'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

/**
 * Uma linha da instalação e se ela já tem provedor registrado.
 *
 * Vai junto dos senders porque a tela precisa das duas metades para ser operável: só
 * com os senders, um portal que ainda não registrou nada mostra lista vazia e nenhuma
 * ação — a aba vira um beco, e o admin tem de descobrir sozinho que registrar mora no
 * modal da linha.
 */
export type SmsProviderLine = {
  subscriptionItemId: string
  name: string
  /** `ZAPI` ou `HUBMESSAGE` — a tela usa para o aviso de risco de bloqueio. */
  provider: string
  registered: boolean
}

export type ListSmsProvidersForAppOutput = {
  senders: RegisteredSmsSender[]
  lines: SmsProviderLine[]
}

/**
 * O que existe dos dois lados: as linhas da instalação e os provedores de mensagem
 * registrados no portal do cliente, cada sender marcado como vinculado a uma linha ou
 * **órfão**.
 *
 * As linhas vêm da SPA e os senders do Bitrix; o cruzamento é o ponto da rota. Sender
 * órfão continua na lista de campanha do cliente e faz toda campanha disparada por ele
 * falhar destinatário por destinatário, sem nada na tela dizendo por quê — esta é a
 * única superfície onde ele é visível.
 */
export async function listSmsProvidersForApp(
  appId: string,
  deps: AppContextDeps = defaultDeps(),
): Promise<ListSmsProvidersForAppOutput> {
  const lines = await listLineItemsForApp(appId, deps)

  if (!lines) throw new AdminAppNotFoundError(appId)

  const { client } = await resolveBitrixClientForApp(appId)
  const senders = await listSmsSenders(client, lines.items)

  const registered = new Set(
    senders
      .map(sender => sender.subscriptionItemId)
      .filter((id): id is string => Boolean(id)),
  )

  return {
    senders,
    lines: lines.items.map(item => ({
      subscriptionItemId: item.id,
      name: item.name,
      provider: item.metadata.provider,
      registered: registered.has(item.id),
    })),
  }
}

/**
 * `CODE` que não é do ThinkZap chegando na rota de remoção.
 *
 * A rota recebe o `CODE` cru — é o único jeito de alcançar um órfão, que não tem item
 * de onde derivá-lo. O guard existe porque `messageservice.sender.delete` apaga
 * qualquer sender do portal, inclusive o de outro fornecedor: sem ele, a tela do nosso
 * admin viraria um botão para desligar a integração de terceiros no Bitrix do cliente.
 */
export class ForeignSmsSenderCodeError extends Error {
  constructor(readonly code: string) {
    super(
      `O provedor "${code}" não é do ThinkZap e não pode ser removido por esta tela`,
    )
    this.name = 'ForeignSmsSenderCodeError'
  }
}

/**
 * Remove um sender pelo `CODE` cru — o caminho do **órfão**.
 *
 * Separado de `deleteSmsProviderForApp` porque não há item de onde derivar o `CODE`:
 * a linha que o gerou já não existe, e é exatamente por isso que ele precisa sair.
 */
export async function deleteSmsProviderByCodeForApp(
  appId: string,
  code: string,
): Promise<{ result: DeleteSmsSenderResult }> {
  if (!fromSmsSenderCode(code)) {
    throw new ForeignSmsSenderCodeError(code)
  }

  const { client } = await resolveBitrixClientForApp(appId)

  return { result: await deleteSmsSenderByCode(client, code) }
}

const defaultDeps = (): AppContextDeps => ({
  getApp: new PrismaInstalledAppRepository(),
  getAplicationContext: makeGetAplicationContext(),
})
