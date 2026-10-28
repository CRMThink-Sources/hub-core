# Spec Delta

## Purpose

Define a aba Assinaturas da aplicação no backoffice: a leitura das assinaturas da SPA 1142 com as linhas da SPA 1146, e as ações do suporte de ativar, inativar e assinar no provider (todas as linhas ou uma por uma).

## ADDED Requirements

### Requirement: Aba Assinaturas visível
A aba "Assinaturas" SHALL aparecer no detalhe de toda aplicação. Ela lê `GET /portal/apps/:appId/subscriptions` e mostra cada assinatura como um card com:
- nome;
- status em badge;
- modalidade (Stripe ou Manual);
- plano e produto;
- período, em dia de calendário no fuso UTC;
- id no gateway, quando houver;
- as linhas da assinatura.

Cada linha SHALL mostrar o nome, o provider, o status do item e se está assinada no provider. A aba SHALL distinguir os estados "sem espelho", "sem assinatura" e "erro de leitura", sem mostrar lista vazia no lugar de erro.

#### Scenario: Assinatura manual com duas linhas
- **WHEN** o operador abre a aba de uma instalação com uma assinatura manual ativa e duas linhas
- **THEN** a aba mostra o card da assinatura com o badge "Ativo", a modalidade "Manual" e as duas linhas, cada uma com o provider e o estado no provider

#### Scenario: Erro de leitura
- **WHEN** a leitura da SPA 1142 falha
- **THEN** a aba mostra o erro com a ação "Tentar de novo", e não "Sem assinatura"

### Requirement: Ativar assinatura manual
A API SHALL expor `POST /portal/apps/:appId/subscriptions/:subscriptionId/activate`, só com sessão do portal. Ele vale para assinaturas manuais com status diferente de `active`. A ação SHALL gravar na SPA 1142 o status `Ativo` e limpar o "Vencido em".

O corpo SHALL aceitar um novo fim de período opcional (dia de calendário). Se o período atual já terminou, o novo fim SHALL ser obrigatório e posterior a hoje. Sem ele, a resposta SHALL ser `422`. Quando o novo fim é informado, ele é gravado como fim do período.

A assinatura no provider das linhas SHALL ficar a cargo do ciclo existente da SPA 1142. A ação SHALL NOT chamar o provider diretamente.

#### Scenario: Reativar assinatura cancelada
- **WHEN** o operador ativa uma assinatura manual `Cancelado` com período até daqui a 20 dias
- **THEN** a SPA 1142 passa a `Ativo`
- **AND** o ciclo da SPA assina no provider as linhas `active` com credencial

#### Scenario: Período já encerrado sem nova data
- **WHEN** o operador tenta ativar uma assinatura `Vencido` cujo período terminou ontem, sem informar o novo fim
- **THEN** a resposta é `422` e nada é gravado

#### Scenario: Assinatura já ativa
- **WHEN** a assinatura já está `active`
- **THEN** a resposta é `409` e nada é gravado

### Requirement: Inativar assinatura manual
A API SHALL expor `POST /portal/apps/:appId/subscriptions/:subscriptionId/deactivate`, só com sessão do portal. Ele vale para assinaturas manuais com status diferente de `cancelled`. A ação SHALL gravar na SPA 1142 o status `Cancelado` e a data de cancelamento de hoje. A desassinatura das linhas no provider SHALL ficar a cargo do ciclo existente da SPA 1142.

No backoffice, a ação SHALL pedir confirmação. A confirmação mostra quantas linhas serão desassinadas no provider.

#### Scenario: Inativar com confirmação
- **WHEN** o operador escolhe "Inativar" numa assinatura manual ativa com 3 linhas e confirma
- **THEN** a SPA 1142 passa a `Cancelado` com a data de cancelamento de hoje
- **AND** o ciclo da SPA desassina as 3 linhas no provider

#### Scenario: Desistir na confirmação
- **WHEN** o operador fecha a confirmação sem confirmar
- **THEN** nada é gravado

