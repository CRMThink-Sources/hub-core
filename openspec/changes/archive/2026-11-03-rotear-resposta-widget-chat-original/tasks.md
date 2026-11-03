# Tasks

## 1. Confirmar a causa no caso real

- [ ] 1.1 Consultar `phone-exists` da Z-API para `5547984050811` e `554784050811` na instância usada pela assinatura 89 (crmthink) e registrar o que cada forma devolve (`exists`, `phone`, `lid`); decide se a seção 5 entra
- [ ] 1.2 Conferir no banco a linha do mapa de identidade do LID `109788054704155@lid` (telefone e `legacyPhoneIdentity` após o recebimento de 30/10)

## 2. Fixação de identidade no repositório

- [x] 2.1 Adicionar `pinLegacyIdentity({ instanceId, lid, chatId })` a `ContactIdentityRepository` e implementar no `PrismaContactIdentityRepository`: grava `legacyPhoneIdentity` só se estiver vazia, cria a linha do LID se não existir, devolve se gravou
- [x] 2.2 Reescrever o comentário de `upsertPair`/`legacyPhoneIdentity` no domínio: a coluna passa a ter dois autores (backfill e fixação por conversa aberta), nunca por `upsertPair`
- [x] 2.3 Testes do repositório: grava quando vazia, não sobrescreve, cria a linha quando o LID é novo

## 3. Roteamento pela citação no recebimento

- [x] 3.1 Criar caso de uso/função `resolveReplyChatRoute` que, dado `referenceMessageId`, instância e identidade resolvida, lê a mensagem citada e devolve o `chat.id` da conversa aberta quando ela existe, pertence à instância e ao mesmo contato, e tem `bitrixChatId`
- [x] 3.2 Usar o resultado em `process-z-api-inbound-message.use-case.ts` antes de `const chatId = identity.identity`, apenas no 1:1; o grupo não muda
- [x] 3.3 Quando o `chat.id` roteado difere de `identity.identity` e há LID, chamar `pinLegacyIdentity` e registrar no log do job (`lid`, `chatId`, `messageId`, fixou ou já existia)
- [x] 3.4 Testes: resposta com citação de conversa aberta usa o `chat.id` do envio; mensagem seguinte sem citação usa o mesmo `chat.id`; citação desconhecida/sem `bitrixChatId`/de outra instância mantém a identidade resolvida; identidade igual não grava fixação; não sobrescreve fixação existente
- [x] 3.5 Teste de regressão com o caso real: envio com `chat.id = 5547984050811`, resposta com `chatLid = 109788054704155@lid` e `referenceMessageId` do botão → uma única sessão

## 4. Log da resolução no envio

- [x] 4.1 Fazer `makeResolveWidgetOpenChannelContact` devolver `source` e `legacy` da cadeia
- [x] 4.2 Em `EnsureWidgetOpenChannelConversation`/job de abertura, logar o resultado de `describeContactIdentity` e, para `source: 'none'`, o aviso de identidade instável
- [x] 4.3 Ajustar os testes de `ensure-widget-open-channel-conversation` para o novo retorno

## 5. 9º dígito no envio (somente se 1.1 confirmar)

- [ ] 5.1 No resolvedor do widget, quando o número normalizado for BR móvel e a cadeia terminar sem LID, repetir mapa e `phone-exists` com a forma sem o 9
- [ ] 5.2 Testes: contato cadastrado sem o 9 resolve o LID na segunda consulta; contato com 9 não faz consulta extra; número não BR não é alterado

## 6. Verificação

- [x] 6.1 Rodar os testes do módulo thinkzap e o typecheck da API
- [ ] 6.2 Em staging, enviar um botão pelo widget a um número novo (sem linha no mapa), responder e conferir uma única sessão no Bitrix; mandar uma segunda mensagem sem citação e conferir a mesma sessão
