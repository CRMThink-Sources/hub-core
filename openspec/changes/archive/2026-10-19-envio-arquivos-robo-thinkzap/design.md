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

### 2. O valor do robô é uma lista de ids de arquivo do portal
Capturado em homolog (tarefa 1.2): com o campo File ligado a um campo de arquivo múltiplo do negócio, o handler recebe `properties.file = ["422204", "422206"]` — ids da tabela de arquivos do portal (`b_file`), sem nome, tipo nem link. Não são ids do Disk (`disk.file.get` responde "Could not find entity"), e o REST não tem método para baixar um arquivo só pelo id.

`parseRobotFiles(raw)` normaliza o valor — array, string única, objeto por índice (forma do `express.urlencoded` com `extended: true`), vazio — em ids numéricos únicos, na ordem recebida.

### 3. Achar os ids nos campos de arquivo do documento e baixar pelo `urlMachine`
`crm.item.get` do documento do disparo devolve cada campo de arquivo como `[{ id, url, urlMachine }]`; o `urlMachine` é um link REST que já leva o token do app e responde com o conteúdo, `content-type` e `content-disposition` (nome em `filename*` UTF-8). Validado com os dois arquivos do negócio 39802.

O handler mapeia a entidade do `document_id` para o `entityTypeId` (`DEAL`→2, `LEAD`→1, `CONTACT`→3, `COMPANY`→4, `DYNAMIC_<n>`→n), lê o item uma vez, procura os ids em **todos** os valores de campo com esse formato — o robô não diz de qual campo veio o arquivo — e baixa cada um uma vez. Id que não aparece no item (arquivo enviado na configuração do robô, ou fluxo fora do CRM) vira `unavailable`. Alternativa descartada: `disk.file.get`, que não reconhece esses ids.

O arquivo baixado vai ao Z-API como data URL base64, o mesmo formato que o widget usa: o `urlMachine` carrega o token do portal e não pode ser repassado ao provider.

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

- [Arquivo enviado na configuração do robô não tem caminho de download] → fora do escopo do spec; aparece na timeline como não obtido, e o texto segue.
- [`urlMachine` com token na URL] → nunca é logado nem repassado ao provider; só o conteúdo baixado sai do servidor.
- [Webhook do bizproc com timeout em arquivos grandes ou muitos destinatários] → arquivos baixados uma vez só; limite de 30 MB. Se virar problema, mover o robô para a fila é uma mudança separada.
- [Memória: arquivo em base64 em memória durante o disparo] → limite de 30 MB e download sequencial dos arquivos.

## Migration Plan

Sem migration de banco. Deploy da API e reexecução do registro do robô (`register-bizproc-robot-for-app` / reinstalação) para que `bizproc.robot.update` leve a nova propriedade aos portais. Rollback: voltar a API; a propriedade a mais no robô é ignorada pelo handler antigo.