### Requirement: Assinatura Stripe não é ativada nem inativada pelo backoffice
Para assinaturas com modalidade `stripe`, os endpoints de ativar e inativar SHALL responder `409` com o motivo `gateway-managed`, sem gravar nada. O backoffice SHALL NOT oferecer essas ações para assinatura Stripe. Ele SHALL explicar que o status vem do Stripe e é corrigido pela sincronização Stripe.

#### Scenario: Tentar inativar assinatura Stripe pela API
- **WHEN** alguém chama `deactivate` numa assinatura `stripe`
- **THEN** a resposta é `409` com o motivo `gateway-managed` e a SPA 1142 não muda

### Requirement: Assinar todas as linhas no provider
A API SHALL expor `POST /portal/apps/:appId/subscriptions/:subscriptionId/subscribe-lines`, só com sessão do portal e para qualquer modalidade. A ação SHALL reconciliar cada linha da assinatura com a regra e a marca do ciclo de provider (`thinkzap/ciclo-provider-spa-assinatura`):
- assinatura ativa e paga: assina as linhas `active` com credencial e sem marca de assinado;
- assinatura cancelada: desassina as linhas sem marca de desassinado;
- os demais estados: não fazem nada.

A resposta SHALL trazer a contagem de linhas assinadas, desassinadas, ignoradas e com falha. A falha numa linha SHALL NOT impedir as outras.

#### Scenario: Linha que ficou sem assinar
- **WHEN** uma assinatura manual ativa tem uma linha assinada (com marca) e outra provisionada sem marca, e o operador escolhe "Assinar todas no provider"
- **THEN** só a segunda linha é assinada no provider e recebe a marca
- **AND** a resposta traz 1 assinada e 1 ignorada

#### Scenario: Trial
- **WHEN** a assinatura está em teste
- **THEN** nada é assinado e a resposta traz todas as linhas como ignoradas

### Requirement: Ações por linha dentro da assinatura
Cada linha no card da assinatura SHALL oferecer "Assinar no provider" e "Desassinar no provider", com as rotas de linha que já existem. Desassinar SHALL pedir confirmação. Essas ações forçam a chamada ao provider mesmo quando a marca diz o contrário: são o caminho do suporte para corrigir uma marca que diverge do provider. Linha sem credencial SHALL mostrar as ações desabilitadas e explicar o motivo.

#### Scenario: Forçar subscribe de linha já marcada
- **WHEN** uma linha tem a marca de assinado, mas o provider diz que a instância não está assinada, e o operador escolhe "Assinar no provider"
- **THEN** o subscribe é chamado no provider e a marca de assinado é regravada

### Requirement: Ações de provider respeitam o ambiente
Os endpoints que chamam o provider (assinar todas, assinar e desassinar por linha) SHALL responder `409` com o motivo `provider-effects-disabled`, sem chamar o provider, onde os efeitos de provider estão desligados. Ativar e inativar SHALL responder do mesmo jeito nesse ambiente, porque o portal Bitrix é compartilhado com produção. O backoffice SHALL mostrar as ações desabilitadas, com o motivo, nesse ambiente.

#### Scenario: Homologação
- **WHEN** um operador da homologação escolhe "Assinar todas no provider"
- **THEN** a resposta é `409` com `provider-effects-disabled` e nenhum provider é chamado

### Requirement: Resultado das ações na tela
Depois de qualquer ação, o backoffice SHALL:
- mostrar o resultado com um aviso (sucesso, falha parcial com contagem ou erro com o motivo traduzido);
- recarregar as assinaturas da aplicação, de modo que o efeito do ciclo (que roda em fila) apareça na releitura.

Enquanto a ação roda, o botão SHALL ficar desabilitado com indicação de progresso. Uma segunda ação na mesma assinatura SHALL NOT poder ser disparada antes de a primeira terminar.

#### Scenario: Falha parcial
- **WHEN** "Assinar todas no provider" assina 2 linhas e falha em 1
- **THEN** a tela mostra "2 assinadas, 1 com falha" e recarrega a lista
