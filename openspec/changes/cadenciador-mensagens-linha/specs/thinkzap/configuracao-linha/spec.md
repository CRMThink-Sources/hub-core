# Spec Delta

## ADDED Requirements

### Requirement: Aba Limites de envio da linha não oficial
A configuração de uma linha não oficial (Z-API) SHALL ter a aba "Limites de envio", com dois cards, nesta ordem:

1. **Limite diário**. O card SHALL conter:
   - o toggle para ativar ou desativar o limite diário;
   - o campo numérico do limite, editável só com o toggle ativado. Com o toggle ativado, o campo vazio, zero ou não inteiro SHALL mostrar mensagem de valor inválido;
   - o uso do dia, conforme a capability `thinkzap/limite-diario-mensagens`;
   - a ação "Liberar limite temporário", disponível só com o limite **gravado** como ativado. A ação SHALL pedir a quantidade de mensagens extras e confirmar que elas valem só para hoje;
   - a ação "Zerar uso de hoje", conforme a capability `thinkzap/limite-diario-mensagens`, com confirmação.
2. **Cadenciador**. O card SHALL conter:
   - o toggle para ativar ou desativar a cadência;
   - os campos numéricos "mensagens por janela" e "duração da janela (minutos)", editáveis só com a cadência ativada;
   - o toggle da pausa e o campo "duração da pausa (minutos)", editável só com a pausa ativada;
   - o toggle "contar mensagens enviadas pelo aparelho", desligado por padrão e editável só com a cadência ativada;
   - o estado atual da cadência, conforme a capability `thinkzap/cadencia-envio-mensagens`;
   - a informação de que alterações passam a valer a partir da próxima janela.

   Com a cadência ativada, um campo de N ou D vazio, zero ou não inteiro SHALL mostrar mensagem de valor inválido. O mesmo vale para P com a pausa ativada.

Os dois cards são independentes. O limite diário e a cadência SHALL vir **desativados** por padrão, e o usuário pode ativar um, o outro, os dois ou nenhum. Os campos SHALL NOT vir pré-preenchidos com valores sugeridos.

A linha oficial (HubMessage) SHALL NOT exibir a aba.

Com a linha bloqueada, os toggles, os campos e a ação de liberação SHALL ficar desabilitados. O uso do dia e o estado da cadência SHALL continuar visíveis.

A liberação temporária e o zerar uso de hoje são ações imediatas. Elas SHALL NOT depender da barra de salvamento e SHALL NOT contar como alteração pendente. Depois de cada uma, o uso do dia exibido SHALL ser atualizado.

#### Scenario: Linha não oficial mostra a aba
- **WHEN** o usuário abre a aba Limites de envio de uma linha Z-API
- **THEN** a aba mostra os cards Limite diário e Cadenciador, os dois desativados numa linha que nunca foi configurada

#### Scenario: Linha oficial não mostra a aba
- **WHEN** o usuário abre a configuração de uma linha HubMessage
- **THEN** a navegação não mostra a aba Limites de envio

#### Scenario: Cadência inválida
- **WHEN** o usuário ativa o cadenciador e deixa "mensagens por janela" vazio
- **THEN** a mensagem de valor inválido aparece no campo

#### Scenario: Liberar limite temporário
- **WHEN** o usuário, numa linha com limite gravado como ativo, clica em "Liberar limite temporário", informa 100 e confirma
- **THEN** os extras são gravados na hora e o uso do dia passa a mostrar o novo limite efetivo
- **AND** a barra de salvamento continua sem alterações pendentes

#### Scenario: Liberação indisponível com limite não gravado
- **WHEN** o usuário ativa o toggle do limite mas ainda não salvou
- **THEN** a ação "Liberar limite temporário" continua desabilitada

### Requirement: Barra de salvamento da aba Limites de envio
A aba Limites de envio SHALL oferecer uma única barra de salvamento, com o mesmo comportamento da barra da aba Ajustes. Ela cobre:

