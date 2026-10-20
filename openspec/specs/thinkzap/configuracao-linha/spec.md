# thinkzap/configuracao-linha Specification

## Purpose

Define como a tela de configuração de uma linha do ThinkZap organiza suas seções em abas — em especial a aba dedicada à Campanha de SMS do Bitrix24 — e como o usuário salva, descarta e é protegido de perder as alterações feitas na aba Ajustes.

## Requirements

### Requirement: Abas da configuração por tipo de linha
A tela de configuração da linha SHALL exibir as abas conforme o provider da linha:
- Linha não oficial (Z-API): Conexão, Grupos, Ajustes, Campanha de SMS — nesta ordem.
- Linha oficial (HubMessage): Conexão, Templates, Ajustes, Campanha de SMS — nesta ordem.

A aba inicial SHALL continuar sendo Conexão. Linha sem provider SHALL continuar mostrando apenas o aviso de linha sem provider, sem abas.

#### Scenario: Linha não oficial mostra a aba Campanha de SMS
- **WHEN** o usuário abre a configuração de uma linha Z-API
- **THEN** a navegação mostra as abas Conexão, Grupos, Ajustes e Campanha de SMS, com Conexão selecionada

#### Scenario: Linha oficial mostra a aba Campanha de SMS
- **WHEN** o usuário abre a configuração de uma linha HubMessage
- **THEN** a navegação mostra as abas Conexão, Templates, Ajustes e Campanha de SMS, com Conexão selecionada

### Requirement: Campanha de SMS do Bitrix24 em aba própria
A configuração da linha como provedor da Campanha de SMS do Bitrix24 SHALL ficar exclusivamente na aba Campanha de SMS e NÃO SHALL aparecer na aba Ajustes. A aba SHALL manter o comportamento atual da funcionalidade: aviso de que o Bitrix24 rotula o canal como SMS, aviso de risco de bloqueio para linha não oficial, estado registrado/não registrado, oferecer/remover com confirmação (e ciência explícita de risco na linha não oficial), mensagem de indisponibilidade quando o ambiente não suporta o recurso, e a lista de templates por provedor na linha oficial.

#### Scenario: Aba Ajustes sem Campanha de SMS
- **WHEN** o usuário abre a aba Ajustes de qualquer linha
- **THEN** a aba mostra Identificação, Canal aberto e Comportamento (e, na linha não oficial, Limite diário), e nenhum conteúdo de Campanha de SMS

#### Scenario: Oferecer linha não oficial nas campanhas
- **WHEN** o usuário, na aba Campanha de SMS de uma linha Z-API ativa e não registrada, clica em "Oferecer nas campanhas"
- **THEN** o sistema pede confirmação com ciência explícita do risco de bloqueio antes de registrar a linha como provedor

#### Scenario: Linha oficial mostra templates da campanha
- **WHEN** o usuário abre a aba Campanha de SMS de uma linha HubMessage
- **THEN** a aba mostra a lista de templates com a ação de oferecer/remover em cada um

### Requirement: Campanha de SMS respeita linha bloqueada
Quando a assinatura da linha não estiver ativa (teste encerrado ou sem assinatura ativa), a aba Campanha de SMS SHALL exibir o aviso de linha bloqueada e SHALL manter visível o estado atual, com as ações de oferecer/remover desabilitadas.

#### Scenario: Linha com teste encerrado
- **WHEN** o usuário abre a aba Campanha de SMS de uma linha cujo período de teste terminou
- **THEN** a aba mostra o aviso de período de teste encerrado, o estado atual do provedor, e os botões de oferecer/remover desabilitados

### Requirement: Card Limite diário na aba Ajustes da linha não oficial
A aba Ajustes de uma linha não oficial (Z-API) SHALL exibir o card "Limite diário" depois do card Comportamento. O card SHALL conter:

- o toggle para ativar ou desativar o limite diário;
- o campo numérico do limite, editável só com o toggle ativado. Com o toggle ativado, o campo vazio, zero ou não inteiro SHALL mostrar mensagem de valor inválido;
- o uso do dia, conforme a capability `thinkzap/limite-diario-mensagens`;
- a ação "Liberar limite temporário", disponível só com o limite **gravado** como ativado. A ação SHALL pedir a quantidade de mensagens extras e confirmar que elas valem só para hoje.

A aba Ajustes de uma linha oficial (HubMessage) SHALL NOT exibir o card.

A liberação temporária é uma ação imediata. SHALL NOT depender da barra de salvamento e SHALL NOT contar como alteração pendente. Depois de liberar, o uso do dia exibido SHALL ser atualizado.

Com a linha bloqueada, o card SHALL ficar com o toggle, o campo e a ação de liberação desabilitados. O uso do dia SHALL continuar visível.

#### Scenario: Linha não oficial mostra o card
- **WHEN** o usuário abre a aba Ajustes de uma linha Z-API
- **THEN** a aba mostra os cards Identificação, Canal aberto, Comportamento e Limite diário

#### Scenario: Linha oficial não mostra o card
- **WHEN** o usuário abre a aba Ajustes de uma linha HubMessage
- **THEN** a aba não mostra o card Limite diário

