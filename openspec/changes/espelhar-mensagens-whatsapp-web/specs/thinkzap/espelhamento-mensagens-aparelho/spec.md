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

### Requirement: Autor da mensagem espelhada
A mensagem espelhada de texto ou contato encaminhado SHALL ser postada no canal aberto como o **operador da sessão**, isto é, o último operador que respondeu naquela conversa, do lado da empresa, mantendo o prefixo.

A mensagem SHALL ser postada como o contato, com o prefixo, quando:
- nenhum operador respondeu ainda naquela conversa;
- o operador não tem autorização válida do app;
- o Bitrix recusa a postagem como o operador;
- não é possível garantir que a mensagem não será reenviada ao WhatsApp.

O log do processamento SHALL indicar o autor usado e, quando for o contato, o motivo.

Mídia (imagem, vídeo, áudio, documento, sticker) SHALL ser postada como o contato nesta versão.

Uma mensagem espelhada postada como operador SHALL NOT ser reenviada ao contato no WhatsApp.

#### Scenario: Operador com autorização
- **WHEN** a operadora Ana respondeu por último na conversa de um contato, já autorizou o app, e o cliente envia "Bom dia" pelo celular a esse contato
- **THEN** "Bom dia" aparece na conversa como mensagem da Ana, com o prefixo de mensagem enviada pelo aparelho

#### Scenario: Conversa sem resposta de operador
- **WHEN** a conversa do contato só tem mensagens recebidas e o cliente envia uma mensagem pelo celular a esse contato
- **THEN** a mensagem aparece como o contato, com o prefixo, e o log indica "sem operador na conversa"

#### Scenario: Operador sem autorização
- **WHEN** o último operador da conversa nunca autorizou o app e o cliente envia uma mensagem pelo celular
- **THEN** a mensagem aparece como o contato, com o prefixo, e o log indica o motivo

#### Scenario: Sem reenvio ao WhatsApp
- **WHEN** uma mensagem do aparelho é postada no canal aberto como o operador
- **THEN** o contato não recebe essa mensagem uma segunda vez no WhatsApp

### Requirement: Edição e remoção de mensagem espelhada
Quando o cliente edita, pelo aparelho, uma mensagem que foi espelhada, o sistema SHALL atualizar a cópia no canal aberto. Quando a apaga para todos, o sistema SHALL removê-la do canal aberto. A cópia SHALL ser atualizada ou removida com o mesmo autor com que foi postada.

Se a cópia foi postada como operador e a autorização desse operador não está mais válida, o evento SHALL ser descartado sem alterar a cópia, com o motivo no log do processamento.

Edição ou remoção de uma mensagem que não foi espelhada SHALL ser descartada sem postar nada.

#### Scenario: Edição de mensagem espelhada
- **WHEN** o cliente edita pelo celular uma mensagem que já está espelhada no canal aberto
- **THEN** a mensagem no canal aberto passa a mostrar o texto editado, com o prefixo

#### Scenario: Edição sem autorização do operador
- **WHEN** a cópia foi postada como um operador cuja autorização expirou e o cliente edita a mensagem pelo celular
- **THEN** a cópia no canal aberto não muda e o log indica que o operador não tem autorização válida

#### Scenario: Remoção de mensagem não espelhada
- **WHEN** o cliente apaga pelo celular uma mensagem enviada a um contato sem conversa
- **THEN** nada é postado nem removido no canal aberto
