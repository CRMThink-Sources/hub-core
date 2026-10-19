# Tasks

## 1. Propriedade do robô e formato do valor

- [x] 1.1 Adicionar `file: { Name: 'File', Type: 'file', Multiple: 'Y' }` em `buildThinkzapRobotAddParams` (e por consequência em `buildThinkzapRobotUpdateParams`). Verificar: `build-thinkzap-robot-add-params.test.ts` atualizado e passando.
- [x] 1.2 Registrar o robô num portal de homologação, disparar com campo de arquivo do negócio e logar o `req.body.properties.file` cru. Verificar: formato documentado no topo de `parse-robot-files.ts`. Resultado (homolog, negócio 39802, campo múltiplo com dois arquivos): `["422204", "422206"]`, ids de `b_file`, resolvidos por `crm.item.get` → `urlMachine`. Arquivo enviado na configuração do robô saiu do escopo (ver spec).

## 2. Leitura e download dos arquivos

- [x] 2.1 Criar `application/robot-files/parse-robot-files.ts` que normaliza o valor cru (array, string única, objeto por índice, vazio) em ids numéricos únicos, na ordem recebida. Verificar: testes unitários cobrindo o formato capturado, as variações e o valor ausente.
- [x] 2.2 Criar `application/robot-files/classify-robot-file.ts` (`image | video | audio | document` por mime, com a extensão como fallback). Verificar: testes com png, mp4, ogg, pdf, xlsx e arquivo sem extensão.
- [x] 2.3 Criar o download (`fetch-robot-files.ts`): mapeia a entidade do documento para `entityTypeId`, lê o item com `crm.item.get` uma vez, acha cada id nos campos de arquivo, baixa pelo `urlMachine` (nome do `content-disposition`, mime do `content-type`), descarta acima de 30 MB, e devolve `{ name, mime, kind, dataUrl }` ou `{ name, reason }` por arquivo. Adicionar o código de erro novo em `errors/catalog.ts`. Verificar: testes com dependências falsas para sucesso, id fora do item, fluxo sem documento, falha do `crm.item.get`, falha do download e arquivo grande.

## 3. Montagem das partes e envio

- [x] 3.1 Extrair a regra de legenda de `toOutboundDescriptors` (`workers/bitrix-received-message.processor.ts`) para um helper compartilhado `build-captioned-parts.ts` e fazer o processor usá-lo. Verificar: `bitrix-received-message.processor.test.ts` continua passando sem alteração de comportamento, e testes novos do helper cobrem texto+pdf, texto+áudio, só arquivos e só texto.
- [x] 3.2 Fazer o `ZApiOutboundSender` aceitar `url` em data URL (no áudio, decodificar em vez de baixar; nos demais, repassar). Verificar: `z-api-outbound-sender.adapter.test.ts` com casos de data URL para imagem, documento e áudio.
- [x] 3.3 Alterar `BitrixRobotWebhookHandlerController`: ler e baixar os arquivos uma vez, montar as partes, aceitar Mensagem vazia com arquivo, recusar disparo sem conteúdo com o aviso `noContent`, enviar cada parte por destinatário via `ZApiOutboundSender` dentro de `sendWithinDailyQuota`, parar o destinatário na primeira recusa por limite e seguir em erro de provider. Remover o log temporário do valor cru. Verificar: `bitrix-robot-webhook-handler.controller.test.ts` cobre robô antigo só texto (regressão), texto+pdf, texto+áudio, vários arquivos, arquivo indisponível, arquivo grande, sem conteúdo, e limite atingido no meio.

## 4. Comentário na timeline

- [x] 4.1 Estender `sendRobot.result` com os arquivos enviados e não enviados (com motivo) e adicionar `sendRobot.noContent` em pt, en e es em `timeline-notices.ts`. Verificar: `notices-catalog.test.ts` passa (chaves nos três idiomas) e um teste garante que, sem arquivos, o texto do comentário é idêntico ao atual.

## 5. Integração

- [ ] 5.1 Em homologação, reexecutar o registro do robô num portal que já tinha o robô e confirmar que a propriedade Arquivo aparece e que um robô antigo continua enviando só texto. Disparar os cenários do spec (pdf com legenda, áudio, dois arquivos, arquivo de campo do negócio) numa linha Z-API. Verificar: mensagens chegam no WhatsApp com tipo e legenda corretos, e o comentário na timeline lista os arquivos.
- [x] 5.2 Rodar `yarn test` e `yarn lint` em `api/`. Verificar: tudo passa.
