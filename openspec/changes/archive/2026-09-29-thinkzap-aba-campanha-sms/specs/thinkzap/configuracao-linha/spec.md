# Spec Delta

## Purpose

Define como a tela de configuração de uma linha do ThinkZap organiza suas seções em abas — em especial a aba dedicada à Campanha de SMS do Bitrix24 — e como o usuário salva, descarta e é protegido de perder as alterações feitas na aba Ajustes.

## ADDED Requirements

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
- **THEN** a aba mostra Identificação, Canal aberto e Comportamento, e nenhum conteúdo de Campanha de SMS

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

### Requirement: Barra de salvamento da aba Ajustes
A aba Ajustes SHALL oferecer uma única barra de salvamento, visível no rodapé da área da aba independentemente da rolagem e fora de qualquer card, que cobre todos os campos editáveis da aba (nome da linha e toggles de comportamento). A barra SHALL:
- indicar se há alterações não salvas e quantos campos foram alterados;
- ter a ação "Salvar alterações", habilitada somente quando houver alteração, o nome for válido (não vazio) e a linha não estiver bloqueada;
- ter a ação "Descartar", habilitada somente quando houver alteração, que restaura os valores gravados;
- mostrar estado de salvamento em andamento e impedir clique duplo enquanto salva.

Ações imediatas da aba (vincular/desvincular canal aberto) NÃO SHALL depender da barra e NÃO SHALL contar como alteração pendente.

O card Comportamento NÃO SHALL conter botão de salvar.

#### Scenario: Sem alterações
- **WHEN** o usuário abre a aba Ajustes e não altera nada
- **THEN** a barra indica que não há alterações pendentes e as ações Salvar alterações e Descartar ficam desabilitadas

#### Scenario: Alteração de nome e toggle salva junto
- **WHEN** o usuário altera o nome da linha e marca "Prefixar nome do operador", e clica em Salvar alterações
- **THEN** o sistema grava os dois campos numa única operação, mostra confirmação de sucesso, e a barra volta ao estado sem alterações

#### Scenario: Contagem de alterações
- **WHEN** o usuário altera o nome e um toggle
- **THEN** a barra indica 2 alterações não salvas

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
