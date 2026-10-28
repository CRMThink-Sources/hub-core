import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'

/**
 * Contrato neutro para o ciclo de vida de um conector WhatsApp, independente
 * do provider concreto (Z-API, HubMessage). As implementações vivem em `infra`
 * como adapters e NÃO devem vazar tipos específicos de provider para a aplicação.
 */

/** Dados para provisionar um recurso remoto de conector (instância Z-API | canal HubMessage). */
export type ProvisionConnectorInput = {
  /** Nome legível do recurso (ex.: "<domínio> | instance-<uuid>"). */
  name: string
  /**
   * Retomada idempotente: id remoto já criado (ex.: channelId HubMessage) cujo
   * provisionamento falhou parcialmente. Quando presente, o adapter não recria
   * o recurso — apenas completa os passos faltantes (ex.: webhook).
   */
  existingRemoteId?: string
}

/** Identificadores remotos a persistir na `Instance` após provisionar. */
export type ProvisionedConnectorResource = {
  /** Id remoto principal: instanceId (Z-API) ou channelId (HubMessage). */
  instanceId: string
  status: InstanceStatus
  zApiToken?: string | null
  channelId?: string | null
  webhookId?: string | null
  wabaId?: string | null
  phoneId?: string | null
}

/** Referência a um recurso remoto já provisionado, usada em subscribe/unsubscribe/disconnect. */
export type ConnectorResourceRef = {
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
}

/** Referência para consultar o status de conexão ao vivo de um conector. */
export type ConnectorStatusRef = {
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
  /** WABA do canal (HubMessage) — usado para cruzar com o agregado de conexão. */
  wabaId?: string | null
}

/**
 * Resultado da consulta de status. `available: false` sinaliza que a consulta ao
 * provider falhou e o chamador deve aplicar fallback (ex.: status persistido).
 */
export type ConnectorConnectionStatus = {
  connected: boolean
  available: boolean
}

/**
 * O que o subscribe encontrou no provider: `subscribed` quando a cobrança começou (ou
 * um cancelamento agendado foi desfeito) agora; `already-subscribed` quando o recurso
 * já estava pago. A reconciliação diária usa a diferença para registrar divergência.
 */
export type SubscribeOutcome = 'subscribed' | 'already-subscribed'

export interface WhatsAppConnectorProvider {
  /** Cria o recurso remoto (instância Z-API on-demand | canal HubMessage + webhook). */
  provisionConnector(
    input: ProvisionConnectorInput,
  ): Promise<ProvisionedConnectorResource>

  /** Ativa a cobrança/assinatura do recurso remoto. */
  subscribe(ref: ConnectorResourceRef): Promise<SubscribeOutcome>

  /** Cancela a assinatura do recurso remoto. */
  unsubscribe(ref: ConnectorResourceRef, reason?: string): Promise<void>

  /** Desconecta o recurso remoto (sem cancelar assinatura). */
  disconnect(ref: ConnectorResourceRef): Promise<void>

  /**
   * Consulta o status de conexão ao vivo no provider. NÃO lança erro de provider:
   * em falha, retorna `{ available: false }` para o chamador aplicar fallback.
   */
  getConnectionStatus(
    ref: ConnectorStatusRef,
  ): Promise<ConnectorConnectionStatus>
}
