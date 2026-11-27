# Spec Delta

## Purpose

Define a aba "Envios" do ThinkZap: onde o usuário consulta, dentro da aplicação, os envios feitos pelo widget do CRM e pelos robôs do Bizproc, com o status de cada destinatário e o motivo da falha, respeitando quem pode ver o quê.

## ADDED Requirements

### Requirement: A aba Envios existe no menu do ThinkZap
O ThinkZap SHALL ter um item "Envios" no menu, que abre a página `/thinkzap/envios`. O item SHALL aparecer para todo usuário com acesso ao ThinkZap, sem exigir permissão adicional. A página SHALL funcionar em português, inglês e espanhol, no idioma que o usuário já escolheu no app.

#### Scenario: Operador sem permissão de administração abre a aba
- **WHEN** um usuário com acesso ao ThinkZap, mas sem papel de administrador, abre o app
- **THEN** o menu mostra "Envios" e a página abre sem erro de permissão

#### Scenario: Usuário sem acesso ao ThinkZap
- **WHEN** um usuário sem acesso ao ThinkZap tenta abrir `/thinkzap/envios`
- **THEN** vê o mesmo bloqueio das demais telas e nenhum dado de envio é devolvido pela API

### Requirement: A lista mostra uma linha por destinatário de cada disparo
A lista SHALL mostrar, do mais recente para o mais antigo, uma linha por destinatário de cada disparo, com paginação no servidor. Cada linha SHALL trazer data e hora, linha, destinatário, tipo (texto, template, anexo ou botões), origem (widget ou robô), remetente e status. Um destinatário que recebeu várias partes do mesmo disparo (texto e anexos) SHALL aparecer em uma única linha. Só entram os envios por widget e por robô do Bizproc que passam pela fila de envio: campanha de SMS, resposta do operador no canal aberto, bot e envio síncrono não aparecem.

#### Scenario: Disparo de robô para três destinatários
- **WHEN** um robô do Bizproc envia um template para três telefones
- **THEN** a lista mostra três linhas, uma por telefone, cada uma com o seu status

#### Scenario: Mensagem com texto e dois anexos
- **WHEN** o operador envia pelo widget um texto com dois anexos para um contato
- **THEN** a lista mostra uma única linha para esse destinatário, e o detalhe lista as três partes

#### Scenario: Envio fora do escopo
- **WHEN** existe uma mensagem de campanha de SMS ou uma resposta de operador no canal aberto
- **THEN** ela não aparece na lista

### Requirement: O status do destinatário é derivado do que o provedor confirmou
O status exibido SHALL ser um destes: Aguardando envio, Enviado, Entregue, Lido, Falhou, Falhou em parte e Sem confirmação. Entregue e Lido SHALL aparecer só quando o provedor os confirmou. O status SHALL só avançar (Lido sobre Entregue, Entregue sobre Enviado). Uma recusa informada depois do aceite SHALL mostrar Falhou, salvo se o provedor também confirmou entrega ou leitura, caso em que a entrega prevalece. Com várias partes, o status SHALL ser o do menor avanço entre as partes enviadas; se alguma falhou e outra saiu, Falhou em parte; se alguma falhou e nenhuma saiu, Falhou. Uma parte sem confirmação de entrega do provedor SHALL aparecer como Sem confirmação, sem afirmar que não saiu.

#### Scenario: Mensagem lida
- **WHEN** o provedor confirmou a entrega e a leitura de um envio
- **THEN** a linha mostra Lido

#### Scenario: Recusa da Meta depois do aceite
- **WHEN** a Meta recusou a mensagem depois de o envio ter sido aceito
- **THEN** a linha mostra Falhou, com o motivo

#### Scenario: Provedor sem confirmação de entrega
- **WHEN** o envio foi aceito pela linha Z-API e nenhum evento de entrega chegou
- **THEN** a linha mostra Enviado, e nunca Entregue ou Lido

#### Scenario: Falha em parte
- **WHEN** o texto de um destinatário saiu e um dos anexos falhou
- **THEN** a linha mostra Falhou em parte

### Requirement: A falha mostra o motivo no idioma da instalação
Para um envio que falhou, a lista e o detalhe SHALL mostrar o motivo traduzido para o idioma da instalação, com as mesmas frases usadas no comentário do CRM. O detalhe SHALL mostrar também o código informado pela Meta, quando houver. Falha sem motivo registrado SHALL mostrar uma frase genérica no idioma da instalação, nunca um texto vazio.

