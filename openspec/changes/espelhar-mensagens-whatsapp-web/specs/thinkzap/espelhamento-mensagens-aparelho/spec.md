# Spec Delta

## Purpose

Leva para o canal aberto do Bitrix24 as mensagens que o cliente envia direto do aparelho (celular ou WhatsApp Web) numa linha não oficial (Z-API). Assim o operador vê a conversa completa, e não só o lado do contato.

## ADDED Requirements

### Requirement: Toggle de espelhamento na linha não oficial
A aba Ajustes de uma linha não oficial (Z-API) SHALL exibir, no card Comportamento, o toggle "Espelhar mensagens enviadas pelo aparelho", com uma dica explicando que só entram mensagens de conversas que já existem no canal aberto.

O toggle SHALL:
- vir desligado em linha nova e em linha que nunca o gravou;
- ficar desabilitado quando a linha não tem canal aberto vinculado ou está bloqueada;
- contar como alteração pendente da barra de salvamento, como os demais toggles de comportamento.

A aba Ajustes de uma linha oficial (HubMessage) SHALL NOT exibir o toggle, e a gravação do campo numa linha oficial SHALL ser recusada.

#### Scenario: Linha Z-API mostra o toggle desligado
- **WHEN** o usuário abre a aba Ajustes de uma linha Z-API que nunca gravou o toggle
- **THEN** o card Comportamento mostra "Espelhar mensagens enviadas pelo aparelho" desligado

#### Scenario: Linha oficial não mostra o toggle
- **WHEN** o usuário abre a aba Ajustes de uma linha HubMessage
- **THEN** o card Comportamento não mostra o toggle de espelhamento

#### Scenario: Sem canal vinculado
- **WHEN** a linha Z-API não tem canal aberto vinculado
- **THEN** o toggle aparece desabilitado, com dica de que é preciso vincular um canal

### Requirement: Notificação de mensagens enviadas pelo próprio número
Ao gravar o toggle ligado, o sistema SHALL ativar na Z-API a notificação de mensagens enviadas pelo próprio número daquela instância. Ao gravar desligado, SHALL desativá-la.

A chamada à Z-API SHALL acontecer antes de gravar os ajustes. Se ela falhar, nenhum campo da operação SHALL ser gravado e o usuário SHALL ver mensagem de erro, para que o toggle gravado nunca fique ligado sem que a Z-API entregue os eventos.

Gravar os ajustes sem alterar o valor do toggle SHALL NOT chamar a Z-API.

#### Scenario: Ligar o toggle
- **WHEN** o usuário liga o toggle e salva
- **THEN** a Z-API passa a notificar as mensagens enviadas pelo próprio número, e o toggle é gravado ligado

#### Scenario: Falha na Z-API ao ligar
- **WHEN** o usuário liga o toggle, salva, e a Z-API recusa a alteração
- **THEN** nada da operação é gravado, o toggle continua desligado após recarregar, e o usuário vê mensagem de erro

#### Scenario: Salvar só o nome
- **WHEN** o usuário altera só o nome da linha e salva
- **THEN** a Z-API não recebe chamada de notificação de mensagens enviadas

### Requirement: Classificação dos eventos enviados pelo próprio número
Todo evento de mensagem da Z-API marcado como enviado pelo próprio número SHALL ser classificado assim:

- **enviado pela integração** (marcado como enviado via API): SHALL ser descartado sem postar nada, porque a mensagem já nasceu no Bitrix (canal aberto, widget ou robô);
- **enviado pelo aparelho** (não marcado como enviado via API): SHALL seguir para o espelhamento.

Um evento enviado pelo aparelho cujo identificador de mensagem já está registrado como enviado pela integração SHALL também ser descartado.

Eventos de mensagem recebida do contato SHALL continuar no fluxo atual, sem mudança.

#### Scenario: Resposta do operador volta pelo webhook
- **WHEN** o operador responde no canal aberto, a mensagem sai pela Z-API e volta pelo webhook como enviada pelo próprio número via API
- **THEN** o evento é descartado e o canal aberto não mostra a mensagem duplicada

