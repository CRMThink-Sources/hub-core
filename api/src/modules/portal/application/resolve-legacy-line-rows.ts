import { prisma } from '@/config/prisma'

export type LegacyLineRows = {
  /** `Instance.id` — chave das rotas de assinar, desassinar e renomear instância. */
  instanceDbId: string | null
  /** `Connector.id` — chave da rota de reativar conector. */
  connectorId: string | null
  /** `Connector.status`, que é o eixo que a reativação lê. */
  connectorStatus: string | null
  /** `Instance.status`, exibido como estado persistido da instância. */
  instanceStatus: string | null
}

const EMPTY: LegacyLineRows = {
  instanceDbId: null,
  connectorId: null,
  connectorStatus: null,
  instanceStatus: null,
}

/**
 * Rows antigas de uma linha, resolvidas **a partir** do id do provider.
 *
 * Existe porque a listagem do portal admin passou a vir dos itens da SPA, mas três
 * rotas de escrita do admin ainda são keyed por `Instance.id` (assinar, desassinar,
 * renomear) e uma por `Connector.id` (reativar). Nenhuma delas tem equivalente no
 * item: assinatura e reativação são estado das tabelas, não configuração de linha.
 *
 * A inversão é o ponto: `Connector` deixou de decidir **quais** linhas existem e
 * passou a ser consultada **por** linha. Item sem row devolve tudo `null`, e a tela
 * esconde as ações que dependem delas em vez de a linha desaparecer da lista.
 *
 * Some junto com as tabelas — ver `retire-instance-table`.
 */
export async function resolveLegacyLineRows(
  providerLineId: string | null,
): Promise<LegacyLineRows> {
  if (!providerLineId) return EMPTY

  /**
   * Busca por `instanceId` **ou** `channelId`: para Z-API o id do provider vive na
   * primeira coluna; para HubMessage a âncora grava o canal nas duas, mas uma row
   * criada por outro caminho pode ter só `channel_id`.
   */
  const instance = await prisma.instance.findFirst({
    where: {
      OR: [{ instanceId: providerLineId }, { channelId: providerLineId }],
    },
    include: { connector: true },
  })

  if (!instance) return EMPTY

  return {
    instanceDbId: instance.id,
    connectorId: instance.connector?.id ?? null,
    connectorStatus: instance.connector?.status ?? null,
    instanceStatus: instance.status,
  }
}