- o toggle e o valor do limite diário;
- o toggle da cadência, N, D, o toggle da pausa, P e o toggle de contar mensagens enviadas pelo aparelho.

A barra SHALL:

- indicar se há alterações não salvas e quantos campos foram alterados;
- ter a ação "Salvar alterações", habilitada só quando houver alteração, a linha não estiver bloqueada e os campos ativados forem válidos;
- ter a ação "Descartar", habilitada só quando houver alteração, que restaura os valores gravados;
- mostrar estado de salvamento em andamento e impedir clique duplo enquanto salva.

Os campos de um recurso desativado SHALL NOT ser validados nem impedir o salvamento. Os cards Limite diário e Cadenciador SHALL NOT ter botão de salvar próprio.

#### Scenario: Limite diário conta como alteração
- **WHEN** o usuário ativa o limite diário e informa 300
- **THEN** a barra indica 2 alterações não salvas, e salvar grava os dois numa única operação

#### Scenario: Cadência e limite salvos juntos
- **WHEN** o usuário ativa o limite diário com 300 e o cadenciador com N = 20 e D = 1 e clica em Salvar alterações
- **THEN** o sistema grava tudo numa única operação, mostra confirmação de sucesso e a barra volta ao estado sem alterações

#### Scenario: Valor inválido impede salvar
- **WHEN** o usuário ativa a pausa e deixa a duração vazia
- **THEN** a mensagem de valor inválido aparece e Salvar alterações fica desabilitado, enquanto Descartar continua disponível

#### Scenario: Falha ao salvar mantém as edições
- **WHEN** a gravação falha
- **THEN** o sistema mostra o erro, mantém os valores editados na tela e a barra continua indicando alterações pendentes

## MODIFIED Requirements

### Requirement: Abas da configuração por tipo de linha
A tela de configuração da linha SHALL exibir as abas conforme o provider da linha:
- Linha não oficial (Z-API): Conexão, Grupos, Configurações, Limites de envio, Campanha de SMS — nesta ordem.
- Linha oficial (HubMessage): Conexão, Templates, Configurações, Campanha de SMS — nesta ordem.

A aba Configurações é a que se chamava Ajustes: só o nome exibido mudou, e os requisitos que a chamam de "aba Ajustes" valem para ela.

A aba inicial SHALL continuar sendo Conexão. Linha sem provider SHALL continuar mostrando apenas o aviso de linha sem provider, sem abas.

#### Scenario: Linha não oficial mostra a aba Campanha de SMS
- **WHEN** o usuário abre a configuração de uma linha Z-API
- **THEN** a navegação mostra as abas Conexão, Grupos, Configurações, Limites de envio e Campanha de SMS, com Conexão selecionada

#### Scenario: Linha oficial mostra a aba Campanha de SMS
- **WHEN** o usuário abre a configuração de uma linha HubMessage
- **THEN** a navegação mostra as abas Conexão, Templates, Configurações e Campanha de SMS, com Conexão selecionada

### Requirement: Campanha de SMS do Bitrix24 em aba própria
A configuração da linha como provedor da Campanha de SMS do Bitrix24 SHALL ficar exclusivamente na aba Campanha de SMS e NÃO SHALL aparecer na aba Ajustes. A aba SHALL manter o comportamento atual da funcionalidade: aviso de que o Bitrix24 rotula o canal como SMS, aviso de risco de bloqueio para linha não oficial, estado registrado/não registrado, oferecer/remover com confirmação (e ciência explícita de risco na linha não oficial), mensagem de indisponibilidade quando o ambiente não suporta o recurso, e a lista de templates por provedor na linha oficial.

#### Scenario: Aba Ajustes sem Campanha de SMS
- **WHEN** o usuário abre a aba Ajustes de qualquer linha
- **THEN** a aba mostra Identificação, Canal aberto e Comportamento, e nenhum conteúdo de Campanha de SMS nem de limites de envio

