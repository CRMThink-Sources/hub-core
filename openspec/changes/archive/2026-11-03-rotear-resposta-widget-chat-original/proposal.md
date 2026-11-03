# Proposal

## Why

Quando o operador envia uma mensagem com botões pelo widget do CRM (linha Z-API) e o contato responde, a resposta pode abrir um **segundo canal aberto** no Bitrix em vez de cair na conversa criada no envio. Caso real (crmthink, 30/10/2026 ~14:31 BRT, contato Bruna Lissaraça): o envio criou o chat `97349` com `chat.id = 5547984050811` (telefone); a resposta "Sim!" chegou com `referenceMessageId` apontando para a mensagem do botão e foi postada com `chat.id = 109788054704155@lid`, criando a sessão `83655` / chat `97351`. O operador passa a ver a conversa partida em duas, e a sessão do envio fica sem resposta.

A causa é que, no envio, a cadeia de identidade (`resolveZApiContactIdentity`) não achou o LID do destino (mapa vazio e `phone-exists` sem LID) e caiu no telefone; na resposta o LID chega no payload (`chatLid`) e vira a identidade. As duas direções passam a usar chaves diferentes para o mesmo contato, e o Bitrix identifica a sessão por `(CONNECTOR, LINE, chat.id)`.

## What Changes

- A resposta recebida de um contato que cita (`referenceMessageId`) uma mensagem enviada pelo widget com conversa já aberta SHALL ser postada na **mesma conversa** do canal aberto (mesmo `chat.id`), em vez de usar a identidade resolvida pelo LID.
- Ao rotear assim, o sistema SHALL fixar a identidade do contato (LID → `chat.id` da conversa existente) para que as mensagens seguintes **sem** citação também caiam no mesmo chat, e não só a primeira resposta.
- Quando a cadeia de identidade do widget esgotar sem LID, o sistema SHALL registrar isso de forma explícita no log do job de abertura (hoje não há log nenhum da resolução no envio pelo widget).
- Verificar (e tratar, se confirmado) se o `phone-exists` falha para números brasileiros cadastrados no WhatsApp sem o 9º dígito, tentando também a variante sem o 9.

Sem **BREAKING**: contatos sem citação, sem conversa prévia do widget ou já com identidade estável mantêm o comportamento atual.

## Capabilities

### New Capabilities
- `thinkzap/roteamento-resposta-canal-aberto`: como a resposta de um contato é associada à conversa do canal aberto quando a conversa foi aberta por uma mensagem enviada pelo widget (identidade do contato, citação da mensagem original e fixação da identidade).

### Modified Capabilities
<!-- Nenhuma: não há spec existente cobrindo identidade de contato / roteamento de resposta. -->

## Impact

- `api/src/modules/thinkzap/application/process-z-api-inbound-message.use-case.ts` — passo de identidade do contato (hoje ignora `referenceMessageId` para roteamento).
- `api/src/modules/thinkzap/application/resolve-zapi-contact-identity.ts` e `domain/repositories/contact-identity.repository.ts` — novo meio de fixar identidade em runtime (hoje `legacyPhoneIdentity` é escrita só pelo backfill).
- `api/src/modules/thinkzap/main/make-resolve-widget-open-channel-contact.ts` e `application/ensure-widget-open-channel-conversation.ts` — log da resolução e variante do 9º dígito.
- `PrismaThinkzapMessageRepository.findByProviderMessageId` — leitura de `bitrixChatId`/`chatId` da mensagem citada.
- Sem mudança de API pública, schema de banco novo ou dependência nova (a coluna `legacyPhoneIdentity` já existe).
