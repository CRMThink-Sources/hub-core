# Spec Delta

## Purpose

Define o vínculo entre uma novidade do ThinkZap e uma tarefa do Bitrix24 interno da CRMThink: busca e criação da tarefa, e a sincronização da conclusão nos dois sentidos, para que o time atualize só um lugar.

## ADDED Requirements

### Requirement: Buscar tarefa para vincular
O backoffice SHALL oferecer um único campo de busca de tarefas no portal da CRMThink:
- **número:** busca a tarefa por ID, em qualquer grupo;
- **texto:** busca por título no projeto configurado (padrão: grupo 2677, "Produtos | Desenvolvimento e Sustentação"), com no máximo 20 resultados, mais recentes primeiro.

Cada resultado SHALL mostrar ID, título, status e responsável. Uma tarefa de fora do projeto configurado SHALL vir marcada com aviso.

#### Scenario: Busca por título
- **WHEN** um operador digita "template" no campo de busca
- **THEN** a lista mostra até 20 tarefas do grupo 2677 cujo título contém "template"

#### Scenario: Busca por ID de outro grupo
- **WHEN** um operador digita o ID de uma tarefa que pertence a outro grupo
- **THEN** a tarefa aparece com o aviso "fora do projeto" e ainda pode ser vinculada

#### Scenario: Bitrix indisponível
- **WHEN** a consulta ao Bitrix falha
- **THEN** a busca mostra um erro e nada é vinculado

### Requirement: Vincular e desvincular tarefa
Uma novidade SHALL ter no máximo uma tarefa vinculada, e uma tarefa SHALL estar vinculada a no máximo uma novidade. Tentar vincular uma tarefa já usada SHALL responder `409` com a novidade que a usa. Ao vincular, o backoffice SHALL ler o status atual da tarefa e aplicar a regra de conclusão. Desvincular SHALL manter a situação da novidade.

#### Scenario: Vincular tarefa já concluída
- **WHEN** um operador vincula uma tarefa com status "concluída" a uma novidade pendente
- **THEN** a novidade fica concluída ("Aguardando revisão" ou rascunho concluído)

#### Scenario: Tarefa já usada
- **WHEN** um operador tenta vincular uma tarefa já vinculada a outra novidade
- **THEN** a API responde `409` informando qual novidade usa a tarefa

### Requirement: Criar tarefa a partir do backoffice
Numa novidade sem tarefa vinculada, um operador SHALL poder criar a tarefa no Bitrix. A tarefa SHALL ser criada:
- no projeto configurado;
- com o título e a descrição em português da novidade;
- com um link para a novidade no backoffice;
- com o responsável que o operador escolher numa busca de usuários ativos do portal da CRMThink (por nome ou e-mail).

A tarefa criada SHALL ficar vinculada à novidade.

#### Scenario: Criação com responsável
- **WHEN** um operador escolhe o responsável "Maria" e cria a tarefa
- **THEN** uma tarefa é criada no grupo 2677 com Maria como responsável, e a novidade passa a mostrar o ID dela

#### Scenario: Responsável obrigatório
- **WHEN** um operador tenta criar a tarefa sem escolher responsável
- **THEN** a API responde `422` e nenhuma tarefa é criada

### Requirement: Regra de conclusão pela tarefa
O status da tarefa vinculada SHALL definir a conclusão da novidade assim:
- **Status "concluída" (5, já aprovada):** a novidade SHALL ser concluída.
- **"Aguardando controle" (4):** a novidade SHALL NOT ser concluída. O backoffice SHALL mostrar "aguardando aprovação no Bitrix".
- **Qualquer outro status:** a novidade SHALL voltar para pendente, a menos que já esteja disponível. Uma novidade disponível SHALL NOT mudar por causa da tarefa.

Aplicar a regra mais de uma vez com o mesmo status SHALL NOT ter efeito adicional.

#### Scenario: Concluída no Bitrix
- **WHEN** a tarefa vinculada a uma novidade "Em breve" passa para "concluída" no Bitrix
- **THEN** a novidade passa para "Aguardando revisão"

#### Scenario: Aguardando controle
- **WHEN** a tarefa vinculada passa para "aguardando controle"
- **THEN** a novidade continua pendente e o backoffice mostra "aguardando aprovação no Bitrix"

#### Scenario: Reaberta antes de disponível
- **WHEN** a tarefa de uma novidade "Aguardando revisão" é reaberta no Bitrix
- **THEN** a novidade volta para "Em breve"

#### Scenario: Reaberta depois de disponível
- **WHEN** a tarefa de uma novidade "Disponível" é reaberta no Bitrix
- **THEN** a novidade continua "Disponível" e só o status da tarefa exibido no backoffice muda

### Requirement: Eventos de tarefa do portal da CRMThink
A API SHALL expor `POST /api/webhooks/crmthink-tasks` para os eventos `ONTASKUPDATE` e `ONTASKDELETE` do portal da CRMThink.
- **Autenticação:** o endpoint SHALL comparar o `application_token` do evento com um token configurado. Sem token configurado, SHALL responder `503`. Com token errado, SHALL responder `401`.
- **Respostas:** payloads malformados ou eventos de tarefas não vinculadas SHALL receber `200` sem nenhuma consulta ao Bitrix.
- **Tarefa vinculada atualizada:** o status atual SHALL ser lido de forma assíncrona e a regra de conclusão aplicada.
- **Tarefa vinculada excluída:** a novidade SHALL ser desvinculada e manter a situação.

#### Scenario: Tarefa não vinculada
- **WHEN** chega `ONTASKUPDATE` de uma tarefa que nenhuma novidade usa
- **THEN** a resposta é `200` e nenhuma chamada ao Bitrix é feita

