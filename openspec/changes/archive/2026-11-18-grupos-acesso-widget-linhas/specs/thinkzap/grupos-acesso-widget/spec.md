# Spec Delta

## Purpose

Define os grupos de acesso do widget do ThinkZap: quem pode usar quais linhas ao enviar mensagens pelo widget do CRM, como o administrador configura isso e como o widget e o servidor aplicam a regra.

## ADDED Requirements

### Requirement: Administração de grupos de acesso
O sistema SHALL permitir que quem administra o acesso do ThinkZap crie, renomeie e exclua grupos de acesso do widget. Cada grupo SHALL ter um nome, zero ou mais usuários do Bitrix24 como membros e zero ou mais linhas do ThinkZap. O nome SHALL ser obrigatório e único dentro da instalação (sem diferenciar maiúsculas de minúsculas), e SHALL ser recusado quando vazio ou duplicado, com mensagem em português. A administração dos grupos SHALL ficar numa aba "Grupos de acesso" da administração do ThinkZap, e usuários sem permissão de administrar o acesso NÃO SHALL conseguir listar nem alterar grupos, nem pela tela nem pela API.

#### Scenario: Criar grupo com membros e linhas
- **WHEN** o administrador cria o grupo "Vendas", marca 3 usuários e 2 linhas e salva
- **THEN** o grupo passa a aparecer na lista com 3 membros e 2 linhas

#### Scenario: Nome duplicado
- **WHEN** o administrador tenta criar ou renomear um grupo para um nome já usado por outro grupo da instalação
- **THEN** o sistema recusa e informa que já existe um grupo com esse nome

#### Scenario: Usuário sem permissão
- **WHEN** um usuário que não administra o acesso do ThinkZap chama a listagem ou a alteração de grupos
- **THEN** o sistema recusa a chamada

#### Scenario: Excluir grupo
- **WHEN** o administrador exclui um grupo após confirmar
- **THEN** o grupo, seus vínculos de membros e de linhas deixam de existir e as linhas permitidas aos antigos membros são recalculadas pelos grupos restantes

### Requirement: Seleção de membros e linhas
Na edição do grupo, o administrador SHALL escolher membros entre os usuários ativos do portal Bitrix24 e linhas entre as linhas da instalação. Um usuário SHALL poder pertencer a vários grupos e uma linha SHALL poder pertencer a vários grupos. Vínculos com linhas que deixaram de existir NÃO SHALL aparecer na tela nem conceder acesso.

#### Scenario: Usuário em dois grupos
- **WHEN** o mesmo usuário é adicionado aos grupos "Vendas" e "Suporte"
- **THEN** ambos os grupos o listam como membro

#### Scenario: Linha removida do CRM
- **WHEN** uma linha vinculada a um grupo é excluída da instalação
- **THEN** o grupo deixa de exibir essa linha e ela não concede acesso a ninguém

### Requirement: Resolução das linhas permitidas ao usuário
O sistema SHALL calcular as linhas permitidas ao usuário do widget assim:
- Sem nenhum grupo de acesso na instalação, o usuário SHALL poder usar todas as linhas elegíveis para envio.
- Com ao menos um grupo na instalação, as linhas permitidas SHALL ser a **união** das linhas de todos os grupos dos quais o usuário é membro, limitada às linhas elegíveis para envio.
- Com ao menos um grupo na instalação, o usuário que não é membro de nenhum grupo, ou cujos grupos não têm linhas, SHALL ficar sem nenhuma linha permitida.
A regra SHALL valer igualmente para administradores do Bitrix24. A regra vale apenas para o widget: robôs de processo, campanha de SMS e demais envios automáticos NÃO SHALL ser restringidos por ela.

#### Scenario: Instalação sem grupos
- **WHEN** a instalação não tem nenhum grupo e o usuário abre o widget
- **THEN** todas as linhas elegíveis estão disponíveis, como antes

#### Scenario: União de grupos
- **WHEN** o usuário está no grupo A (linha 1) e no grupo B (linhas 1 e 2)
- **THEN** as linhas permitidas são 1 e 2

#### Scenario: Usuário fora de qualquer grupo
- **WHEN** existe ao menos um grupo na instalação e o usuário não é membro de nenhum
- **THEN** o usuário não tem linha permitida

