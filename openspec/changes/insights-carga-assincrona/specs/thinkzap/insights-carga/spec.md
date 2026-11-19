# thinkzap/insights-carga Specification

## Purpose

Define como o Insights do ThinkZap carrega e entrega o painel: o cálculo roda fora da requisição HTTP, as leituras de dias fechados são reaproveitadas entre deploys e processos, o painel mais usado fica pronto antes de alguém abrir, e conversas que não puderam ser lidas por inteiro são sinalizadas. Esta capability cobre só a carga; as regras de cálculo dos indicadores não mudam.

## ADDED Requirements

### Requirement: Abertura do painel nunca espera o cálculo
`GET /insights/dashboard` (aba Desempenho) e `GET /insights/today` (aba Agora, a de abertura padrão) SHALL responder sem aguardar a leitura das conversas no Bitrix ou na Vibe API.

- Com resultado disponível para a consulta (período, filtros e fonte), a resposta SHALL ser `200` com o painel.
- Sem resultado disponível, a resposta SHALL ser `202` com `status: "computing"`, e o cálculo SHALL ser iniciado em segundo plano.
- Resultado vencido há menos de 30 minutos SHALL ser entregue na hora (`200`), marcado como desatualizado, enquanto um novo cálculo roda em segundo plano. Resultado vencido há mais que isso SHALL ser tratado como inexistente.
- O resultado do Desempenho SHALL valer por 5 minutos antes de ser considerado vencido; o do Agora, por 1 minuto (como hoje).

#### Scenario: Primeira abertura com tudo frio
- **WHEN** um usuário abre o Insights de um app sem resultado guardado para o período
- **THEN** a API responde `202` com `status: "computing"` em tempo curto
- **AND** o cálculo do painel é iniciado em segundo plano

#### Scenario: Abertura com resultado recente
- **WHEN** existe resultado da mesma consulta calculado há menos de 5 minutos
- **THEN** a API responde `200` com esse painel, sem iniciar novo cálculo

#### Scenario: Resultado vencido recentemente
- **WHEN** o resultado da consulta venceu há 10 minutos
- **THEN** a API responde `200` na hora com o painel antigo, marcado como desatualizado
- **AND** um novo cálculo é iniciado em segundo plano

#### Scenario: Resultado velho demais
- **WHEN** o resultado da consulta venceu há mais de 30 minutos
- **THEN** a API o trata como inexistente e responde `202`

#### Scenario: Aba Agora com tudo frio
- **WHEN** um usuário abre o Insights (aba Agora) de um app sem leituras guardadas
- **THEN** `GET /insights/today` responde `202` em tempo curto e o cálculo roda em segundo plano

### Requirement: Um único cálculo por consulta
Pedidos simultâneos da mesma consulta do mesmo app SHALL compartilhar um único cálculo, mesmo que cheguem a processos diferentes da API. Consultas diferentes (período, filtros, fonte) SHALL ter cálculos independentes.

#### Scenario: Duas abas abertas ao mesmo tempo
- **WHEN** o mesmo usuário abre o Insights em duas abas com o cálculo ainda em andamento
- **THEN** as duas recebem `202`
- **AND** só um cálculo roda; ambas recebem o resultado quando ele fica pronto

#### Scenario: Períodos diferentes
- **WHEN** duas consultas pedem períodos diferentes
- **THEN** cada uma tem o seu cálculo

### Requirement: Consulta do andamento
Enquanto o cálculo não termina, repetir a mesma consulta SHALL devolver `202` com `status: "computing"`. Ao terminar com sucesso, SHALL devolver `200` com o painel.

Se o cálculo falhar, a consulta SHALL deixar de responder `computing` e SHALL responder com a mensagem de falha de leitura já usada pelo Insights (`502`, sem detalhes do portal). A próxima abertura SHALL iniciar um novo cálculo. Um cálculo que passa de um prazo máximo sem terminar SHALL ser dado como falho, para a tela não ficar em "calculando" para sempre.

#### Scenario: Cálculo conclui
- **WHEN** o cálculo termina com sucesso e a tela repete a consulta
- **THEN** a API responde `200` com o painel

#### Scenario: Cálculo falha
- **WHEN** o cálculo falha (ex.: Vibe API fora do ar)
- **THEN** a consulta seguinte recebe `502` com a mensagem de falha de leitura
- **AND** uma nova abertura inicia outro cálculo

#### Scenario: Cálculo travado
- **WHEN** o cálculo ultrapassa o prazo máximo sem concluir
- **THEN** a consulta responde `502` em vez de `computing`

### Requirement: Leituras de dias fechados são reaproveitadas
As sessões lidas na Vibe API, já com as métricas de mensagem calculadas, SHALL ser guardadas por dia de Brasília em armazenamento compartilhado entre os processos da API e sobrevivente a reinício. Um dia já guardado SHALL NOT ser relido enquanto a entrada for válida.

- Dias fechados (anteriores a ontem) SHALL ter validade longa.
- Hoje e ontem SHALL ter validade curta, pois ainda recebem sessões novas e fechamentos.
- Alargar o período SHALL ler apenas os dias que ainda não estão guardados.
- Um dia SHALL só ser guardado se foi lido por inteiro e sem falha de leitura de sessão.

#### Scenario: Reinício da API
- **WHEN** a API é reiniciada (deploy) e um usuário abre o painel de 7 dias
- **THEN** os dias fechados guardados não são relidos na Vibe API
- **AND** apenas hoje e ontem são lidos de novo

#### Scenario: Período alargado
- **WHEN** o usuário passa de 7 para 30 dias
- **THEN** só os dias que não estavam guardados são lidos

#### Scenario: Leitura parcial não é guardada
- **WHEN** a leitura de um dia falha no meio
- **THEN** nada desse dia é guardado

