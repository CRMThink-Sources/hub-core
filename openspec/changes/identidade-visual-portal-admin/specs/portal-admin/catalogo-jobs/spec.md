# Spec Delta

## Purpose

Define o catálogo de jobs do portal admin em `/admin/jobs`: quais jobs aparecem, como a saúde de cada um é calculada a partir das rodadas e como se chega ao detalhe de cada job.

## ADDED Requirements

### Requirement: Catálogo lista os jobs do portal
`/admin/jobs` SHALL listar todos os jobs que o portal acompanha, cada um com:
- nome;
- descrição curta;
- periodicidade (ex.: "a cada hora");
- saúde;
- início e resultado da última rodada.

Cada job SHALL ter um identificador estável em kebab-case. Escolher um job SHALL levar para `/admin/jobs/<identificador>`. Hoje o catálogo tem um job, a varredura de expiração de assinaturas, com identificador `expiracao-assinaturas`.

#### Scenario: Abrir o catálogo
- **WHEN** um usuário logado abre `/admin/jobs`
- **THEN** aparece o card "Varredura de expiração", com periodicidade, saúde e última rodada

#### Scenario: Ir para o detalhe
- **WHEN** o usuário escolhe "Varredura de expiração" no catálogo
- **THEN** o portal vai para `/admin/jobs/expiracao-assinaturas`

### Requirement: Saúde do job calculada pela última rodada
A saúde de um job SHALL ser derivada da rodada mais recente dele, nesta ordem de precedência:

| Condição da última rodada | Saúde |
|---|---|
| nenhuma rodada registrada | sem rodadas |
| em andamento e não abandonada | em andamento |
| `failed` ou abandonada | falha |
| começou há mais que o dobro da periodicidade do job | atrasado |
| `success` com falhas por item ou pausada pelo Bitrix | atenção |
| `success` sem falhas | saudável |

#### Scenario: Rodada com falhas por assinatura
- **WHEN** a última rodada terminou `success` com `failed = 2`
- **THEN** a saúde do job é "atenção"

#### Scenario: Job parado
- **WHEN** o job roda a cada hora e a última rodada começou há 3 horas
- **THEN** a saúde do job é "atrasado"

#### Scenario: Rodada abandonada
- **WHEN** a última rodada está `running` há mais de 1 hora
- **THEN** a saúde do job é "falha"

### Requirement: Job inexistente
`/admin/jobs/<identificador>` com um identificador que não está no catálogo SHALL mostrar uma tela de "job não encontrado", com link de volta para `/admin/jobs`.

#### Scenario: Endereço errado
- **WHEN** alguém abre `/admin/jobs/nao-existe`
- **THEN** a tela informa que o job não foi encontrado e oferece voltar ao catálogo

### Requirement: Falha ao carregar a saúde de um job não derruba o catálogo
Se a consulta das rodadas de um job falhar, o card daquele job SHALL mostrar a saúde como indisponível, com a opção de tentar de novo. Os demais jobs SHALL continuar sendo exibidos.

#### Scenario: Erro na consulta
- **WHEN** a API de rodadas da varredura de expiração responde com erro
- **THEN** o card dela mostra "indisponível" e um botão para tentar de novo