#### Scenario: Janela de 24 horas fechada
- **WHEN** a Meta recusou uma mensagem por janela de conversa fechada
- **THEN** a linha mostra o motivo traduzido para esse caso, e o detalhe mostra o código da Meta

#### Scenario: Limite diário atingido
- **WHEN** o envio foi recusado pelo limite diário de mensagens da linha
- **THEN** a linha mostra Falhou com o motivo do limite diário

### Requirement: A lista aceita filtros
A lista SHALL aceitar filtro por período, status, linha e destinatário. O período padrão SHALL ser os últimos 7 dias e o máximo 90 dias; um pedido além de 90 dias SHALL ser recusado ou limitado a 90, nunca atendido. O filtro de destinatário SHALL casar por trecho do telefone, ignorando formatação. Os filtros SHALL se combinar e a contagem total e a paginação SHALL respeitá-los.

#### Scenario: Só as falhas da última semana
- **WHEN** o usuário filtra por status Falhou com o período padrão
- **THEN** a lista mostra apenas envios com falha dos últimos 7 dias, e o total reflete o filtro

#### Scenario: Período acima do limite
- **WHEN** o pedido traz um período de 120 dias
- **THEN** a resposta não traz envios com mais de 90 dias

#### Scenario: Busca por parte do telefone
- **WHEN** o usuário digita "99091017" no filtro de destinatário
- **THEN** a lista mostra os envios cujo telefone contém esse trecho, independentemente de máscara ou código do país

### Requirement: A visibilidade depende do perfil
O administrador do ThinkZap SHALL ver todos os envios da instalação. Os demais usuários com acesso SHALL ver apenas os envios que eles próprios fizeram. Envios de robô sem usuário identificado SHALL ser visíveis só para o administrador. O filtro SHALL ser aplicado no servidor, a partir do usuário do token, e valer também para o detalhe: pedir o detalhe de um envio que o usuário não pode ver SHALL responder como se ele não existisse. Nenhum usuário SHALL ver envios de outra instalação.

#### Scenario: Operador vê só os próprios envios
- **WHEN** um operador sem papel de administrador abre a aba e existem envios de outros operadores na instalação
- **THEN** a lista mostra apenas os envios dele

#### Scenario: Administrador vê tudo
- **WHEN** um administrador abre a aba
- **THEN** a lista mostra os envios de todos os usuários e dos robôs da instalação, e ele pode filtrar por remetente

#### Scenario: Detalhe de envio alheio
- **WHEN** um operador pede o detalhe de um envio feito por outro usuário
- **THEN** a resposta é "não encontrado", sem revelar que o envio existe

#### Scenario: Robô sem usuário
- **WHEN** um robô do Bizproc enviou mensagens sem usuário identificado
- **THEN** esses envios aparecem para o administrador e não aparecem para os demais

### Requirement: O detalhe mostra o envio por inteiro
O detalhe SHALL mostrar o texto enviado, o template e o idioma (na linha oficial), a linha, o remetente, a origem, os horários de envio, entrega, leitura e recusa quando existirem, o status e o motivo da falha, as partes do envio (texto e anexos, cada uma com seu estado) e um link para o registro do CRM de onde o envio partiu, quando houver. O texto SHALL aparecer só no detalhe e na lista para quem tem permissão de ver aquele envio.

#### Scenario: Detalhe de um template lido
- **WHEN** o usuário abre o detalhe de um template enviado e lido
- **THEN** vê o texto resolvido, o nome e o idioma do template, e os horários de envio, entrega e leitura

#### Scenario: Link para o registro do CRM
- **WHEN** o envio partiu de um negócio
- **THEN** o detalhe traz um link que abre esse negócio no Bitrix

### Requirement: O histórico vale 90 dias
A aba SHALL mostrar os envios dos últimos 90 dias, o mesmo prazo de guarda do histórico. Envios mais antigos SHALL não aparecer e a tela SHALL informar o prazo. Falha ao resolver o nome do remetente no Bitrix SHALL não derrubar a lista: a linha mostra um indicador no lugar do nome.

#### Scenario: Envio com mais de 90 dias
- **WHEN** um envio foi feito há mais de 90 dias
- **THEN** ele não aparece na lista nem no detalhe

#### Scenario: Bitrix indisponível ao resolver nomes
- **WHEN** a consulta de nomes de usuário ao Bitrix falha
- **THEN** a lista abre normalmente, com o remetente indicado de forma neutra em vez do nome
