# Design

## Context

Ver `proposal.md` (Why). Estado atual observado:

- Todo comentário de timeline passa por `BitrixLivefeedNotificationService.execute({contextId, entity, message})`, que chama `crm.timeline.comment.add` com o `BitrixClient` da **credencial da instalação**. O método não aceita autor explícito: o autor é o dono do token.
- O widget grava `operatorBitrixUserId` em `ThinkzapWidgetOutbox` (já existe) e o envio síncrono com anexo (`send-widget-message.use-case.ts`) recebe o mesmo dado. O comentário do envio pela fila nasce no worker (`workers/thinkzap-widget-send.processor.ts`, `notifySentFor`/`makeNotifier`), não na request.
- Os robôs (`bitrix-robot`, `bitrix-template-robot`, `bitrix-button-robot`) recebem `auth.user_id` no payload e comentam via `commentOnCrmTimeline`.
- Já existe `ResolveOperatorBitrixAccessToken(domain, bitrixUserId)` (tabela `thinkzap_operator_oauth`, com refresh) e `BitrixClient.withUserToken`, usados no espelhamento de mensagens do operador. Retorna `null` quando o operador nunca autorizou; lança se o refresh falha.
- Os textos ficam em `domain/notices/timeline-notices.ts`, por idioma (pt/en/es), com testes.

## Goals / Non-Goals

**Goals**
- Autor do comentário = remetente, com fallback seguro (ver spec `comentario-timeline-envio`).
- Layout novo, centralizado num único lugar, com a mesma estrutura nos três idiomas.

**Non-Goals**
- Não mudar o envio ao contato, as filas, a idempotência (`timelineNotifiedAt`) nem a política de retentativa.
- Não criar fluxo novo de autorização OAuth do operador, nem migration.
- Não mexer no front.
- Não alterar comentários que não são de envio (instalação, desconexão de linha, cadência).

## Decisions

1. **Autor entra no contrato, não em cada chamador.** `SendNotificationInput` ganha `authorBitrixUserId?: string`. `BitrixLivefeedNotificationService` recebe uma dependência opcional `resolveAuthorClient(domain, userId)` (devolve `Pick<BitrixClient,'callMethod'> | null`). Com autor e token: publica com o client do usuário; senão, ou se a chamada for recusada, publica com o client da instalação. Alternativa descartada: cada caso de uso resolver o token e chamar `callMethod` direto, o que duplicaria o fallback em vários lugares.
2. **Fallback só em recusa explícita, no máximo uma publicação extra.** Erro de rede/timeout na chamada do usuário é ambíguo (o comentário pode ter sido gravado), e `comment.add` não é idempotente. Só resposta explícita do Bitrix de acesso negado ou token inválido/expirado aciona o fallback; o resto propaga como hoje (os chamadores já tratam sem lançar).
3. **Remetente no corpo quando cai no fallback.** O fallback é decidido no serviço, depois de o texto já estar montado; por isso o chamador passa `senderLine` (do catálogo: `timelineNotices(locale).sentBy`) em vez de o nome entrar no texto. O serviço anexa a linha `Enviado por: <nome>` só no fallback. O nome vem de `user.get` com a credencial da instalação; falha ao obter o nome apenas omite a linha.
4. **Remetente no robô: `auth.user_id` do payload**, tratado como candidato. Vazio, `0` ou sem token resolvível → fallback. Ver Open Questions.
5. **Layout em BBCode nativo**, num helper único em `domain/notices/` usado por `timeline-notices.ts`: título em `[B]`, linhas `[B]Rótulo:[/B] valor`, mensagem em `[QUOTE]`. Rótulos vêm do catálogo de idioma. A linha `Template:` fica literal e idêntica nos três idiomas (conciliação da cobrança da Meta, já documentada no código).
6. **Dados do usuário não são marcação.** Mensagem, nomes e telefones passam por `escapeBbcode`: cada `[` ganha um U+200B (zero-width) logo depois, o que impede que `[/quote]` ou `[url]` digitados pelo operador quebrem o layout sem alterar o que se lê. Alternativa descartada: remover colchetes, que altera o texto.
7. **Emoji de aviso mantido** nas falhas, dentro do título em negrito; a orientação ao operador permanece.

## Risks / Trade-offs

- [Token de usuário sem permissão na entidade] → cai no fallback; comentário sai como hoje.
- [Poucos operadores com autorização guardada no início, efeito pouco visível] → o fallback identifica o nome no texto; log `authorMode: 'operator' | 'installation'` mede a cobertura real.
- [Refresh do token lança] → capturado na resolução; vira fallback com log `warn`, nunca falha o job.
- [Comentário duplicado se a 1ª chamada gravou mas devolveu erro] → fallback só em erro explícito de acesso/token (Decisão 2).
- [Testes dos textos mudam] → atualizar `timeline-notices.test.ts`, `notices-catalog.test.ts` e testes dos controllers; conferir que `Template:` segue igual.

## Migration Plan

Sem migration nem env. Deploy normal (develop → staging). Rollback: reverter o commit; comentários já publicados não são alterados. Validar em staging com um operador autorizado e outro não (homologação e produção dividem o mesmo portal Bitrix).

## Open Questions

- O `auth` do payload do robô é do usuário que iniciou o fluxo ou do dono do robô/app? Confirmar com um envio real em staging. Se não vier usuário útil, o fallback cobre e a autoria do robô só vale quando houver `auth.user_id` com token resolvível. Se o payload trouxer `refresh_token`, avaliar guardar o token (como `captureOperatorOAuthFromEvent`), o que ampliaria o escopo: decidir antes da task 4.3.
