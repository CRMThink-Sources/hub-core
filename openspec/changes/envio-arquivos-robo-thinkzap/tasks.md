# Tasks

## 1. Propriedade do robô e formato do valor

- [x] 1.1 Adicionar `file: { Name: 'File', Type: 'file', Multiple: 'Y' }` em `buildThinkzapRobotAddParams` (e por consequência em `buildThinkzapRobotUpdateParams`). Verificar: `build-thinkzap-robot-add-params.test.ts` atualizado e passando.
- [ ] 1.2 Registrar o robô num portal de homologação e disparar com (a) um arquivo fixo na configuração, (b) campo de arquivo do negócio com um arquivo e (c) com dois arquivos. Logar o `req.body.properties.file` cru e registrar os três formatos num comentário no topo do futuro `parse-robot-files.ts`. Verificar: os três formatos documentados, incluindo se chega URL ou id de arquivo e se a URL exige autenticação.

## 2. Leitura e download dos arquivos

- [ ] 2.1 Criar `application/robot-files/parse-robot-files.ts` que normaliza o valor cru (string, array, objeto por índice, vazio) em `{ url?, diskFileId?, name? }[]`, conforme os formatos de 1.2. Verificar: testes unitários cobrindo cada formato capturado e o valor ausente.
- [x] 2.2 Criar `application/robot-files/classify-robot-file.ts` (`image | video | audio | document` por mime, com a extensão como fallback). Verificar: testes com png, mp4, ogg, pdf, xlsx e arquivo sem extensão.
- [ ] 2.3 Criar o download (`fetch-robot-files.ts`): resolve id do Disk quando for o caso, baixa cada arquivo uma vez com o token do evento quando necessário, descarta acima de 30 MB, e devolve `{ name, mime, kind, dataUrl }` ou `{ name, reason }` por arquivo. Adicionar os códigos de erro novos em `errors/catalog.ts`. Verificar: testes com cliente HTTP falso para sucesso, 404, arquivo grande e falha do Disk.

## 3. Montagem das partes e envio

- [x] 3.1 Extrair a regra de legenda de `toOutboundDescriptors` (`workers/bitrix-received-message.processor.ts`) para um helper compartilhado `build-captioned-parts.ts` e fazer o processor usá-lo. Verificar: `bitrix-received-message.processor.test.ts` continua passando sem alteração de comportamento, e testes novos do helper cobrem texto+pdf, texto+áudio, só arquivos e só texto.
- [x] 3.2 Fazer o `ZApiOutboundSender` aceitar `url` em data URL (no áudio, decodificar em vez de baixar; nos demais, repassar). Verificar: `z-api-outbound-sender.adapter.test.ts` com casos de data URL para imagem, documento e áudio.
- [ ] 3.3 Alterar `BitrixRobotWebhookHandlerController`: ler e baixar os arquivos uma vez, montar as partes, aceitar Mensagem vazia com arquivo, recusar disparo sem conteúdo com o aviso `noContent`, enviar cada parte por destinatário via `ZApiOutboundSender` dentro de `sendWithinDailyQuota`, parar o destinatário na primeira recusa por limite e seguir em erro de provider. Verificar: `bitrix-robot-webhook-handler.controller.test.ts` cobre robô antigo só texto (regressão), texto+pdf, texto+áudio, vários arquivos, arquivo indisponível, arquivo grande, sem conteúdo, e limite atingido no meio.

## 4. Comentário na timeline

- [x] 4.1 Estender `sendRobot.result` com os arquivos enviados e não enviados (com motivo) e adicionar `sendRobot.noContent` em pt, en e es em `timeline-notices.ts`. Verificar: `notices-catalog.test.ts` passa (chaves nos três idiomas) e um teste garante que, sem arquivos, o texto do comentário é idêntico ao atual.

## 5. Integração

- [ ] 5.1 Em homologação, reexecutar o registro do robô num portal que já tinha o robô e confirmar que a propriedade Arquivo aparece e que um robô antigo continua enviando só texto. Disparar os cenários do spec (pdf com legenda, áudio, dois arquivos, arquivo de campo do negócio) numa linha Z-API. Verificar: mensagens chegam no WhatsApp com tipo e legenda corretos, e o comentário na timeline lista os arquivos.
- [ ] 5.2 Rodar `yarn test` e `yarn lint` em `api/`. Verificar: tudo passa.
