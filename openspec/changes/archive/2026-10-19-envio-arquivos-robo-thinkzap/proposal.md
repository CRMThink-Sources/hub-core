# Proposal

## Why

O robô "Enviar mensagem" do ThinkZap (bizproc do Bitrix24) só envia texto. Quem automatiza o atendimento por linha não oficial (Z-API) não tem como mandar um boleto, contrato, proposta em PDF ou imagem a partir de um fluxo do CRM, mesmo com o arquivo já anexado no negócio — precisa sair do fluxo e enviar à mão pelo canal aberto ou pelo widget. O Z-API e o restante do ThinkZap já sabem enviar imagem, vídeo, áudio e documento; falta o robô aceitar o arquivo.

## What Changes

- O robô "Enviar mensagem" ganha uma propriedade opcional **Arquivo** (tipo arquivo do bizproc, múltipla), que aceita arquivo enviado na configuração ou campo de arquivo do documento.
- No disparo, cada arquivo é enviado a cada destinatário pela linha não oficial, com o tipo definido pelo arquivo: imagem, vídeo, áudio ou documento.
- O texto da propriedade Mensagem vira **legenda** do primeiro arquivo que aceita legenda (imagem, vídeo, documento). Se o primeiro arquivo for áudio, o texto sai antes, como mensagem separada. Sem arquivo, o robô continua enviando só o texto, como hoje.
- A Mensagem passa a poder ficar vazia quando há arquivo: o robô envia só os arquivos.
- O comentário na timeline do CRM passa a listar os arquivos enviados e os que falharam.
- Cada arquivo aceito pelo provider conta uma unidade no limite diário da linha, como já vale para texto com anexos.
- Robôs já configurados, sem a nova propriedade, continuam funcionando sem alteração.

## Capabilities

### New Capabilities
- `thinkzap/robo-envio-arquivos`: envio de arquivos pelo robô "Enviar mensagem" do bizproc em linha não oficial — propriedade do robô, tipo de envio por arquivo, legenda, falhas por arquivo, comentário na timeline e contagem no limite diário.

### Modified Capabilities
<!-- Nenhuma. `thinkzap/limite-diario-mensagens` já conta "uma unidade por parte aceita" e já inclui o robô "Enviar mensagem"; a regra não muda. -->

## Impact

- **API** (`api/src/modules/thinkzap`): definição do robô (`build-thinkzap-robot-add-params.ts`), `bitrix-robot-webhook-handler.controller.ts` (leitura dos arquivos, montagem das partes e envio), reaproveitamento do `ZApiOutboundSender` / `ZApiClient` (`sendImage`, `sendVideo`, `sendAudio`, `sendDocument`), avisos da timeline (`timeline-notices.ts`, pt/en/es) e catálogo de erros.
- **Bitrix24**: a definição do robô muda (nova propriedade). Portais existentes recebem a atualização pelo `bizproc.robot.update` já feito em `EnsureThinkzapRobot` na reinstalação/registro do robô.
- **Linhas oficiais (HubMessage)**: fora do escopo — o robô "Enviar mensagem" já recusa linha que não seja Z-API.
- **Formato do valor da propriedade de arquivo**: a documentação do Bitrix não detalha o que chega ao handler de um robô REST para o tipo `file`; precisa ser confirmado com disparo real antes de fechar a leitura.
