import type { ContactIdentityRepository } from '@/modules/thinkzap/domain/repositories/contact-identity.repository'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'

/** De qual elo da cadeia o LID veio. Vai para o log — é o que diz se um elo quebrou. */
export type LidSource =
  | 'chatLid'
  | 'senderLid'
  | 'phone'
  | 'map'
  | 'provider'
  | 'none'

export type ResolvedContactIdentity = {
  /**
   * O valor que vai em `chat.id` e `user.id`. **Não é nome e não é telefone** — para o
   * Bitrix, mudar este valor é criar um contato e uma sessão novos.
   */
  identity: string
  /** O LID, quando a cadeia resolveu um. */
  lid: string | null
  /** Telefone normalizado, quando conhecido. `null` = contato lid-only. */
  phone: string | null
  source: LidSource
  /** `true` = a identidade veio de `legacyPhoneIdentity`, não do LID. */
  legacy: boolean
}

export type ResolveContactIdentityDeps = {
  identityRepo: ContactIdentityRepository
  /**
   * Consulta `phone-exists` na Z-API. Devolve `null` quando a chamada falha — a
   * indisponibilidade do provider não pode derrubar a entrega de uma mensagem que já
   * chegou, então a cadeia apenas segue para o último recurso.
   */
  phoneExists: (
    phone: string,
  ) => Promise<{ exists: boolean; phone: string; lid: string | null } | null>
  /**
   * Quando `false`, a identidade continua sendo a de hoje (telefone normalizado, ou o
   * valor cru quando é lid) — **mas o mapa continua aprendendo os pares**. É o que
   * permite deployar antes do backfill sem mudar comportamento nenhum.
   */
  useLidIdentity: boolean
}

export function isLid(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.includes('@lid')
}

/**
 * A identidade do contato no canal aberto, para linha Z-API.
 *
 * **O problema que isto resolve.** A Z-API entrega o contato ora pelo telefone, ora
 * pelo `@lid`, no mesmo campo `phone` — a doc deles é explícita, e recomenda o LID como
 * chave estável. Como o Bitrix identifica a sessão do canal aberto pela tripla
 * `(CONNECTOR, LINE, chat.id)`, as duas formas produziam dois contatos e duas conversas
 * para a mesma pessoa.
 *
 * **Por que o LID e não o telefone.** É uma assimetria do WhatsApp, não uma preferência:
 * `lid` → telefone é impossível (privacidade), telefone → `lid` é possível
 * (`phone-exists`). Um desenho que faça do telefone a chave precisa resolver "só tenho
 * um lid", que não tem solução. Com o LID como chave, sempre há caminho: o inbound o
 * entrega direto e o widget o alcança pelo número digitado.
 *
 * **Isto reverte uma decisão anterior**, que moveu a identidade do `chatLid` para o
 * telefone porque o widget "não teria como adivinhar" o lid. Estava certo para o que se
 * sabia; o que mudou foi descobrir o `phone-exists`.
 *
 * A ordem da cadeia é por custo: os três primeiros elos já estão no payload, o quarto é
 * uma leitura indexada, e só o quinto vai à rede.
 */
export async function resolveZApiContactIdentity(
  event: {
    phone: string
    chatLid?: string | null
    senderLid?: string | null
  },
  /** `Instance.id` (uuid do banco) — o escopo do mapa, não o id da Z-API. */
  instanceDbId: string,
  deps: ResolveContactIdentityDeps,
): Promise<ResolvedContactIdentity> {
  const raw = event.phone ?? ''
  const phoneIsLid = isLid(raw)

  /**
   * `null` quando o `phone` é um lid — e **não** `normalizePhoneNumber(raw)`.
   *
   * Aquele caminho é o bug silencioso que ninguém tinha visto: o strip de não-dígitos
   * transforma `3577724534928@lid` em `3577724534928`, treze dígitos que não começam com
   * `55` e portanto passam inteiros. Esse valor ia para `user.phone`, e o Bitrix o
   * registrava como telefone do contato — discar por ele liga para um identificador
   * interno do WhatsApp.
   */
  const phone = phoneIsLid || !raw ? null : normalizePhoneNumber(raw)

  let lid: string | null = null
  let source: LidSource = 'none'
  /** Row já em mãos, quando a busca por telefone a trouxe — evita reler por lid. */
  let known: Awaited<ReturnType<ContactIdentityRepository['findByLid']>> = null

  if (event.chatLid) {
    lid = event.chatLid
    source = 'chatLid'
  } else if (event.senderLid) {
    lid = event.senderLid
    source = 'senderLid'
  } else if (phoneIsLid) {
    lid = raw
    source = 'phone'
  } else if (phone) {
    /**
     * Nenhum lid no payload. Esta é a combinação que a regra ingênua ("phone sem `@lid`
     * → usa `chatLid`") deixava virar `null`: `chatLid` nulo só pode coincidir com
     * `phone` numérico, porque quando o `phone` é lid o `chatLid` é dispensável.
     */
    known = await deps.identityRepo.findByPhone(instanceDbId, phone)

    if (known) {
      lid = known.lid
      source = 'map'
    } else {
      const found = await deps.phoneExists(phone)
      if (found?.exists && found.lid) {
        lid = found.lid
        source = 'provider'
      }
    }
  }

  /**
   * Cadeia esgotada. A identidade cai no telefone e o **chamador registra isso**: aquele
   * contato volta a ter identidade instável e é candidato a duplicar.
   *
   * Não lança de propósito. A mensagem do contato é real, e chegar com identidade
   * imperfeita é melhor que não chegar.
   */
  if (!lid) {
    return {
      identity: phone ?? raw,
      lid: null,
      phone,
      source: 'none',
      legacy: false,
    }
  }

  const row = known ?? (await deps.identityRepo.findByLid(instanceDbId, lid))

  // Escreve só quando há o que aprender: row nova, ou telefone que o mapa ainda não
  // tinha. Evento lid-only de contato já mapeado não gera escrita nenhuma.
  if (!row || (phone && !row.phone)) {
    await deps.identityRepo.upsertPair({ instanceId: instanceDbId, lid, phone })
  }

  const legacyIdentity = row?.legacyPhoneIdentity ?? null

  /**
   * Com a flag desligada, a identidade é a de antes desta mudança — mas os `upsert`
   * acima já rodaram. É esse par (aprender sempre, aplicar só com a flag) que permite o
   * deploy anteceder o backfill.
   */
  if (!deps.useLidIdentity) {
    return {
      identity: phoneIsLid ? raw : (phone ?? raw),
      lid,
      phone: phone ?? row?.phone ?? null,
      source,
      legacy: false,
    }
  }

  return {
    identity: legacyIdentity ?? lid,
    lid,
    phone: phone ?? row?.phone ?? null,
    source,
    legacy: Boolean(legacyIdentity),
  }
}

/** Rótulo da resolução para a aba Logs do job. */
export function describeContactIdentity(
  resolved: ResolvedContactIdentity,
): string {
  if (resolved.source === 'none') {
    return (
      `identidade=${resolved.identity} (SEM LID — a cadeia não resolveu: nem chatLid, ` +
      'nem senderLid, nem mapa, nem phone-exists). Este contato fica com identidade de ' +
      'telefone e volta a ser candidato a canal aberto duplicado.'
    )
  }

  return (
    `identidade=${resolved.identity} | lid=${resolved.lid} | origem=${resolved.source}` +
    (resolved.legacy
      ? ' | LEGADO (mantém a sessão aberta antes da mudança)'
      : '')
  )
}