#### Scenario: Grupo sem linhas
- **WHEN** o único grupo do usuário não tem linhas
- **THEN** o usuário não tem linha permitida

#### Scenario: Administrador do Bitrix24
- **WHEN** um administrador do Bitrix24 que não está em nenhum grupo abre o widget numa instalação com grupos
- **THEN** ele não tem linha permitida, como qualquer outro usuário

### Requirement: Seletor de linha no widget
O widget SHALL exibir somente as linhas permitidas ao usuário, entre as elegíveis para envio:
- Com **exatamente uma** linha permitida, o widget SHALL abri-la já selecionada e o seletor SHALL ficar travado, sem permitir trocar.
- Com **duas ou mais**, o widget SHALL abrir sem linha selecionada, listar apenas as permitidas e exigir que o usuário escolha antes de enviar.
- Com **nenhuma**, o widget SHALL informar em português que o usuário não tem linha liberada e orientar a falar com o administrador, e SHALL bloquear o envio sem descartar o texto e os anexos já digitados.
Se a linha selecionada deixar de ser permitida ou elegível enquanto o widget está aberto, a seleção SHALL ser limpa.

#### Scenario: Linha única
- **WHEN** o usuário tem permissão em apenas uma linha elegível e abre o widget
- **THEN** a linha vem selecionada e o seletor não permite alterá-la

#### Scenario: Várias linhas
- **WHEN** o usuário tem permissão em três linhas e abre o widget
- **THEN** nenhuma vem selecionada, o seletor lista só as três e o envio fica bloqueado até escolher uma

#### Scenario: Nenhuma linha
- **WHEN** o usuário não tem linha permitida
- **THEN** o widget mostra o aviso de que não há linha liberada e não permite enviar

#### Scenario: Única linha permitida não elegível
- **WHEN** a única linha permitida está bloqueada ou sem provider
- **THEN** o widget trata o usuário como sem linha permitida

### Requirement: Imposição no servidor
O servidor SHALL recusar qualquer envio feito pelo widget — mensagem livre, mensagem com anexo, template e mensagem com botões — cuja linha não esteja entre as permitidas ao usuário autenticado, com erro de domínio em português que explica que o usuário não tem acesso àquela linha e orienta procurar o administrador. A recusa SHALL ocorrer antes de qualquer enfileiramento ou chamada ao provedor. Consultas do widget vinculadas a uma linha (status da linha, templates da linha) SHALL seguir a mesma regra. O servidor NÃO SHALL aplicar essa recusa a envios de robôs de processo, campanha de SMS ou outros fluxos que não partem do usuário no widget.

#### Scenario: Chamada direta com linha não permitida
- **WHEN** um usuário chama o envio do widget com a linha 3 e só tem permissão nas linhas 1 e 2
- **THEN** o servidor recusa com o erro de linha não permitida e nada é enfileirado nem enviado

#### Scenario: Linha permitida
- **WHEN** o usuário envia por uma linha permitida e elegível
- **THEN** o envio segue o fluxo normal

#### Scenario: Envio por robô
- **WHEN** um robô de processo envia mensagem por uma linha que nenhum grupo libera para o usuário que disparou o robô
- **THEN** o envio não é afetado pela regra de grupos

#### Scenario: Instalação sem grupos
- **WHEN** a instalação não tem grupos e o usuário envia por qualquer linha elegível
- **THEN** o envio não é recusado pela regra de grupos

### Requirement: Entrega da lista de linhas permitidas ao widget
O sistema SHALL disponibilizar a qualquer usuário autenticado do widget, sem exigir permissão de administração do ThinkZap, a informação das linhas permitidas a ele e se há ou não grupos configurados. Alterações em grupos SHALL refletir no widget na próxima abertura, sem depender do cache do contexto da aplicação.

#### Scenario: Usuário comum consulta suas linhas
- **WHEN** um usuário sem permissão de administração abre o widget
- **THEN** o widget obtém suas linhas permitidas e monta o seletor conforme a regra

#### Scenario: Alteração de grupo
- **WHEN** o administrador remove uma linha do grupo do usuário e o usuário reabre o widget
- **THEN** o seletor não oferece mais essa linha
