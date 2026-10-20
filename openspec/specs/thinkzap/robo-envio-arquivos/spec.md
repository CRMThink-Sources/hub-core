# thinkzap/robo-envio-arquivos Specification

## Purpose

Define como o robô "Enviar mensagem" do ThinkZap no bizproc do Bitrix24 envia arquivos (imagem, vídeo, áudio e documento) por uma linha não oficial, junto ou no lugar do texto, e como o resultado aparece na timeline do CRM.

## Requirements

### Requirement: Robô aceita arquivos
O robô "Enviar mensagem" SHALL ter uma propriedade opcional **Arquivo**, do tipo arquivo do bizproc e múltipla, ligada a um campo de arquivo do documento do CRM em que o fluxo roda (negócio, lead, contato, empresa ou SPA).

Só arquivos que estão num campo de arquivo desse documento SHALL ser enviados. Um arquivo enviado direto na configuração do robô, ou um arquivo de fluxo que não roda sobre um documento do CRM (lista universal, por exemplo), SHALL ser tratado como arquivo que não pôde ser obtido (ver "Falha por arquivo não interrompe o disparo"): não é enviado e aparece na timeline com esse motivo, quando há timeline.

A propriedade Mensagem SHALL poder ficar vazia quando houver pelo menos um arquivo. Um disparo sem mensagem e sem arquivo SHALL NOT enviar nada e SHALL registrar na timeline que a automação não tem conteúdo para enviar.

Robôs configurados antes desta mudança, sem a propriedade Arquivo, SHALL continuar enviando só o texto, exatamente como hoje.

#### Scenario: Robô antigo sem arquivo
- **WHEN** um robô salvo antes desta mudança, só com Mensagem, é disparado
- **THEN** o destinatário recebe o texto, como hoje

#### Scenario: Arquivo vindo do campo do negócio
- **WHEN** o robô está configurado com a propriedade Arquivo ligada a um campo de arquivo do negócio que contém `proposta.pdf`, e é disparado
- **THEN** o destinatário recebe o documento `proposta.pdf`

#### Scenario: Arquivo enviado na configuração do robô
- **WHEN** o robô tem a Mensagem "Segue o boleto" e, na propriedade Arquivo, um arquivo enviado direto na configuração, e é disparado num negócio
- **THEN** o destinatário recebe só o texto "Segue o boleto" e a timeline do negócio indica que o arquivo não pôde ser obtido

#### Scenario: Sem mensagem e sem arquivo
- **WHEN** o robô é disparado com a Mensagem vazia e o campo de arquivo do negócio vazio
- **THEN** nada é enviado e a timeline do negócio registra que a automação não tem conteúdo para enviar

### Requirement: Tipo de envio definido pelo arquivo
Cada arquivo SHALL ser enviado ao WhatsApp no tipo correspondente ao seu formato:
- **imagem**: jpg, jpeg, png, webp;
- **vídeo**: mp4, 3gp;
- **áudio**: mp3, ogg, oga, opus, wav, m4a, aac — enviado como mensagem de voz;
- **documento**: qualquer outro formato, preservando o nome do arquivo.

O formato SHALL ser identificado pelo tipo do arquivo informado pelo Bitrix no download e, na falta dele (ou sendo genérico), pela extensão do nome.

#### Scenario: Imagem
- **WHEN** o robô dispara com o arquivo `fachada.png`
- **THEN** o destinatário recebe uma imagem

#### Scenario: Planilha como documento
- **WHEN** o robô dispara com o arquivo `orcamento.xlsx`
- **THEN** o destinatário recebe um documento com o nome `orcamento.xlsx`

#### Scenario: Áudio como voz
- **WHEN** o robô dispara com o arquivo `recado.ogg`
- **THEN** o destinatário recebe uma mensagem de voz

