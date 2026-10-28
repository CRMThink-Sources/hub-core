# Spec Delta

## Purpose

Define a home do portal admin (`/admin`): os indicadores de negócio, a saúde dos jobs e os itens que precisam de atenção, além do endpoint de resumo que fornece os números.

## ADDED Requirements

### Requirement: Endpoint de resumo do painel
A API SHALL expor `GET /portal/dashboard/summary`, que só aceita sessão do portal e recusa com `401` quando não há sessão. A resposta SHALL trazer:
- `clients`: o número de clientes (domínios) cadastrados no portal;
- `subscriptions`: o número de assinaturas da SPA 1142 com status `Ativo`, `Vencido` e `Em teste`;
- `generatedAt`: o instante em que os números foram calculados.

O endpoint SHALL ser só leitura. Ele SHALL NOT gravar nada no CRM nem chamar provider.

#### Scenario: Resumo com sessão
- **WHEN** um usuário logado no portal pede o resumo, e a SPA 1142 tem 94 assinaturas `Ativo`, 6 `Vencido` e 12 `Em teste`
- **THEN** a resposta traz `subscriptions` com `active = 94`, `pastDue = 6` e `trialing = 12`, e o número de clientes

#### Scenario: Sem sessão
- **WHEN** alguém pede o resumo sem token do portal
- **THEN** a resposta é `401`

### Requirement: Resumo em cache curto
As contagens da SPA 1142 SHALL ser reaproveitadas por no máximo 60 segundos. Pedidos dentro desse intervalo SHALL NOT consultar o CRM de novo. Passado o intervalo, o próximo pedido SHALL recalcular.

#### Scenario: Dois acessos seguidos
- **WHEN** dois usuários abrem a home com 10 segundos de diferença
- **THEN** o CRM é consultado só uma vez e os dois veem o mesmo `generatedAt`

### Requirement: Falha do CRM não derruba o resumo
Se a contagem da SPA 1142 falhar, a resposta SHALL vir com `subscriptions: null` e a contagem de clientes preenchida. A home SHALL mostrar os cards de assinatura como indisponíveis, sem esconder os demais blocos.

#### Scenario: Bitrix fora do ar
- **WHEN** o CRM responde com erro ao contar as assinaturas
- **THEN** o resumo responde `200` com `clients` preenchido e `subscriptions: null`
- **AND** a home mostra Clientes com o número e os três cards de assinatura como "indisponível"

### Requirement: Indicadores de negócio na home
A home SHALL mostrar, no topo, quatro indicadores nesta ordem: Clientes, Assinaturas ativas, Vencidas e Em teste, com os números do resumo. Clientes SHALL levar para `/admin/clientes`. Enquanto o resumo carrega, os cards SHALL mostrar um estado de carregamento com o mesmo tamanho do card pronto.

#### Scenario: Home carregada
- **WHEN** o resumo devolve 128 clientes, 94 ativas, 6 vencidas e 12 em teste
- **THEN** a home mostra os quatro cards com esses números

### Requirement: Saúde dos jobs na home
A home SHALL listar cada job do catálogo com o nome, a saúde (conforme `portal-admin/catalogo-jobs`) e há quanto tempo foi a última rodada. Cada job SHALL levar para a página de detalhe dele.

#### Scenario: Job saudável
- **WHEN** a última rodada da varredura de expiração terminou há 12 minutos sem falhas
- **THEN** a home mostra "Varredura de expiração" como saudável, "há 12 min"

### Requirement: Precisa de atenção
A home SHALL ter um bloco "Precisa de atenção" com:
- o número de falhas de envio pendentes, com link para `/admin/falhas-envio`, quando houver alguma;
- cada job cuja saúde é falha, atenção ou atrasado, com link para o detalhe do job.

Sem nenhum desses itens, o bloco SHALL mostrar que está tudo em dia.

#### Scenario: Falhas de envio pendentes
- **WHEN** existem 3 falhas de envio
- **THEN** o bloco mostra "3 falhas de envio" com link para `/admin/falhas-envio`

#### Scenario: Tudo em dia
- **WHEN** não há falha de envio e todos os jobs estão saudáveis
- **THEN** o bloco mostra que está tudo em dia
