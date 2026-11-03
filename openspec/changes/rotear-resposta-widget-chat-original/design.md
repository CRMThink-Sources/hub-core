# Design

## Context

Em linha Z-API a identidade do contato no canal aberto (`chat.id`/`user.id`) vem de `resolveZApiContactIdentity`: `chatLid` → `senderLid` → `phone` lid → mapa `lid↔telefone` → `phone-exists` → telefone. Com `THINKZAP_ZAPI_LID_IDENTITY=true` (confirmado em api, worker e widget-outbound em produção) a identidade é o LID (ou `legacyPhoneIdentity` do contato, quando existe). O Bitrix identifica a sessão por `(CONNECTOR, LINE, chat.id)`, então mudar o valor cria sessão nova.

Dois caminhos usam a mesma cadeia, mas com entradas diferentes:

- **Envio pelo widget** (`make-resolve-widget-open-channel-contact.ts`): só conhece o número digitado; cai em mapa e `phone-exists`. Se nada devolver LID, a identidade é o telefone.
- **Recebimento** (`process-z-api-inbound-message.use-case.ts`): o payload traz `chatLid`, então a identidade é o LID.

No caso investigado, o mapa estava vazio (contato novo) e a identidade do envio caiu no telefone (`chat.id = 5547984050811`, chat 97349). A resposta trouxe o LID e abriu o chat 97351. O payload da resposta já trazia `referenceMessageId` (a mensagem do botão), que hoje só alimenta a citação (`build-reply-quote`). A mensagem do envio já guarda `bitrixChatId` (sessão) e `chatId` (o `contactId` usado como `chat.id`) via `updateOpenChannelRefs`.

Causa de `phone-exists` não devolver LID no caso: **não confirmada**. Hipótese: o número está cadastrado no WhatsApp sem o 9º dígito (o payload da resposta trouxe `554784050811`) e a consulta com o 9 não casa. A tarefa 1 confirma isso antes de implementar a parte do 9º dígito.

## Goals / Non-Goals

**Goals:**
- A resposta a uma mensagem do widget cai sempre na conversa aberta no envio, independentemente de a identidade do envio ter sido LID ou telefone.
- As mensagens seguintes do mesmo contato, sem citação, continuam na mesma conversa.
- Falha de resolução do LID no envio fica visível no log do job.

**Non-Goals:**
- Unificar ou migrar conversas duplicadas que já existem (como a 97349/97351 de 30/10); isso é tratamento operacional.
- Mudar a regra de identidade para contatos sem conversa aberta pelo widget.
- Alterar o provider oficial (HubMessage), cuja identidade já é o telefone nos dois lados.
- Backfill do mapa de identidade.

## Decisions

**1. Rotear pela citação, no recebimento (decisão principal).** Antes de usar `identity.identity` como `chat.id`, se o evento tem `referenceMessageId`, ler a mensagem citada (`findByProviderMessageId(instance.id, referenceMessageId)`). Se ela tiver `chatId` (identificador de chat gravado no envio) e `bitrixChatId`, usar esse `chatId` como `chat.id` da resposta.
- *Por quê:* é a única informação que liga as duas direções sem depender de resolver LID↔telefone, que o WhatsApp não permite no sentido LID→telefone. Cobre qualquer causa de falha da cadeia no envio, não só o 9º dígito.
- *Alternativa descartada — corrigir só o envio (mais tentativas de `phone-exists`):* não cobre contato cujo telefone digitado nunca resolve (lid-only, número trocado) e deixa o defeito reaparecer.
- *Alternativa descartada — usar o telefone como identidade também no recebimento:* reverte a decisão documentada em `resolve-zapi-contact-identity.ts` (LID é a única chave sempre alcançável).

**2. Fixar a identidade ao rotear.** Quando o `chat.id` roteado difere de `identity.identity` e há LID resolvido, gravar no mapa `legacyPhoneIdentity = chatId da conversa` para esse `(instância, lid)`; a cadeia já devolve `legacyPhoneIdentity ?? lid`, então as mensagens seguintes sem citação caem no mesmo chat sem outra mudança de leitura.
- *Consequência:* a invariante atual do repositório ("`legacyPhoneIdentity` é só do backfill, nunca do runtime") precisa ser ajustada. A razão da invariante é não promover contato novo a legado sem sessão existente; aqui a escrita só acontece com **conversa real já aberta**, o que preserva essa razão. Será um método próprio (`pinLegacyIdentity`), separado de `upsertPair`, que **nunca sobrescreve** um valor já preenchido, e a invariante será reescrita no comentário do repositório.
- *Alternativa descartada — fixar só em memória/por mensagem:* a segunda mensagem sem citação reabriria o problema.

**3. Só roteia por conversas do widget com sessão aberta.** A mensagem citada precisa ter `bitrixChatId` preenchido (conversa realmente aberta). Mensagem desconhecida, sem referência, ou de outra instância não muda nada (cai na identidade resolvida).

**4. Log explícito no envio.** O resolvedor do widget passa a devolver também `source`/`legacy` da cadeia e o job de abertura loga `source: 'none'` com a mensagem equivalente à do recebimento (`describeContactIdentity`).

**5. 9º dígito (condicionado à tarefa 1).** Se a hipótese se confirmar, no resolvedor do widget, quando `phone-exists` do número normalizado não devolver LID e o número for BR móvel, repetir a consulta (e a busca no mapa) com a forma sem o 9. Fica atrás do mesmo ponto de entrada, sem mudar `normalizePhoneNumber`, que é usado em todo o sistema.

## Risks / Trade-offs

- **Citação de mensagem de outro contato/chat:** `referenceMessageId` só é aceito se a mensagem pertencer à mesma instância e ao mesmo contato (LID ou telefone mapeado). Sem essa checagem, uma citação cruzada postaria na conversa errada. Mitigação: validar a pertença na leitura e, na dúvida, não rotear.
- **Fixação errada é persistente:** gravar `legacyPhoneIdentity` incorreto prende o contato numa conversa errada. Mitigação: nunca sobrescrever, gravar só com sessão aberta e logar cada fixação com `lid`, `chatId` e `messageId`.
- **Corrida:** duas respostas simultâneas citando a mesma mensagem. Mitigação: a fixação é idempotente (mesmo valor); sem sobrescrita, a segunda vira no-op.
- **Conversas já duplicadas não são consertadas** (fora de escopo); o próximo contato dessas pessoas, se citar uma mensagem do widget, será roteado para a conversa do envio e fixado.
