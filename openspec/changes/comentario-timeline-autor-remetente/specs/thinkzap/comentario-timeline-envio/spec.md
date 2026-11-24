# thinkzap/comentario-timeline-envio Specification

## ADDED Requirements

### Requirement: Comentário de envio publicado em nome do remetente
Ao registrar na timeline do CRM um envio feito pelo widget ou por um robô do Bizproc (mensagem, anexo, template, botões), o sistema SHALL publicar o comentário em nome de quem enviou: o operador do widget, ou o usuário em cujo contexto o robô executou. O autor exibido na timeline NÃO SHALL ser o usuário que instalou o aplicativo, salvo quando ele for o próprio remetente.

#### Scenario: Operador envia mensagem pelo widget
- **WHEN** um operador com autorização do app envia uma mensagem pelo widget e o envio é confirmado
- **THEN** o comentário aparece na timeline com o nome e a foto desse operador

#### Scenario: Envio de template pela fila
- **WHEN** um operador envia um template pelo widget e o worker confirma o envio depois, fora da request
- **THEN** o comentário aparece com o nome e a foto do operador que enviou, identificado pelo remetente gravado no envio

#### Scenario: Robô do Bizproc dispara mensagem
- **WHEN** um robô de disparo, de template ou de botão roda no contexto de um usuário com autorização do app
- **THEN** o comentário aparece em nome desse usuário

#### Scenario: Aviso de falha também em nome do remetente
- **WHEN** um envio do widget falha, fica sem confirmação ou é recusado pelo limite diário
- **THEN** o aviso na timeline é publicado em nome do operador que tentou enviar

### Requirement: Fallback quando não há como publicar em nome do remetente
Quando não houver token utilizável do remetente (nunca autorizou o app, renovação falhou, execução sem usuário, permissão negada na entidade), o sistema SHALL publicar o comentário com a credencial da instalação, como antes, e SHALL identificar o remetente pelo nome no corpo do comentário quando ele for conhecido. O sistema NÃO SHALL deixar de publicar o comentário, nem falhar ou retentar o envio, por causa disso.

#### Scenario: Remetente nunca autorizou o app
- **WHEN** o operador envia pelo widget e não há token dele guardado
- **THEN** o comentário é publicado com a credencial da instalação e traz o nome do operador no texto

#### Scenario: Token do remetente recusado pelo Bitrix
- **WHEN** a publicação com o token do remetente retorna erro de acesso ou de token
- **THEN** o sistema publica uma única vez com a credencial da instalação e o envio ao contato não é afetado

#### Scenario: Comentário não duplica
- **WHEN** a publicação com o token do remetente tiver sido aceita pelo Bitrix
- **THEN** o sistema NÃO publica uma segunda vez com a credencial da instalação

### Requirement: Comentário de envio legível
O comentário de timeline SHALL ser formatado em BBCode do Bitrix, com título que informa o tipo e o resultado (enviado, falhou, sem confirmação), remetente/linha e destinatário em linhas rotuladas, o texto da mensagem em linha própria sob o rótulo (sem bloco de citação) e, quando houver, o nome do template e a lista de arquivos em linhas próprias. A formatação SHALL existir em português, inglês e espanhol, conforme o idioma da instalação. O texto da mensagem, nomes e telefones SHALL aparecer como vieram, sem interpretação de marcação: BBCode digitado pelo operador NÃO SHALL alterar o layout do comentário.

#### Scenario: Envio de texto confirmado
- **WHEN** uma mensagem de texto é enviada com sucesso
- **THEN** o comentário mostra título de envio, linha de origem, destinatário e a mensagem em linha própria sob o rótulo, sem bloco de citação

#### Scenario: Template confirmado
- **WHEN** um template é enviado com sucesso
- **THEN** o comentário mostra a linha `Template:` com o nome (preservada para conciliação da cobrança da Meta), o destinatário e o corpo resolvido

#### Scenario: Mensagem com marcação do operador
- **WHEN** o texto enviado contém algo como `[b]`, `[url]` ou `[/quote]`
- **THEN** o comentário exibe esse texto literalmente e a estrutura do comentário permanece íntegra

#### Scenario: Falha de envio
- **WHEN** o envio falha
- **THEN** o comentário destaca que a mensagem NÃO foi entregue, traz destinatário e mensagem e a orientação de reenvio, no idioma da instalação

#### Scenario: Idioma da instalação
- **WHEN** a instalação está em inglês ou espanhol
- **THEN** títulos e rótulos do comentário saem nesse idioma, com a mesma estrutura do português

### Requirement: Ícone do ThinkZap no comentário
O comentário de envio SHALL abrir com o ícone do ThinkZap na linha do título, no lugar de emojis. Quando o servidor não tiver endereço público do front configurado, o comentário SHALL ser publicado normalmente, sem o ícone.

#### Scenario: Comentário com ícone
- **WHEN** o servidor publica um comentário de envio e o endereço público do front está configurado
- **THEN** o comentário começa com a imagem do ThinkZap, seguida do título em negrito, sem emoji

#### Scenario: Front sem endereço público
- **WHEN** o servidor publica um comentário de envio e não há endereço público do front configurado
- **THEN** o comentário é publicado sem o ícone
