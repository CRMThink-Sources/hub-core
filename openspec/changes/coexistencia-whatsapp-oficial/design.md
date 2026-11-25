# Design

## Context

- `@omnizapi/connect` 1.1.1 abre o login da Meta com
  `featureType: whatsapp_business_app_onboarding` e devolve `coexistence`, `wabaId`,
  `code` e `phoneId` (que pode ser `null`).
- O front exige `phoneId` e não envia `coexistence`; `ConnectLineChannelController`
  exige `phoneId`; os dois pontos de `connectChannel` fixam `coexistence: false`.
- `HubmessageWebhookHandlerController` testa primeiro o envelope de status e descarta
  todo `from_me === true`. Envios pela API têm `metadata.from_api: true`.
- A linha Z-API já espelha o aparelho (`MirrorZApiSentByMeMessageUseCase`, change
  `espelhar-mensagens-whatsapp-web`): operador da sessão, prefixo
  `sentFromDevicePrefix`, reservas `MirroredMessageReservations`.
- O worker de saída pula o guard anti-loop em linha HubMessage.

## Goals / Non-Goals

**Goals:** reaproveitar o espelhamento existente; nenhum reenvio ou duplicata; nada
muda para número sem coexistência.

**Non-Goals:** histórico anterior (`INITIAL_DATA`), edição e remoção feitas no
celular, grupos, contagem em limite diário e cadência, guardar o modo no banco.

## Approaches

| | Como | Troca | Escolha |
|---|---|---|---|
| A. Automático | Espelha todo `from_me` sem `from_api` | Sem configuração; não desliga por linha | **Escolhido** |
| B. Chave por linha | Como na Z-API | Controle, mas desligada esconde parte da conversa | Contraria "tudo no chat" |
| C. Só conexão | Adia o espelhamento | Entrega antes, não atende o pedido | Só como queda se o gate falhar |

Dentro do A, o usuário aprovou abrir conversa para contato sem conversa.

## Decisions

1. **Modo de coexistência vem do SDK** e é repassado pelo front. Na API,
   `coexistence` é booleano opcional (default `false`) e `phoneId` só é obrigatório
   sem coexistência. Sem `phoneId`, a implementação envia texto vazio à HubMessage
   (a documentação o declara obrigatório) e a rota legada grava o telefone como nulo.
   O envio vazio é **provisório**: o gate confirma se a HubMessage o aceita.
2. **Gate de validação antes do espelhamento**, com número real em staging, após a
   decisão 1: capturar os payloads de mensagem enviada pelo app e pela API. Confirmar
   evento que entrega, `from_me`/`from_api`, onde vem o contato (esperado
   `recipient.identifier`), se `_id` do webhook é o `messageId` devolvido no envio, e
   formato de mídia. Se não chegar evento, parar e acionar a HubMessage; se o formato
   divergir do esperado, atualizar este design antes de implementar.
3. **Filtro**: só `from_me === true && from_api === false` é enfileirado
   (`source: 'hubmessage'`, `type: 'sent-by-me'`, `jobId` `hubmessage-me-<_id>`).
   `from_api` ausente é descartado: duplicar é pior que não espelhar.
4. **Caso de uso próprio** `MirrorHubMessageSentByMeMessageUseCase`, extraindo do
   espelhamento Z-API a postagem como operador (reserva, row, limpeza) para um
   colaborador comum, em vez de copiar. Alternativa: `if` dentro do inbound — rejeitada
   pelo mesmo motivo registrado no design da Z-API.
5. **Identidade** do contato por `resolveOpenChannelContactId(recipient.identifier)`,
   a mesma do recebimento e do widget. Idempotência por
   `findByProviderMessageId(instance.id, _id)`.
6. **Conversa nova**: sem chat gravado, posta por `imconnector.send.messages` como o
   contato (única forma de abrir a conversa), nome = telefone, e grava a row com
   `bitrixChatId`.
7. **Anti-loop**: o worker de saída passa a consultar a reserva e a row também em
   linha oficial; rows `HUBMESSAGE` contam como cópia (mensagem de operador é gravada
   como `BITRIX`).
8. **Bot**: o processador de bot ignora mensagem que começa com um dos
   `sentFromDevicePrefix` (pt/en/es). Comparar texto não tem a corrida de procurar a
   row, que pode ainda não existir. Vale também para a Z-API, que usa o mesmo prefixo
   e hoje tem a mesma exposição.

## Risks / Trade-offs

- [Eventos do app não chegam] → gate da decisão 2.
- [Mensagem automática nativa do canal aberto (boas-vindas, fora do horário) disparada
  ao abrir conversa chega ao contato] → o ThinkZap não controla; testar no gate de
  staging e orientar a configuração da fila.
- [Contatos particulares atendidos no número aparecem no Bitrix] → aceito pelo pedido.
- [Fluxo de bot ativo continua depois que o atendente responde pelo celular] → mesmo
  comportamento da Z-API; fora do escopo.
- [Contato que digita o aviso do aparelho não é atendido pelo bot] → improvável, aceito.
- [Envios do celular não contam no limite diário] → fora do escopo.

## Migration Plan

Sem migration. Conexão e espelhamento podem ir em deploys separados. Se o gate pedir
novo evento, atualizar `HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS` e rodar
`hubmessage:sync-channel-webhook-events` (efeito real nos canais: confirmar antes).
Rollback: reverter o código; canais conectados em coexistência continuam conectados.

## Open Questions

Resolvidas pelo gate (tarefa 2), antes das tarefas que dependem delas.
