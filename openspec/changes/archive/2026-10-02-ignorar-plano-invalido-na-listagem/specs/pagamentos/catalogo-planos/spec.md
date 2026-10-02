# Spec Delta

## Purpose

Define como o sistema lê o catálogo de planos da SPA de planos do Bitrix24 e como trata planos mal cadastrados, para que um registro ruim não derrube a leitura dos demais.

## ADDED Requirements

### Requirement: Listagem de planos ignora registros inválidos
Ao listar os planos da SPA, o sistema SHALL descartar todo plano cujos dados não possam ser interpretados — incluindo intervalo de cobrança vazio, nulo ou desconhecido — e SHALL devolver os demais planos válidos, na ordem em que vieram. Um plano inválido NÃO SHALL fazer a listagem falhar.

O sistema NÃO SHALL atribuir um intervalo de cobrança default a um plano sem intervalo válido.

#### Scenario: Um plano com intervalo vazio entre planos válidos
- **WHEN** a SPA devolve três planos e o segundo tem o intervalo vazio
- **THEN** a listagem devolve o primeiro e o terceiro planos, sem erro

#### Scenario: Intervalo desconhecido
- **WHEN** a SPA devolve um plano cujo intervalo não corresponde a nenhum ciclo conhecido
- **THEN** esse plano fica fora da listagem e os demais são devolvidos

#### Scenario: Todos os planos inválidos
- **WHEN** todos os planos devolvidos pela SPA são inválidos
- **THEN** a listagem devolve uma lista vazia, sem erro

#### Scenario: Plano descartado não aparece na contratação
- **WHEN** o cliente abre a tela de contratação e existe um plano com intervalo vazio na SPA
- **THEN** a tela carrega com os planos ofertáveis válidos e o plano inválido não é oferecido

### Requirement: Registro descartado é sinalizado
Para cada plano descartado na listagem, o sistema SHALL registrar um aviso no log contendo o id do plano e os campos com problema.

#### Scenario: Aviso identifica o plano
- **WHEN** um plano com id 15 e intervalo vazio é descartado da listagem
- **THEN** o log recebe um aviso com o id 15 e o campo de intervalo apontado como problema

### Requirement: Leitura de plano específico continua estrita
Ao ler um plano específico pelo id, o sistema SHALL continuar falhando com erro de plano inválido quando os dados do plano não puderem ser interpretados.

#### Scenario: Busca por id de plano com intervalo vazio
- **WHEN** o sistema lê pelo id um plano cujo intervalo está vazio
- **THEN** a leitura falha com erro de plano inválido
