## Purpose

Permite ao suporte ver, no backoffice, as mensagens recebidas (Z-API, HubMessage e Bitrix) que não puderam ser processadas e reprocessá-las, sem acessar o Redis.

## ADDED Requirements

### Requirement: Falha final de recebimento é registrada
Quando o processamento de um evento recebido esgota todas as tentativas da fila, o sistema SHALL registrar uma falha de recebimento com:
- origem do evento (Z-API, HubMessage, status do HubMessage, Bitrix ou bot do Bitrix) e tipo;
- identificador de rastreio (`traceKey`);
- portal e instância, quando for possível identificá-los no evento;
- código de erro e mensagem do último erro;
- número de tentativas;
- o conteúdo do evento, necessário para reprocessar;
- horário da falha.

Falha que ainda tem tentativa pela frente SHALL NOT gerar registro, e evento processado com sucesso SHALL NOT gerar registro. Se a gravação do registro falhar, o processamento SHALL seguir sem erro adicional, e a falha SHALL continuar no log da aplicação.

#### Scenario: Tentativas esgotadas
- **WHEN** um evento recebido da Z-API falha nas 3 tentativas
- **THEN** existe uma falha de recebimento com origem Z-API, o `traceKey` do evento e o erro da última tentativa

#### Scenario: Falha que se recupera
- **WHEN** um evento falha na primeira tentativa e é processado na segunda
- **THEN** nenhuma falha de recebimento é registrada

#### Scenario: Evento sem portal identificável
- **WHEN** um evento falha sem que o portal possa ser identificado no seu conteúdo
- **THEN** a falha é registrada sem portal e aparece na lista geral, sem entrar em nenhum filtro por portal

#### Scenario: Erro ao gravar
- **WHEN** o banco recusa a gravação da falha de recebimento
- **THEN** o erro de gravação é logado e o worker segue processando os demais eventos

### Requirement: Lista de falhas de recebimento
A tela `/admin/falhas-envio` SHALL ter uma aba "Recebimento" com as falhas de recebimento, da mais recente para a mais antiga, paginadas. Cada linha SHALL mostrar origem, tipo, portal, erro resumido, número de tentativas, horário e se a falha é reprocessável.

A lista SHALL aceitar os filtros: portal, origem, período e situação (`FAILED` ou `REPROCESSED`). O período padrão SHALL ser os últimos 7 dias. A aba "Envio" SHALL continuar com o comportamento atual.

#### Scenario: Abrir a aba
- **WHEN** o administrador abre a aba "Recebimento"
- **THEN** vê as falhas dos últimos 7 dias, com as mais recentes primeiro

#### Scenario: Filtrar por origem
- **WHEN** o administrador filtra por origem HubMessage
- **THEN** a lista mostra só falhas de eventos do HubMessage

### Requirement: Detalhe da falha de recebimento
Escolher uma falha SHALL abrir o detalhe com os campos da lista, o `traceKey`, o código de erro, a mensagem completa do erro e o log de tentativas (ver `thinkzap/log-tentativas-falha`). O detalhe SHALL NOT exibir o conteúdo do evento por inteiro: SHALL mostrar apenas os campos necessários para entender a falha (por exemplo, tipo e identificadores), para não expor dado pessoal sem necessidade.

#### Scenario: Abrir o detalhe
- **WHEN** o administrador escolhe uma falha de recebimento
- **THEN** vê origem, tipo, `traceKey`, código de erro, mensagem e as tentativas, sem o texto da mensagem do contato

#### Scenario: Falha inexistente ou expirada
- **WHEN** o administrador abre o detalhe de uma falha que já foi expurgada
- **THEN** a resposta é de não encontrado e a tela informa que o prazo de guarda terminou

### Requirement: Reprocessar falha de recebimento
O administrador SHALL poder reprocessar uma falha de recebimento reprocessável. Reprocessar SHALL recolocar o evento original na fila de entrada, passando pelas mesmas regras de qualquer evento, e marcar a falha como `REPROCESSED`, com quem reprocessou, quando e quantas vezes.

Só são reprocessáveis falhas de origens cujo reprocessamento não gera efeito duplicado. As demais SHALL aparecer como "não reprocessável" e a ação SHALL ser recusada para elas.

Um evento reprocessado que falhar de novo SHALL gerar uma nova falha de recebimento ligada à anterior, em vez de reabrir a anterior.

#### Scenario: Reprocessar com sucesso
- **WHEN** o administrador reprocessa uma falha reprocessável
- **THEN** o evento volta para a fila, a falha passa a `REPROCESSED` e a tela mostra confirmação

#### Scenario: Origem não reprocessável
- **WHEN** o administrador tenta reprocessar uma falha de origem não reprocessável
- **THEN** a ação é recusada com o motivo e nada é enfileirado

#### Scenario: Falha já reprocessada
- **WHEN** o administrador reprocessa uma falha que outra pessoa acabou de reprocessar
- **THEN** a ação é recusada por conflito e o evento não é enfileirado duas vezes

#### Scenario: Reprocessado que falha de novo
- **WHEN** o evento reprocessado esgota as tentativas novamente
- **THEN** surge uma nova falha de recebimento ligada à anterior, e a anterior continua `REPROCESSED`

### Requirement: Falhas de recebimento só para administrador autenticado
Listar, detalhar e reprocessar falhas de recebimento SHALL exigir a mesma autenticação das demais ações do backoffice.

#### Scenario: Sem sessão
- **WHEN** a lista é pedida sem sessão de administrador
- **THEN** a resposta é de não autorizado

### Requirement: Idioma da aba Recebimento
Os textos da aba "Recebimento" SHALL estar disponíveis em `pt`, `en` e `es`.

#### Scenario: Portal admin em inglês
- **WHEN** o idioma do portal admin é `en`
- **THEN** títulos, filtros, ações e avisos da aba aparecem em inglês
