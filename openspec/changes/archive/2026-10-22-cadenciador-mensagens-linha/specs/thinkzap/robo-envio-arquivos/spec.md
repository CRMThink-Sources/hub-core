# Spec Delta

## MODIFIED Requirements

### Requirement: Comentário na timeline lista os arquivos
O comentário que o robô deixa na timeline do CRM SHALL listar, além do telefone de origem, dos destinatários e da mensagem, o nome de cada arquivo enviado e, separadamente, os arquivos não enviados com o motivo. O comentário SHALL seguir o idioma da instalação (pt, en, es), como os demais avisos do robô.

As partes do disparo são enviadas pela fila de saída da linha e podem esperar a cadência (capability `thinkzap/cadencia-envio-mensagens`). Por isso o comentário SHALL ser publicado uma única vez, quando todas as partes de todos os destinatários do disparo tiverem um resultado final (enviada ou falha). Ele SHALL NOT ser publicado no momento em que o robô é acionado.

Disparo sem arquivos SHALL manter o conteúdo atual do comentário.

#### Scenario: Comentário com arquivos
- **WHEN** o robô envia `proposta.pdf` ao contato 5511999990000 com a Mensagem "Segue sua proposta"
- **THEN** a timeline do negócio mostra o telefone de origem, o destinatário 5511999990000, a mensagem "Segue sua proposta" e o arquivo `proposta.pdf` como enviado

#### Scenario: Comentário depois da espera por cadência
- **WHEN** o robô dispara para dois destinatários e a segunda parte do disparo espera uma janela da cadência
- **THEN** o comentário da timeline só aparece depois que a última parte é enviada ou falha
- **AND** o comentário é publicado uma única vez

### Requirement: Arquivos no limite diário da linha
Cada parte aceita pelo provider SHALL contar uma unidade no limite diário da linha. O limite é verificado quando cada parte sai da fila. Quando o limite é atingido no meio do envio para um destinatário, as partes restantes desse destinatário SHALL NOT ser enviadas, e o destinatário SHALL aparecer na timeline como não atendido por limite diário. Os destinatários seguintes SHALL ser recusados do mesmo modo enquanto o limite estiver atingido.

#### Scenario: Legenda não conta à parte
- **WHEN** o robô envia a um destinatário a Mensagem como legenda de `contrato.pdf`, mais `anexo.png`, e as duas partes são aceitas
- **THEN** a contagem do dia da linha aumenta em 2

#### Scenario: Limite atingido no meio
- **WHEN** a linha tem uma vaga restante e o robô dispara `contrato.pdf` e `anexo.png` para um destinatário
- **THEN** `contrato.pdf` é enviado, `anexo.png` não é, e a timeline lista o destinatário como não atendido por limite diário