#### Scenario: Oferecer linha não oficial nas campanhas
- **WHEN** o usuário, na aba Campanha de SMS de uma linha Z-API ativa e não registrada, clica em "Oferecer nas campanhas"
- **THEN** o sistema pede confirmação com ciência explícita do risco de bloqueio antes de registrar a linha como provedor

#### Scenario: Linha oficial mostra templates da campanha
- **WHEN** o usuário abre a aba Campanha de SMS de uma linha HubMessage
- **THEN** a aba mostra a lista de templates com a ação de oferecer/remover em cada um

### Requirement: Barra de salvamento da aba Ajustes
A aba Ajustes SHALL oferecer uma única barra de salvamento. A barra SHALL ficar visível no rodapé da área da aba independentemente da rolagem, fora de qualquer card. Ela cobre todos os campos editáveis da aba:

- o nome da linha;
- os toggles de comportamento.

A barra SHALL:
- indicar se há alterações não salvas e quantos campos foram alterados;
- ter a ação "Salvar alterações", habilitada somente quando houver alteração, a linha não estiver bloqueada e o nome não estiver vazio;
- ter a ação "Descartar", habilitada somente quando houver alteração, que restaura os valores gravados;
- mostrar estado de salvamento em andamento e impedir clique duplo enquanto salva.

Ações imediatas da aba NÃO SHALL depender da barra e NÃO SHALL contar como alteração pendente. É o caso de vincular e desvincular o canal aberto.

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

#### Scenario: Limite diário conta como alteração
- **WHEN** o usuário de uma linha não oficial ativa o limite diário e informa 300 na aba Limites de envio
- **THEN** a barra da aba Limites de envio indica 2 alterações não salvas
- **AND** a barra da aba Ajustes continua sem alterações pendentes

#### Scenario: Limite inválido impede salvar
- **WHEN** o usuário ativa o limite diário na aba Limites de envio e deixa o valor vazio
- **THEN** só a barra da aba Limites de envio fica com Salvar alterações desabilitado
- **AND** a validação do limite não afeta a barra da aba Ajustes

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
Com alterações pendentes na aba Ajustes ou na aba Limites de envio, o sistema SHALL pedir confirmação antes de descartá-las ao trocar de aba na tela de configuração, e SHALL acionar o aviso nativo do navegador ao fechar ou recarregar a página. Sem alterações pendentes, a troca de aba e a saída SHALL ocorrer sem confirmação.

#### Scenario: Trocar de aba com alterações pendentes
- **WHEN** o usuário altera um toggle na aba Ajustes e clica na aba Campanha de SMS
- **THEN** o sistema pede confirmação; ao confirmar, troca de aba descartando as alterações; ao cancelar, permanece em Ajustes com as alterações intactas

#### Scenario: Trocar de aba com cadência pendente
- **WHEN** o usuário altera a duração da janela na aba Limites de envio e clica na aba Conexão
- **THEN** o sistema pede confirmação antes de descartar a alteração

#### Scenario: Trocar de aba sem alterações
- **WHEN** o usuário, sem alterações pendentes, clica em outra aba
- **THEN** a troca acontece imediatamente, sem confirmação

#### Scenario: Recarregar a página com alterações pendentes
- **WHEN** o usuário tenta recarregar ou fechar a página com alterações pendentes na aba Ajustes ou na aba Limites de envio
- **THEN** o navegador exibe o aviso nativo de saída da página

## REMOVED Requirements

### Requirement: Card Limite diário na aba Ajustes da linha não oficial
**Reason**: O card Limite diário sai da aba Ajustes e vai para a nova aba "Limites de envio", junto com o Cadenciador.
**Migration**: O conteúdo e o comportamento do card continuam os mesmos, agora no requisito "Aba Limites de envio da linha não oficial". Os valores já gravados do limite diário não mudam.