#### Scenario: Token inválido
- **WHEN** chega um evento com `application_token` diferente do configurado
- **THEN** a resposta é `401` e nada é processado

#### Scenario: Tarefa excluída
- **WHEN** chega `ONTASKDELETE` de uma tarefa vinculada
- **THEN** a novidade fica sem tarefa vinculada e mantém a situação

### Requirement: Concluir e reabrir pelo backoffice
Para uma novidade com tarefa vinculada:
- **Marcar como concluída:** SHALL concluir a tarefa no Bitrix, ler o status resultante e aplicar a regra de conclusão. Se a tarefa ficar "aguardando controle", a novidade SHALL continuar pendente e a resposta SHALL avisar que a conclusão foi enviada para aprovação.
- **Desmarcar concluída:** SHALL reabrir a tarefa no Bitrix.

Se o Bitrix falhar em qualquer das duas ações, a novidade SHALL NOT mudar e a API SHALL devolver o erro. Sem tarefa vinculada, as duas ações só mudam a novidade.

#### Scenario: Concluir com aprovação exigida
- **WHEN** um operador marca como concluída uma novidade cuja tarefa exige aprovação do criador
- **THEN** a tarefa fica "aguardando controle" no Bitrix, a novidade continua pendente e a tela avisa que a conclusão aguarda aprovação

#### Scenario: Bitrix falha ao concluir
- **WHEN** o Bitrix responde erro ao concluir a tarefa
- **THEN** a novidade continua como estava e a tela mostra o erro

### Requirement: Reconciliação periódica
Um job SHALL rodar de hora em hora em uma única instância. Ele SHALL ler em lote o status das tarefas vinculadas a novidades não disponíveis, incluindo as "aguardando controle", e aplicar a regra de conclusão. Falha numa tarefa SHALL NOT impedir as demais.

#### Scenario: Evento perdido
- **WHEN** uma tarefa vinculada foi concluída no Bitrix e o evento não chegou
- **THEN** na próxima execução do job a novidade passa para concluída

### Requirement: Sincronização desligável por ambiente
Uma configuração de ambiente SHALL desligar a sincronização com o Bitrix. Com ela desligada:
- criar, concluir e reabrir tarefas no Bitrix SHALL ser recusado com `409 { reason: 'tasks-sync-disabled' }`;
- o webhook de tarefas SHALL responder `200` sem processar;
- a reconciliação SHALL NOT rodar;
- buscar e vincular tarefas SHALL continuar funcionando.

#### Scenario: Homologação
- **WHEN** a sincronização está desligada e um operador marca como concluída uma novidade com tarefa vinculada
- **THEN** a API responde `409` com `tasks-sync-disabled` e nem a tarefa nem a novidade mudam

### Requirement: Conversa da tarefa vinculada
O backoffice SHALL mostrar a conversa da tarefa do Bitrix vinculada a uma novidade e permitir enviar mensagens a ela.
- **Leitura:** a API SHALL devolver as últimas 50 mensagens, da mais antiga para a mais nova. Cada uma traz id, autor (id e nome), texto, data e se é mensagem do sistema (avisos automáticos do Bitrix, como mudança de status). Ler SHALL funcionar com a sincronização desligada.
- **Envio:** a mensagem SHALL ser criada no Bitrix em nome do usuário do Bitrix vinculado ao usuário do backoffice que a enviou, nunca em nome do dono do webhook. O texto SHALL ter de 1 a 4000 caracteres depois de aparado.
- **Recusas:**
  - sem tarefa vinculada, `409` com `no-task-linked`;
  - sincronização desligada, `409` com `tasks-sync-disabled` (só no envio);
  - texto vazio ou longo demais, `422` com `invalid-message`;
  - usuário do backoffice sem ID do Bitrix, `422` com `bitrix-user-not-linked`;
  - Bitrix fora do ar, `502` com `crmthink-tasks-unavailable`.
- **Alternativa:** se o Bitrix recusar o envio com o autor, a API SHALL tentar o método atual de envio ao chat da tarefa, que não aceita autor. Nesse caso a mensagem sai em nome do dono do webhook com o texto prefixado por `<nome do usuário> (via backoffice): `, e o envio SHALL ser registrado em log como aviso.
- Anexos e edição ou exclusão de mensagens ficam fora.

#### Scenario: Ler a conversa
- **WHEN** um operador abre uma novidade com tarefa vinculada
- **THEN** a tela mostra as mensagens da tarefa da mais antiga para a mais nova, com as mensagens do sistema destacadas como tais

#### Scenario: Enviar mensagem
- **WHEN** um operador com ID do Bitrix 42 envia "Pode revisar?" na tarefa vinculada
- **THEN** a mensagem aparece no Bitrix como escrita pelo usuário 42 e a conversa mostrada é atualizada

#### Scenario: Envio com autor recusado pelo Bitrix
- **WHEN** o Bitrix recusa o envio com o autor e o método atual de envio funciona
- **THEN** a mensagem aparece na tarefa com o prefixo "Maria (via backoffice): " no texto, o operador vê a mensagem como enviada e o log registra o aviso

#### Scenario: Usuário sem vínculo
- **WHEN** um operador sem ID do Bitrix tenta enviar uma mensagem
- **THEN** a API responde `422` com `bitrix-user-not-linked` e nada é enviado ao Bitrix

#### Scenario: Sem tarefa
- **WHEN** a novidade não tem tarefa vinculada e alguém pede a conversa ou envia uma mensagem
- **THEN** a API responde `409` com `no-task-linked`

#### Scenario: Sincronização desligada
- **WHEN** a sincronização está desligada e um operador tenta enviar uma mensagem
- **THEN** a API responde `409` com `tasks-sync-disabled`, mas ler a conversa continua funcionando
