/**
 * `core_domains.member_id` é `@unique`. Um portal que chega na instalação com um
 * `member_id` já pertencente a outro domínio é inconsistência de dados — o
 * Bitrix não reaproveita `member_id` entre portais — e precisa de intervenção,
 * não de retry.
 */
export class MemberIdAlreadyLinkedError extends Error {
  constructor(memberId: string, ownerDomain: string) {
    super(`member_id "${memberId}" já pertence ao domínio "${ownerDomain}"`)
    this.name = 'MemberIdAlreadyLinkedError'
  }
}
