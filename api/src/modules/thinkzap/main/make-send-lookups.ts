import type { Request } from 'express'
import { env } from '@/config/env'
import { effectiveSendHistoryDays } from '@/modules/thinkzap/domain/send-list-filters'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { BitrixSendSenderNamesAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-send-sender-names.adapter'
import { ContextSendLineCatalog } from '@/modules/thinkzap/infra/adapters/context-send-line-catalog.adapter'
import { PrismaSendListRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeBitrixClient } from '../../../shared/main/make-bitrix-client'

/**
 * As dependências comuns da lista e do detalhe da aba Envios. O cliente Bitrix é
 * por requisição (credencial da instalação do token) e criado só quando há nomes
 * a resolver, para que 400 e falha de credencial não derrubem a lista; o catálogo de linhas usa o contexto com repositórios cacheados.
 */
export function makeSendLookups(req: Request) {
  const historyDays = effectiveSendHistoryDays(env.thinkzapSendHistoryDays)
  return {
    historyDays,
    sends: new PrismaSendListRepository(() => new Date(), historyDays),
    locales: makeInstallationLocaleRepository(),
    lines: new ContextSendLineCatalog(makeGetAplicationContext()),
    senderNames: new BitrixSendSenderNamesAdapter(() => makeBitrixClient(req)),
  }
}