### Requirement: Texto como legenda
Quando o disparo tem Mensagem e arquivos, o texto SHALL ir como legenda do primeiro arquivo se ele for imagem, vídeo ou documento. Se o primeiro arquivo for áudio, o texto SHALL ser enviado antes, como mensagem de texto separada. Os demais arquivos SHALL ir sem legenda, na ordem em que o Bitrix os entregou.

#### Scenario: Texto e PDF
- **WHEN** o robô dispara com a Mensagem "Segue sua proposta" e o arquivo `proposta.pdf`
- **THEN** o destinatário recebe uma única mensagem: o documento `proposta.pdf` com a legenda "Segue sua proposta"

#### Scenario: Texto e áudio
- **WHEN** o robô dispara com a Mensagem "Ouça o recado" e o arquivo `recado.ogg`
- **THEN** o destinatário recebe primeiro o texto "Ouça o recado" e depois a mensagem de voz

#### Scenario: Vários arquivos
- **WHEN** o robô dispara com a Mensagem "Documentos do contrato" e os arquivos `contrato.pdf` e `anexo.png`
- **THEN** o destinatário recebe `contrato.pdf` com a legenda e, em seguida, `anexo.png` sem legenda

### Requirement: Falha por arquivo não interrompe o disparo
O robô SHALL enviar cada parte (texto e cada arquivo) a cada destinatário de forma independente. A falha de uma parte — arquivo que não pôde ser obtido do Bitrix, arquivo acima de 30 MB ou erro do provider — SHALL NOT impedir o envio das demais partes nem dos demais destinatários.

Um arquivo que não pôde ser obtido (não está em campo de arquivo do documento, ou o download falhou) ou que excede 30 MB SHALL ser descartado antes do envio, para todos os destinatários.

#### Scenario: Um dos arquivos indisponível
- **WHEN** o robô dispara com `contrato.pdf` e um segundo arquivo que o Bitrix não entrega
- **THEN** o destinatário recebe `contrato.pdf` e a timeline indica que o segundo arquivo não foi enviado

#### Scenario: Arquivo grande demais
- **WHEN** o robô dispara com a Mensagem "Segue o vídeo" e um vídeo de 50 MB
- **THEN** o vídeo não é enviado, o texto "Segue o vídeo" é enviado sozinho e a timeline indica que o vídeo excede o tamanho permitido

### Requirement: Comentário na timeline lista os arquivos
O comentário que o robô deixa na timeline do CRM SHALL listar, além do telefone de origem, dos destinatários e da mensagem, o nome de cada arquivo enviado e, separadamente, os arquivos não enviados com o motivo. O comentário SHALL seguir o idioma da instalação (pt, en, es), como os demais avisos do robô.

Disparo sem arquivos SHALL manter o comentário atual.

#### Scenario: Comentário com arquivos
- **WHEN** o robô envia `proposta.pdf` ao contato 5511999990000 com a Mensagem "Segue sua proposta"
- **THEN** a timeline do negócio mostra o telefone de origem, o destinatário 5511999990000, a mensagem "Segue sua proposta" e o arquivo `proposta.pdf` como enviado

### Requirement: Arquivos no limite diário da linha
Cada parte aceita pelo provider SHALL contar uma unidade no limite diário da linha. Quando o limite é atingido no meio do envio para um destinatário, as partes restantes desse destinatário SHALL NOT ser enviadas, e o destinatário SHALL aparecer na timeline como não atendido por limite diário. Os destinatários seguintes SHALL ser recusados do mesmo modo enquanto o limite estiver atingido.

#### Scenario: Legenda não conta à parte
- **WHEN** o robô envia a um destinatário a Mensagem como legenda de `contrato.pdf`, mais `anexo.png`, e as duas partes são aceitas
- **THEN** a contagem do dia da linha aumenta em 2

#### Scenario: Limite atingido no meio
- **WHEN** a linha tem uma vaga restante e o robô dispara `contrato.pdf` e `anexo.png` para um destinatário
- **THEN** `contrato.pdf` é enviado, `anexo.png` não é, e a timeline lista o destinatário como não atendido por limite diário
