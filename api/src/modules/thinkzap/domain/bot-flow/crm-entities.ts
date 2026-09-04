/**
 * Vínculos de CRM do chat, lidos do `entity_data_2` de `imopenlines.dialog.get`.
 *
 * Formato: pares `TIPO|ID` concatenados — `LEAD|1209|COMPANY|0|CONTACT|0|DEAL|0`. O `0`
 * é "não vinculado", e o Bitrix cria o lead sozinho no primeiro contato, então o campo
 * que separa cliente de desconhecido é `CONTACT`.
 *
 * Parser separado porque posicional falha em silêncio: um par a mais no meio devolveria
 * o id de outra entidade, e o fluxo desviaria pelo ramo errado sem nenhum erro.
 */

export type CrmEntities = {
  leadId: string
  contactId: string
  companyId: string
  dealId: string
}

const VAZIO: CrmEntities = {
  leadId: '',
  contactId: '',
  companyId: '',
  dealId: '',
}

/** `'0'` e `''` são o mesmo "não tem": o Bitrix usa zero para ausência. */
function id(valor: string | undefined): string {
  const texto = (valor ?? '').trim()
  return texto && texto !== '0' ? texto : ''
}

export function parseCrmEntities(entityData2: unknown): CrmEntities {
  if (typeof entityData2 !== 'string') return VAZIO

  const partes = entityData2.split('|')
  const porTipo = new Map<string, string>()

  // Lê por par e não por índice: a ordem dos tipos não é contrato, e assumi-la faria o
  // parser devolver o id de uma entidade no lugar de outra.
  for (let i = 0; i + 1 < partes.length; i += 2) {
    const tipo = partes[i]?.trim().toUpperCase()
    if (tipo) porTipo.set(tipo, partes[i + 1] ?? '')
  }

  return {
    leadId: id(porTipo.get('LEAD')),
    contactId: id(porTipo.get('CONTACT')),
    companyId: id(porTipo.get('COMPANY')),
    dealId: id(porTipo.get('DEAL')),
  }
}

type DialogGetResponse = { result?: { entity_data_2?: unknown } }

export function crmEntitiesFromDialog(response: unknown): CrmEntities {
  return parseCrmEntities(
    (response as DialogGetResponse | undefined)?.result?.entity_data_2,
  )
}

/**
 * Variáveis que o fluxo enxerga desde o primeiro passo, sem o cliente ter respondido nada.
 *
 * Nomes fixos porque são contrato com o bloco de condição que o editor oferece pronto:
 * renomear aqui quebra todo fluxo já publicado que os use.
 */
export function crmVars(entities: CrmEntities): Record<string, string> {
  return {
    contatoId: entities.contactId,
    leadId: entities.leadId,
    empresaId: entities.companyId,
    negocioId: entities.dealId,
  }
}
