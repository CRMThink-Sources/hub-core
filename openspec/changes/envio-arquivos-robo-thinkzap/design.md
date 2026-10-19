# Design

## Context

O robô "Enviar mensagem" é registrado por `buildThinkzapRobotAddParams` (propriedades `connector`, `destination`, `sendToAllRelatedContacts`, `message`) e atendido por `BitrixRobotWebhookHandlerController`. O handler resolve a linha com `findLineInContext` — que já recusa provider diferente de `ZAPI` com `LineProviderNotSupportedError` —, resolve os destinatários, e para cada telefone chama `zApiClient.sendMessage` dentro de `sendWithinDailyQuota`. No fim, comenta na timeline com `timelineNotices(locale).sendRobot.result`.

O envio de mídia ao Z-API já existe em dois lugares: `ZApiOutboundSender` (resposta do operador no canal aberto; recebe URL e converte áudio para mp3) e `SendWidgetMessageUseCase.sendAttachment` (widget; recebe data URL base64). O `OutboundMessageDescriptor` (`kind`, `text` como legenda, `url`, `fileName`, `mime`) é o contrato neutro de uma parte.

`EnsureThinkzapRobot` faz `bizproc.robot.add` e, se o robô já existe, `bizproc.robot.update` com as mesmas propriedades — é assim que portais existentes recebem a nova propriedade.

## Goals / Non-Goals

**Goals:**
- Reaproveitar o `OutboundMessageDescriptor` e o `ZApiOutboundSender` para enviar as partes, sem um terceiro caminho de mídia para o Z-API.
- Baixar cada arquivo do Bitrix uma vez por disparo, não uma vez por destinatário.

**Non-Goals:**
- Linha oficial (HubMessage) no robô "Enviar mensagem" — continua recusada.
- Persistir as mensagens do robô na tabela de mensagens ou abrir conversa no canal aberto: o robô de texto também não faz isso hoje.
- Fila assíncrona para o robô: o envio continua síncrono no webhook, como hoje.

## Decisions

### 1. Propriedade `file` múltipla no robô existente
`PROPERTIES.file = { Name: 'File', Type: 'file', Multiple: 'Y' }`, e `message` deixa de ser tratado como obrigatório no handler. Escolhido pelo usuário em vez de um robô separado: um fluxo que já envia texto ganha arquivo sem trocar de robô, e o robô antigo é atualizado pelo `bizproc.robot.update` existente.

### 2. Ler o valor do arquivo por um normalizador tolerante
A documentação do Bitrix não detalha o formato que chega ao handler REST para `Type: 'file'`. Antes de escrever o parser, a primeira tarefa captura um disparo real (valor fixo enviado na configuração e campo de arquivo do negócio, com um e com vários arquivos). Um `parseRobotFiles(raw)` isolado converte o que chegar — string, array ou objeto por índice (formato do `express.urlencoded` com `extended: true`) — numa lista de referências `{ url, name? }`. Se o valor for id de arquivo do Disk em vez de URL, o normalizador resolve via REST (`disk.file.get` → `DOWNLOAD_URL`) com o token do próprio evento. Isolar a leitura deixa o resto do fluxo igual qualquer que seja o formato confirmado.

### 3. Baixar no servidor e enviar como base64
As URLs de arquivo do Bitrix exigem autenticação do portal, e o Z-API baixa a URL sem credencial. Por isso o handler baixa cada arquivo uma vez (com o `access_token` do evento quando a URL não for pública), obtém nome, mime e tamanho, e passa ao Z-API como data URL base64 — o mesmo formato que o widget já usa. Alternativa descartada: repassar a URL ao Z-API, que falharia para arquivos privados do portal.

Limite de 30 MB por arquivo, alinhado ao `limit: '30mb'` do body parser da API e ao tamanho que o JSON base64 para o Z-API suporta com folga. Arquivo maior é descartado com motivo.

### 4. Classificar por mime, com extensão como reserva
Um `classifyRobotFile({ mime, name })` devolve `image | video | audio | document` usando a lista do spec. Quando o Bitrix não envia mime (ou envia o genérico `application/octet-stream`), decide uma tabela própria de extensões que devolve tipo e mime — `guessMimeTypeFromFileName` não conhece 3gp, opus, m4a, aac e oga. Tipo desconhecido vira `document`, nunca é descartado.

### 5. Montar partes com a mesma regra do canal aberto
Uma função pura `buildRobotParts(message, files)` aplica a regra de `toOutboundDescriptors` do processor: texto vira legenda do primeiro arquivo legendável; senão sai como `text` antes da mídia. A regra é extraída para um helper compartilhado em vez de duplicada, e o processor passa a usá-lo.

### 6. Enviar com `ZApiOutboundSender`, que passa a aceitar base64
O `ZApiOutboundSender` hoje baixa áudio por URL antes de converter para mp3. Ele passa a aceitar `url` como data URL também (detecta o prefixo `data:` e decodifica em vez de baixar). O handler cria um sender por destinatário (`{ instanceId, instanceToken, phone }`) e envia as partes em ordem, cada uma dentro de `sendWithinDailyQuota`.

### 7. Limite diário: parar o destinatário na primeira recusa
Uma recusa por limite numa parte interrompe as partes restantes daquele destinatário e o coloca em `refusedByLimit`, mantendo o aviso `dailyLimitNotices(locale).robotRefused` atual. Erro do provider numa parte só registra a falha daquela parte e segue para a próxima.

### 8. Comentário da timeline
`sendRobot.result` ganha `files?: { sent: string[]; failed: { name: string; reason: string }[] }` e um aviso `noContent`, nos três idiomas. Sem arquivos, a saída é idêntica à atual (teste de regressão garante).

## Risks / Trade-offs

- [Formato do valor `file` diferente do esperado] → tarefa 1.1 captura o payload real antes do parser; o normalizador é a única peça que depende disso.
- [Webhook do bizproc com timeout em arquivos grandes ou muitos destinatários] → arquivos baixados uma vez só; limite de 30 MB. Se virar problema, mover o robô para a fila é uma mudança separada.
- [Memória: arquivo em base64 em memória durante o disparo] → limite de 30 MB e download sequencial dos arquivos.
- [Token do evento sem escopo `disk`] → o Thinkzap já instala com escopo de CRM; se `disk.file.get` for necessário e o escopo faltar, o arquivo é descartado com motivo e o caso é registrado no catálogo de erros.

## Migration Plan

Sem migration de banco. Deploy da API e reexecução do registro do robô (`register-bizproc-robot-for-app` / reinstalação) para que `bizproc.robot.update` leve a nova propriedade aos portais. Rollback: voltar a API; a propriedade a mais no robô é ignorada pelo handler antigo.