#### Scenario: Liberar limite temporário
- **WHEN** o usuário, numa linha com limite gravado como ativo, clica em "Liberar limite temporário", informa 100 e confirma
- **THEN** os extras são gravados na hora e o uso do dia passa a mostrar o novo limite efetivo
- **AND** a barra de salvamento continua sem alterações pendentes

#### Scenario: Liberação indisponível com limite não gravado
- **WHEN** o usuário ativa o toggle do limite mas ainda não salvou
- **THEN** a ação "Liberar limite temporário" continua desabilitada

### Requirement: Barra de salvamento da aba Ajustes
A aba Ajustes SHALL oferecer uma única barra de salvamento. A barra SHALL ficar visível no rodapé da área da aba independentemente da rolagem, fora de qualquer card. Ela cobre todos os campos editáveis da aba:

- o nome da linha;
- os toggles de comportamento;
- na linha não oficial, o toggle e o valor do limite diário.

A barra SHALL:
- indicar se há alterações não salvas e quantos campos foram alterados;
- ter a ação "Salvar alterações", habilitada somente quando houver alteração, a linha não estiver bloqueada e os campos forem válidos: nome não vazio e, com o limite diário ativado, valor de limite inteiro maior que zero;
- ter a ação "Descartar", habilitada somente quando houver alteração, que restaura os valores gravados;
- mostrar estado de salvamento em andamento e impedir clique duplo enquanto salva.

Ações imediatas da aba NÃO SHALL depender da barra e NÃO SHALL contar como alteração pendente. São elas:

- vincular e desvincular o canal aberto;
- liberar o limite temporário.

O card Comportamento e o card Limite diário NÃO SHALL conter botão de salvar.

#### Scenario: Sem alterações
- **WHEN** o usuário abre a aba Ajustes e não altera nada
- **THEN** a barra indica que não há alterações pendentes e as ações Salvar alterações e Descartar ficam desabilitadas

#### Scenario: Alteração de nome e toggle salva junto
- **WHEN** o usuário altera o nome da linha e marca "Prefixar nome do operador", e clica em Salvar alterações
- **THEN** o sistema grava os dois campos numa única operação, mostra confirmação de sucesso, e a barra volta ao estado sem alterações

#### Scenario: Contagem de alterações
- **WHEN** o usuário altera o nome e um toggle
- **THEN** a barra indica 2 alterações não salvas

#### Scenario: Limite diário conta como alteração
- **WHEN** o usuário de uma linha não oficial ativa o limite diário e informa 300
- **THEN** a barra indica 2 alterações não salvas, e salvar grava os dois numa única operação

#### Scenario: Limite inválido impede salvar
- **WHEN** o usuário ativa o limite diário e deixa o valor vazio
- **THEN** a mensagem de valor inválido aparece e Salvar alterações fica desabilitado, enquanto Descartar continua disponível

#### Scenario: Desfazer manualmente zera a pendência
- **WHEN** o usuário marca um toggle e depois o desmarca, voltando ao valor gravado
- **THEN** a barra volta ao estado sem alterações

#### Scenario: Descartar alterações
- **WHEN** o usuário altera campos e clica em Descartar
- **THEN** os campos voltam aos valores gravados e a barra volta ao estado sem alterações, sem chamada de gravação

#### Scenario: Nome vazio impede salvar
- **WHEN** o usuário apaga o nome da linha
- **THEN** a mensagem de nome obrigatório aparece e Salvar alterações fica desabilitado, enquanto Descartar continua disponível

#### Scenario: Falha ao salvar mantém as edições
- **WHEN** a gravação falha
- **THEN** o sistema mostra o erro, mantém os valores editados na tela e a barra continua indicando alterações pendentes

#### Scenario: Vincular canal não gera pendência
- **WHEN** o usuário vincula um canal aberto sem ter alterado outros campos
- **THEN** o vínculo é gravado na hora e a barra continua sem alterações pendentes

### Requirement: Proteção contra perda de alterações não salvas
Com alterações pendentes na aba Ajustes, o sistema SHALL pedir confirmação antes de descartá-las ao trocar de aba na tela de configuração, e SHALL acionar o aviso nativo do navegador ao fechar ou recarregar a página. Sem alterações pendentes, a troca de aba e a saída SHALL ocorrer sem confirmação.

#### Scenario: Trocar de aba com alterações pendentes
- **WHEN** o usuário altera um toggle na aba Ajustes e clica na aba Campanha de SMS
- **THEN** o sistema pede confirmação; ao confirmar, troca de aba descartando as alterações; ao cancelar, permanece em Ajustes com as alterações intactas

#### Scenario: Trocar de aba sem alterações
- **WHEN** o usuário, sem alterações pendentes, clica em outra aba
- **THEN** a troca acontece imediatamente, sem confirmação

#### Scenario: Recarregar a página com alterações pendentes
- **WHEN** o usuário tenta recarregar ou fechar a página com alterações pendentes na aba Ajustes
- **THEN** o navegador exibe o aviso nativo de saída da página
