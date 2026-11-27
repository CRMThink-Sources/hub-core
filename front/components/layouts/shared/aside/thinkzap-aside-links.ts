/** Recorte das permissões do ThinkZap que o filtro do menu lê. */
export type ThinkzapAsideAccess = {
  canAccess?: boolean
  canAccessThinkbot?: boolean
}

export type ThinkzapAsideFilterInput = {
  canManageAccess: boolean
  /** `undefined` enquanto a permissão carrega: nada além do gate de admin/bots é cortado. */
  thinkzapAccess: ThinkzapAsideAccess | undefined
  thinkbotMenuEnabled: boolean
}

/** Rotas que exigem `canAccess` (usadas também no bloqueio de rota do layout). */
export const THINKZAP_CAN_ACCESS_HREFS = [
  '/thinkzap',
  '/thinkzap/conexoes',
  '/thinkzap/insights',
  // Envios: qualquer usuário com acesso ao ThinkZap, não só administrador.
  // Operador vê só os próprios envios; esse recorte é da API.
  '/thinkzap/envios',
] as const

/**
 * Decide quais links do menu lateral aparecem. Extraído do layout para ser
 * testável: o item `envios` não pode cair no gate de administração nem no de
 * conexões, ou o operador comum perderia o histórico dos próprios envios.
 */
export function filterThinkzapAsideLinks<T extends { href: string }>(
  links: readonly T[],
  input: ThinkzapAsideFilterInput,
): T[] {
  const { canManageAccess, thinkzapAccess, thinkbotMenuEnabled } = input
  return links.filter(link => {
    if (link.href === '/thinkzap/bots' && !thinkbotMenuEnabled) return false
    if (link.href === '/thinkzap/administracao') return canManageAccess
    if (link.href === '/thinkzap/bots') {
      return thinkzapAccess?.canAccessThinkbot === true
    }
    if ((THINKZAP_CAN_ACCESS_HREFS as readonly string[]).includes(link.href)) {
      return thinkzapAccess?.canAccess === true
    }
    return true
  })
}
