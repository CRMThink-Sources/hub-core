# Spec Delta

## Purpose

Dá ao time da CRMThink, no portal admin, uma tela para consultar as mensagens da fila de saída que não foram entregues (falha ou resultado indeterminado), entender o motivo e reprocessá-las, sem precisar acessar servidor nem banco.

## ADDED Requirements

### Requirement: Lista de falhas de envio
O portal admin SHALL ter uma tela "Falhas de envio", acessível pelo menu do admin e restrita a usuários autenticados no portal. A tela SHALL listar as mensagens da fila de saída com status `FAILED` ou `UNKNOWN`, da mais recente para a mais antiga, paginadas.

Cada linha da lista SHALL mostrar:
- data e hora de criação;
- portal (domínio);
- linha (item de assinatura);
- origem (operador no canal aberto, widget, envio com anexo, robô de mensagem, robô de botões, robô de template, campanha de SMS, bot);
- status;
- trecho do texto (ou nome do arquivo, quando for mídia);
- destino;
- motivo do erro;
- quantas vezes já foi reprocessada.

#### Scenario: Listagem padrão
- **WHEN** um usuário do portal admin abre "Falhas de envio" sem filtros
- **THEN** vê as mensagens `FAILED` e `UNKNOWN` dos últimos 7 dias, da mais recente para a mais antiga, em páginas

#### Scenario: Acesso sem login
- **WHEN** alguém sem sessão no portal admin acessa a tela ou as rotas da API
- **THEN** é redirecionado para o login na tela, e a API responde 401

### Requirement: Filtros da lista de falhas
A lista SHALL permitir filtrar por portal (domínio), status (`FAILED`, `UNKNOWN` ou ambos), origem e período (data inicial e final). O período padrão SHALL ser os últimos 7 dias, e o período máximo de uma consulta SHALL ser 90 dias.

#### Scenario: Filtrar por portal e período
- **WHEN** o usuário filtra pelo portal `querobombinhas.bitrix24.com.br` em 27/10/2026
- **THEN** a lista mostra só as falhas desse portal criadas nesse dia

#### Scenario: Período acima do máximo
- **WHEN** o usuário pede um período maior que 90 dias
- **THEN** a API recusa a consulta com erro de validação, e a tela mostra a mensagem correspondente

### Requirement: Detalhe da falha
Ao abrir uma mensagem da lista, o portal admin SHALL mostrar o detalhe completo:
- texto integral, ou tipo e nome do arquivo;
- destino;
- portal, linha e app;
- origem;
- chat e mensagem do canal aberto, quando a origem for o operador;
- operador do Bitrix;
- tentativas de envio;
- erro completo;
- horários de criação e última atualização;
- histórico de reprocessamento: quantas vezes, a última data e o usuário do portal que reprocessou.

#### Scenario: Detalhe de falha do canal aberto
- **WHEN** o usuário abre a falha `cd9192b3-dc67-4303-a048-b624ab4c59fb`
- **THEN** vê o texto "Buen día", o destino, o chat 50656, a mensagem 3346860, o operador 39154 e o erro "Linha não encontrada na instalação"

### Requirement: Reprocessar falha
O usuário SHALL poder reprocessar uma mensagem `FAILED` pelo detalhe ou pela lista. Reprocessar SHALL:
- devolver a mensagem para `PENDING`;
- colocá-la de novo na fila de saída da linha;
- registrar o usuário do portal, a data e o contador de reprocessamentos.

A mensagem reprocessada SHALL passar pelas mesmas regras de qualquer envio, incluindo limite diário, cadência e resolução da linha. O resultado final SHALL seguir os avisos normais da origem (operador, timeline do CRM etc.).

Reprocessar MUST ser atômico: duas solicitações simultâneas para a mesma mensagem SHALL resultar em uma única volta para a fila.

Só podem ser reprocessadas mensagens sem confirmação de entrega (sem id do provider). Uma mensagem que já está `PENDING`, `SENDING` ou `SENT` SHALL ser recusada com erro de conflito.

#### Scenario: Reprocessar o "Buen día" que falhou
- **WHEN** o usuário reprocessa uma mensagem `FAILED` do canal aberto
- **THEN** a mensagem volta para `PENDING`, entra na fila da linha e é enviada pelo worker
- **AND** o contador de reprocessamentos sobe para 1, com o usuário e a data registrados

#### Scenario: Reprocessar duas vezes ao mesmo tempo
- **WHEN** duas solicitações de reprocessamento da mesma mensagem chegam juntas
- **THEN** só uma é aceita, e a outra recebe erro de conflito
- **AND** o contato recebe a mensagem no máximo uma vez

#### Scenario: Mensagem já enviada
- **WHEN** o usuário tenta reprocessar uma mensagem que já está `SENT`
- **THEN** a API responde com erro de conflito e nada é colocado na fila

### Requirement: Reprocessar resultado indeterminado exige confirmação
Uma mensagem `UNKNOWN` pode ter sido entregue. O portal admin SHALL exigir uma confirmação explícita, avisando que o contato pode receber a mensagem duas vezes, antes de reprocessá-la. A API SHALL recusar o reprocessamento de `UNKNOWN` sem essa confirmação na requisição.

#### Scenario: UNKNOWN sem confirmação
- **WHEN** a API recebe um pedido de reprocessamento de mensagem `UNKNOWN` sem a confirmação de risco de duplicidade
- **THEN** responde com erro de validação e não altera a mensagem

#### Scenario: UNKNOWN com confirmação
- **WHEN** o usuário confirma o aviso de duplicidade e reprocessa uma mensagem `UNKNOWN`
- **THEN** a mensagem volta para a fila como qualquer reprocessamento

### Requirement: Reprocessar em lote
A lista SHALL permitir selecionar várias mensagens e reprocessá-las de uma vez, com até 50 por solicitação. O resultado SHALL informar, para cada mensagem, se foi reprocessada ou o motivo da recusa. Uma mensagem recusada MUST NOT impedir as demais. Mensagens `UNKNOWN` no lote SHALL seguir a mesma regra de confirmação.

#### Scenario: Lote com uma mensagem já enviada
- **WHEN** o usuário reprocessa em lote 3 mensagens `FAILED`, sendo que uma delas foi reenviada por outro caminho e já está `SENT`
- **THEN** as 2 mensagens `FAILED` são reprocessadas
- **AND** a mensagem `SENT` volta com o motivo da recusa

### Requirement: Idioma da tela de falhas
Os textos da tela "Falhas de envio" SHALL estar disponíveis em `pt`, `en` e `es`, como as demais telas do portal admin.

#### Scenario: Portal admin em espanhol
- **WHEN** o usuário do portal admin está com o idioma `es`
- **THEN** títulos, filtros, ações e avisos da tela aparecem em espanhol
