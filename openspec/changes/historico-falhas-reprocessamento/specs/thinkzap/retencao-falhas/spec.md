## Purpose

Limita por quanto tempo o banco guarda as falhas de mensagens e seus logs, que contêm dados de contatos, e mantém a tela coerente com esse prazo.

## ADDED Requirements

### Requirement: Prazo de guarda de 7 dias
O sistema SHALL guardar por 7 dias, contados da criação:
- as falhas de recebimento;
- os registros de tentativas;
- as mensagens da fila de saída em `FAILED` ou `UNKNOWN`.

Uma mensagem da fila de saída que foi reprocessada e falhou de novo SHALL contar o prazo a partir da **última** alteração dela, e não da criação: a falha de ontem não pode sumir por a mensagem ter sido criada há mais tempo.

O prazo SHALL ser configurável por ambiente, com 7 dias como padrão. Valor inválido ou menor que 1 SHALL ser recusado na subida da aplicação, em vez de apagar tudo.

#### Scenario: Padrão
- **WHEN** nenhum valor é configurado
- **THEN** o prazo é de 7 dias

#### Scenario: Mensagem reprocessada que falhou de novo
- **WHEN** uma mensagem foi criada há 10 dias, reprocessada e falhou novamente há 1 dia
- **THEN** ela permanece, e só é apagada 7 dias depois dessa última falha

#### Scenario: Valor inválido
- **WHEN** o prazo configurado é `0` ou não é um número
- **THEN** a aplicação recusa subir com mensagem dizendo qual variável corrigir

### Requirement: Expurgo diário em lotes
Um job SHALL rodar uma vez por dia, apagar o que passou do prazo em lotes limitados e registrar quantos itens apagou em cada tabela. O job SHALL NOT apagar mensagens da fila de saída em outro status (por exemplo, `PENDING`, `SENDING` ou entregues) nem mensagens com envio em andamento. Duas instâncias SHALL NOT executar o expurgo ao mesmo tempo. O job SHALL ficar desligado por padrão em ambiente local e SHALL poder ser ligado por configuração.

Uma falha no expurgo SHALL ser logada, SHALL NOT interromper outros jobs da aplicação e SHALL ser retomada na rodada seguinte.

#### Scenario: Itens vencidos
- **WHEN** o job roda e existem falhas de recebimento com 8 dias
- **THEN** elas são apagadas junto com as tentativas ligadas a elas, e o log informa as quantidades

#### Scenario: Mensagem entregue
- **WHEN** o job roda e existe uma mensagem da fila de saída entregue há 30 dias
- **THEN** ela permanece

#### Scenario: Muito volume vencido
- **WHEN** há mais itens vencidos do que cabem em um lote
- **THEN** o job apaga em lotes sucessivos sem manter uma única operação longa sobre a tabela

#### Scenario: Duas instâncias
- **WHEN** duas instâncias da API disparam o job no mesmo horário
- **THEN** só uma executa o expurgo

#### Scenario: Falha no meio do expurgo
- **WHEN** o banco falha durante um lote
- **THEN** o erro é logado, os lotes já apagados permanecem apagados e a próxima rodada continua de onde parou

### Requirement: Tela coerente com o prazo
As telas de falhas SHALL informar o prazo de guarda. O período máximo de consulta SHALL ser o prazo de guarda, e o período padrão SHALL ser igual a ele. Item expurgado SHALL deixar de aparecer na lista e de ser reprocessável.

#### Scenario: Aviso do prazo
- **WHEN** o administrador abre a tela de falhas
- **THEN** a tela informa que as falhas são guardadas por 7 dias

#### Scenario: Período maior que o prazo
- **WHEN** o administrador pede um período de 30 dias
- **THEN** a consulta é recusada com a mensagem de que o máximo é o prazo de guarda
