/**
 * Mensagem recebida, editada e excluída no Contact Center.
 *
 * Os dois últimos alimentam a sincronização de edição e exclusão do operador com o
 * WhatsApp. Ficam em constantes próprias porque a ação do backoffice que corrige
 * portais sem os binds liga exatamente estes dois — duas listas divergiriam no
 * primeiro evento novo.
 */
export const CONNECTOR_MESSAGE_SYNC_EVENTS = [
  'ONIMCONNECTORMESSAGEUPDATE',
  'ONIMCONNECTORMESSAGEDELETE',
] as const

export const CONNECTOR_MESSAGE_EVENTS = [
  'ONIMCONNECTORMESSAGEADD',
  ...CONNECTOR_MESSAGE_SYNC_EVENTS,
] as const
