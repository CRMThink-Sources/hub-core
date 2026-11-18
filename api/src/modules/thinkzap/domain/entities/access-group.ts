/**
 * Grupo de acesso do widget: quais linhas (itens da SPA de assinaturas, por
 * `subscriptionItemId`) os membros (usuários do Bitrix) podem usar ao enviar pelo
 * widget.
 */
export type AccessGroup = {
  id: string
  appId: string
  name: string
  memberIds: string[]
  lineIds: string[]
  createdAt: Date
  updatedAt: Date
}

export type AccessGroupInput = {
  name: string
  memberIds: string[]
  lineIds: string[]
}