#### Scenario: Mensagem digitada no WhatsApp Web
- **WHEN** o cliente digita uma mensagem no WhatsApp Web da linha, para um contato
- **THEN** o evento segue para o espelhamento

### Requirement: Espelhamento somente em conversa existente
Uma mensagem enviada pelo aparelho SHALL ser espelhada no canal aberto vinculado à linha só quando:

- o toggle da linha está ligado;
- a linha tem assinatura ativa e canal aberto vinculado;
- o contato, ou o grupo, já tem conversa conhecida no canal aberto da linha, ou seja, ao menos uma mensagem dele já foi entregue ao canal aberto pela linha.

Fora dessas condições, o evento SHALL ser descartado sem abrir conversa nova, sem falhar o processamento e sem retentativa, com o motivo registrado no log do processamento.

A identidade do contato SHALL ser a mesma usada nas mensagens recebidas dele, para que a mensagem espelhada caia na mesma conversa.

#### Scenario: Contato com conversa
- **WHEN** o toggle está ligado, o contato já conversou pelo canal aberto da linha e o cliente envia "Bom dia" pelo celular
- **THEN** "Bom dia" aparece na conversa desse contato no canal aberto, com o prefixo de mensagem enviada pelo aparelho

#### Scenario: Contato sem conversa
- **WHEN** o toggle está ligado e o cliente envia pelo celular uma mensagem a um número que nunca teve conversa no canal aberto da linha
- **THEN** nenhuma conversa é aberta, nada é postado e o log do processamento indica "sem conversa existente"

#### Scenario: Toggle desligado
- **WHEN** o toggle está desligado e chega um evento enviado pelo aparelho
- **THEN** o evento é descartado sem postar nada

#### Scenario: Linha sem assinatura ativa
- **WHEN** a linha está com trial vencido ou assinatura inativa e chega um evento enviado pelo aparelho
- **THEN** o evento é descartado sem postar nada

### Requirement: Conteúdo da mensagem espelhada
A mensagem espelhada SHALL ter um prefixo que a identifica como enviada pelo WhatsApp do aparelho, seguido do conteúdo como foi enviado:

- texto;
- imagem, vídeo e documento com a legenda, se houver;
- áudio e sticker;
- contato encaminhado, no mesmo formato usado para contato recebido.

Em grupo, a mensagem espelhada SHALL cair na conversa do grupo, com o mesmo prefixo.

Quando a mensagem enviada pelo aparelho é resposta a outra mensagem conhecida, SHALL incluir a citação da mensagem original, como no fluxo de mensagens recebidas.

A mensagem espelhada SHALL ser registrada para que respostas a ela, edição e remoção a encontrem.

#### Scenario: Imagem com legenda
- **WHEN** o cliente envia pelo celular uma imagem com a legenda "segue o orçamento" a um contato com conversa
- **THEN** o canal aberto mostra o prefixo, a legenda e a imagem

#### Scenario: Mensagem em grupo
- **WHEN** o cliente envia pelo WhatsApp Web uma mensagem num grupo que já tem conversa no canal aberto
- **THEN** a mensagem aparece na conversa do grupo, com o prefixo de mensagem enviada pelo aparelho

### Requirement: Edição e remoção de mensagem espelhada
Quando o cliente edita, pelo aparelho, uma mensagem que foi espelhada, o sistema SHALL atualizar a cópia no canal aberto. Quando a apaga para todos, o sistema SHALL removê-la do canal aberto.

Edição ou remoção de uma mensagem que não foi espelhada SHALL ser descartada sem postar nada.

#### Scenario: Edição de mensagem espelhada
- **WHEN** o cliente edita pelo celular uma mensagem que já está espelhada no canal aberto
- **THEN** a mensagem no canal aberto passa a mostrar o texto editado, com o prefixo

#### Scenario: Remoção de mensagem não espelhada
- **WHEN** o cliente apaga pelo celular uma mensagem enviada a um contato sem conversa
- **THEN** nada é postado nem removido no canal aberto
