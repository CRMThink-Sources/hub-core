# Spec Delta

## Purpose

Liga cada usuário do backoffice ao seu usuário no Bitrix24 da CRMThink, para que ações feitas no backoffice possam ser atribuídas à pessoa certa no Bitrix (por exemplo, o autor de uma mensagem na tarefa de uma novidade).

## ADDED Requirements

### Requirement: ID do Bitrix no usuário do backoffice
Todo usuário do backoffice SHALL ter um campo opcional com o ID do seu usuário no Bitrix24 da CRMThink: um número inteiro positivo, ou vazio quando não há vínculo. A listagem de usuários SHALL devolver esse campo.

#### Scenario: Usuário sem vínculo
- **WHEN** um usuário do backoffice foi criado sem ID do Bitrix
- **THEN** a listagem mostra o campo vazio e o usuário continua usando o backoffice normalmente

### Requirement: Informar o ID ao cadastrar o usuário
O cadastro de usuário do backoffice SHALL aceitar o ID do Bitrix de forma opcional. Um valor que não seja inteiro positivo SHALL ser recusado com `400`, sem criar o usuário.

#### Scenario: Cadastro com vínculo
- **WHEN** um operador cadastra um usuário informando o ID 42 do Bitrix
- **THEN** o usuário é criado com o ID 42 e a listagem o mostra

#### Scenario: ID inválido
- **WHEN** um operador cadastra um usuário com o ID do Bitrix "abc" ou 0
- **THEN** a API responde `400` e nenhum usuário é criado

### Requirement: Editar o ID de um usuário existente
Um operador SHALL poder definir, trocar ou remover o ID do Bitrix de um usuário já cadastrado, sem alterar nenhum outro dado dele. Usuário inexistente SHALL responder `404`; a rota exige sessão do portal e responde `401` sem ela.

#### Scenario: Definir o vínculo
- **WHEN** um operador informa o ID 42 para um usuário que não tinha vínculo
- **THEN** o usuário passa a ter o ID 42 e e-mail, nome, senha e situação continuam iguais

#### Scenario: Remover o vínculo
- **WHEN** um operador limpa o ID de um usuário vinculado
- **THEN** o usuário fica sem vínculo

#### Scenario: Usuário inexistente
- **WHEN** um operador tenta editar o vínculo de um usuário que não existe
- **THEN** a API responde `404`

### Requirement: Tela de usuários mostra e edita o vínculo
A tela de usuários do backoffice SHALL ter o campo "ID no Bitrix" no formulário de cadastro e uma coluna na tabela com o ID (ou um traço quando vazio). Cada linha SHALL oferecer a ação de editar o ID, com salvar e remover vínculo. Todos os textos SHALL existir em pt, en e es.

#### Scenario: Editar pela tabela
- **WHEN** um operador abre a edição do ID de um usuário, digita 42 e salva
- **THEN** a tabela passa a mostrar 42 para esse usuário