### Requirement: Resultado idêntico ao cálculo atual
O painel entregue por este fluxo SHALL ter os mesmos valores que o cálculo atual produziria com os mesmos dados. O período anterior SHALL continuar lendo as mensagens dos chats, e a concorrência de leitura de chats na Vibe API SHALL NOT aumentar.

#### Scenario: Mesmos dados, mesmo painel
- **WHEN** o painel é calculado em segundo plano com os mesmos dados de um cálculo feito no fluxo atual
- **THEN** todos os indicadores, séries e listas são iguais

#### Scenario: Período anterior
- **WHEN** o painel é calculado
- **THEN** as sessões do período anterior têm `initiatedBy` e `acceptedAt` calculados a partir das mensagens

### Requirement: Mudança de configuração descarta resultados
Salvar a configuração do Insights, ou gravar ou remover a chave Vibecode, SHALL descartar os resultados guardados do app e SHALL impedir que um cálculo já em andamento grave o resultado calculado com a configuração antiga.

#### Scenario: Configuração salva durante um cálculo
- **WHEN** o admin salva a configuração enquanto o painel está sendo calculado
- **THEN** o resultado desse cálculo não é guardado
- **AND** a próxima abertura calcula com a configuração nova

#### Scenario: Chave removida
- **WHEN** a chave Vibecode do app é removida
- **THEN** resultados guardados do app são descartados e o próximo painel sai pelo REST clássico

### Requirement: Isolamento entre apps e ambientes
Resultados e leituras guardados SHALL ser separados por app e por ambiente. Um app SHALL NOT receber dados de outro, e staging SHALL NOT ler nem apagar dados de produção quando compartilham o mesmo Redis.

#### Scenario: Dois apps
- **WHEN** dois apps abrem o Insights com o mesmo período
- **THEN** cada um recebe apenas o seu painel

#### Scenario: Staging e produção
- **WHEN** staging e produção usam o mesmo servidor Redis
- **THEN** uma invalidação em staging não apaga resultados de produção

### Requirement: Pré-aquecimento do período padrão
Um job agendado SHALL calcular o painel "Agora" e o painel de Desempenho do período padrão (últimos 7 dias, sem filtros, granularidades padrão) para os apps que abriram o Insights nos últimos 7 dias, de modo que a abertura típica encontre resultado pronto.

- Apps sem abertura recente SHALL NOT ser pré-aquecidos.
- O pré-aquecimento SHALL rodar um app por vez e SHALL respeitar a mesma concorrência de leitura de chats.
- Falha no pré-aquecimento de um app SHALL NOT impedir o dos demais nem ser mostrada a usuários.
- Abertura do Insights SHALL registrar o app como "usado recentemente".

#### Scenario: App ativo
- **WHEN** um app abriu o Insights ontem e o job de pré-aquecimento roda
- **THEN** o "Agora" e o Desempenho do período padrão desse app são calculados e guardados
- **AND** a abertura seguinte com o período padrão recebe `200`

#### Scenario: App inativo
- **WHEN** um app não abre o Insights há mais de 7 dias
- **THEN** o job não calcula o painel dele

#### Scenario: Falha isolada
- **WHEN** o pré-aquecimento de um app falha
- **THEN** o job segue com os demais apps

### Requirement: Sessões que não puderam ser lidas por inteiro são sinalizadas
Quando a Vibe API responde `429` ao ler as mensagens de um chat, a leitura SHALL ser tentada de novo com espera maior antes de desistir. Se a leitura ainda falhar, a sessão SHALL ser marcada como incompleta (sem as métricas de mensagem) e o painel SHALL informar quantas sessões do período ficaram incompletas. O painel SHALL NOT tratar essas sessões como se tivessem sido lidas por completo.

Um dia que contém sessão incompleta SHALL ter validade curta no armazenamento, para ser lido de novo na abertura seguinte em vez de ficar guardado incompleto.

#### Scenario: 429 que passa na nova tentativa
- **WHEN** a Vibe API responde `429` na leitura de um chat e a nova tentativa funciona
- **THEN** a sessão sai com as métricas de mensagem completas
- **AND** o painel não indica sessões incompletas

#### Scenario: 429 persistente
- **WHEN** a leitura do chat continua falhando por `429` após as tentativas
- **THEN** a sessão é marcada como incompleta
- **AND** o painel informa a quantidade de sessões incompletas do período

#### Scenario: Dia incompleto não fica guardado por muito tempo
- **WHEN** um dia foi guardado com sessão incompleta
- **THEN** a validade dele é curta e a próxima abertura tenta ler de novo

### Requirement: Tela mostra o andamento e atualiza sozinha
Ao receber `202`, a tela do Insights SHALL mostrar que o painel está sendo calculado e SHALL repetir a consulta até receber o resultado ou uma falha, sem exigir que o usuário recarregue a página. Trocar o filtro ou o período enquanto aguarda SHALL descartar a espera anterior e SHALL NOT deixar uma resposta atrasada sobrescrever a mais nova. Resultado desatualizado SHALL ser exibido normalmente, e a tela SHALL atualizar quando o novo ficar pronto.

#### Scenario: Aguardando o cálculo
- **WHEN** a API responde `202`
- **THEN** a tela mostra o estado de cálculo e consulta de novo a cada poucos segundos
- **AND** exibe o painel assim que a API responde `200`

#### Scenario: Troca de filtro durante a espera
- **WHEN** o usuário muda o período enquanto a tela aguarda um cálculo
- **THEN** a espera anterior é descartada e a tela passa a aguardar a nova consulta

#### Scenario: Falha
- **WHEN** a consulta responde `502`
- **THEN** a tela mostra a mensagem de erro e permite tentar de novo
