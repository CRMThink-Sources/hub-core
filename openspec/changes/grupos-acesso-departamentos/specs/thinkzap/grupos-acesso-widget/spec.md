# Spec Delta

## MODIFIED Requirements

### Requirement: Administração de grupos de acesso
O sistema SHALL permitir que quem administra o acesso do ThinkZap crie, renomeie e exclua grupos de acesso do widget. Cada grupo SHALL ter um nome, zero ou mais usuários do Bitrix24 como membros, zero ou mais departamentos do Bitrix24 e zero ou mais linhas do ThinkZap. O nome SHALL ser obrigatório e único dentro da instalação (sem diferenciar maiúsculas de minúsculas), e SHALL ser recusado quando vazio ou duplicado, com mensagem em português. A administração dos grupos SHALL ficar numa aba "Grupos de acesso" da administração do ThinkZap, e usuários sem permissão de administrar o acesso NÃO SHALL conseguir listar nem alterar grupos, nem consultar os departamentos do portal por ela, nem pela tela nem pela API. Uma alteração que não informe os departamentos do grupo SHALL preservar os já gravados.

#### Scenario: Criar grupo com membros e linhas
- **WHEN** o administrador cria o grupo "Vendas", adiciona 3 usuários, 1 departamento e 2 linhas e salva
- **THEN** o grupo passa a aparecer na lista com os 3 usuários, o departamento e as 2 linhas

#### Scenario: Nome duplicado
- **WHEN** o administrador tenta criar ou renomear um grupo para um nome já usado por outro grupo da instalação
- **THEN** o sistema recusa e informa que já existe um grupo com esse nome

#### Scenario: Usuário sem permissão
- **WHEN** um usuário que não administra o acesso do ThinkZap chama a listagem ou a alteração de grupos, ou a consulta de departamentos
- **THEN** o sistema recusa a chamada

#### Scenario: Excluir grupo
- **WHEN** o administrador exclui um grupo após confirmar
- **THEN** o grupo e seus vínculos de usuários, departamentos e linhas deixam de existir e as linhas permitidas aos antigos membros são recalculadas pelos grupos restantes

#### Scenario: Alteração sem informar departamentos
- **WHEN** um grupo com departamentos é alterado por uma chamada que não informa a lista de departamentos
- **THEN** os departamentos do grupo permanecem como estavam

### Requirement: Seleção de membros e linhas
Na edição do grupo, o administrador SHALL escolher membros entre os usuários ativos do portal Bitrix24, departamentos entre os departamentos do portal e linhas entre as linhas da instalação. A busca de usuários SHALL alcançar qualquer usuário ativo do portal, independentemente da quantidade de usuários. Um usuário ou departamento SHALL poder pertencer a vários grupos e uma linha SHALL poder pertencer a vários grupos. Cada usuário e cada departamento SHALL aparecer no máximo uma vez no mesmo grupo. Vínculos com linhas que deixaram de existir NÃO SHALL aparecer na tela nem conceder acesso.

#### Scenario: Usuário em dois grupos
- **WHEN** o mesmo usuário é adicionado aos grupos "Vendas" e "Suporte"
- **THEN** ambos os grupos o listam como membro

#### Scenario: Linha removida do CRM
- **WHEN** uma linha vinculada a um grupo é excluída da instalação
- **THEN** o grupo deixa de exibir essa linha e ela não concede acesso a ninguém

#### Scenario: Portal com muitos usuários
- **WHEN** o portal tem 300 usuários e o administrador busca pelo nome de um que não está entre os primeiros 50
- **THEN** o usuário aparece no resultado e pode ser adicionado

#### Scenario: Item já adicionado
- **WHEN** o resultado da busca contém uma pessoa ou departamento que já está no grupo em edição
- **THEN** o item aparece sinalizado como adicionado e não pode ser incluído de novo

### Requirement: Resolução das linhas permitidas ao usuário
O sistema SHALL calcular as linhas permitidas ao usuário do widget assim:
- O usuário **pertence** a um grupo quando é um dos usuários dele, quando está lotado diretamente em um departamento do grupo, ou quando está lotado em um subdepartamento (em qualquer nível) de um departamento do grupo marcado para incluir subdepartamentos.
- Sem nenhum grupo de acesso na instalação, o usuário SHALL poder usar todas as linhas elegíveis para envio.
- Com ao menos um grupo na instalação, as linhas permitidas SHALL ser a **união** das linhas de todos os grupos aos quais o usuário pertence, limitada às linhas elegíveis para envio.
- Com ao menos um grupo na instalação, o usuário que não pertence a nenhum grupo, ou cujos grupos não têm linhas, SHALL ficar sem nenhuma linha permitida.

Um usuário lotado em vários departamentos SHALL ser avaliado por todos eles. A regra SHALL valer igualmente para administradores do Bitrix24. A regra vale apenas para o widget: robôs de processo, campanha de SMS e demais envios automáticos NÃO SHALL ser restringidos por ela.

#### Scenario: Instalação sem grupos
- **WHEN** a instalação não tem nenhum grupo e o usuário abre o widget
- **THEN** todas as linhas elegíveis estão disponíveis, como antes

#### Scenario: União de grupos
- **WHEN** o usuário está no grupo A (linha 1) como pessoa e no grupo B (linhas 1 e 2) pelo departamento
- **THEN** as linhas permitidas são 1 e 2

#### Scenario: Departamento direto
- **WHEN** o grupo tem o departamento "Comercial" e o usuário está lotado em "Comercial"
- **THEN** o usuário recebe as linhas do grupo

#### Scenario: Subdepartamento incluído
- **WHEN** o grupo tem "Comercial" marcado para incluir subdepartamentos e o usuário está lotado em "SDR", dois níveis abaixo de "Comercial"
- **THEN** o usuário recebe as linhas do grupo

#### Scenario: Subdepartamento não incluído
- **WHEN** o grupo tem "Comercial" sem incluir subdepartamentos e o usuário está lotado apenas em um subdepartamento dele
- **THEN** o usuário não recebe linhas por esse departamento

#### Scenario: Departamento superior não herda
- **WHEN** o grupo tem o departamento "SDR" e o usuário está lotado apenas no departamento superior "Comercial"
- **THEN** o usuário não recebe linhas por esse departamento

#### Scenario: Usuário fora de qualquer grupo
- **WHEN** existe ao menos um grupo na instalação e o usuário não pertence a nenhum
- **THEN** o usuário não tem linha permitida

#### Scenario: Grupo sem linhas
- **WHEN** o único grupo do usuário não tem linhas
- **THEN** o usuário não tem linha permitida

#### Scenario: Administrador do Bitrix24
- **WHEN** um administrador do Bitrix24 que não pertence a nenhum grupo abre o widget numa instalação com grupos
- **THEN** ele não tem linha permitida, como qualquer outro usuário

## ADDED Requirements

### Requirement: Departamentos no grupo
O administrador SHALL poder adicionar um departamento do Bitrix24 a um grupo e, para cada departamento adicionado, escolher se ele inclui os subdepartamentos. A opção SHALL ser apresentada no momento da inclusão, começar desmarcada e poder ser alterada depois. Um departamento gravado que não existe mais no portal SHALL aparecer identificado como não encontrado, SHALL poder ser removido e NÃO SHALL ser apagado automaticamente.

#### Scenario: Adicionar escolhendo subdepartamentos
- **WHEN** o administrador adiciona "Comercial" a um grupo, marca "incluir subdepartamentos" e salva
- **THEN** o grupo mostra "Comercial" identificado como incluindo subdepartamentos

#### Scenario: Alterar a opção depois
- **WHEN** o administrador desmarca "incluir subdepartamentos" de um departamento já adicionado e salva
- **THEN** quem está apenas nos subdepartamentos deixa de receber as linhas por ele na próxima abertura do widget

#### Scenario: Departamento excluído no Bitrix24
- **WHEN** um departamento vinculado a um grupo é excluído no portal e o administrador abre o grupo
- **THEN** o vínculo aparece como departamento não encontrado, com a opção de removê-lo

#### Scenario: Departamentos indisponíveis
- **WHEN** o portal não permite consultar departamentos
- **THEN** a tela informa em português que os departamentos não puderam ser carregados, mantém os vínculos gravados e continua permitindo editar nome, pessoas e linhas

### Requirement: Mudanças na estrutura de departamentos
Mudanças na hierarquia de departamentos do portal SHALL passar a valer para os grupos que incluem subdepartamentos em até 5 minutos. Se a hierarquia não puder ser consultada, o sistema SHALL usar a última conhecida; se não houver nenhuma conhecida, NÃO SHALL liberar linha por herança de subdepartamento, SHALL continuar liberando as linhas obtidas por usuário ou departamento direto e, ao recusar um envio que dependia da hierarquia, SHALL informar em português que não foi possível verificar os departamentos e orientar tentar novamente.

#### Scenario: Subdepartamento recém-criado
- **WHEN** um subdepartamento é criado sob um departamento que inclui subdepartamentos e um usuário é lotado nele
- **THEN** em até 5 minutos esse usuário recebe as linhas do grupo ao abrir o widget novamente

#### Scenario: Consulta falha com hierarquia conhecida
- **WHEN** a consulta de departamentos falha depois de já ter funcionado
- **THEN** o sistema decide o acesso pela última hierarquia conhecida

#### Scenario: Consulta falha sem hierarquia conhecida
- **WHEN** a hierarquia nunca foi obtida, a consulta falha e o usuário tenta enviar por uma linha que só receberia por herança
- **THEN** o servidor não envia e informa que não foi possível verificar os departamentos

#### Scenario: Acesso direto não depende da hierarquia
- **WHEN** a consulta de departamentos falha e o usuário envia por uma linha liberada a ele como pessoa
- **THEN** o envio segue normalmente

### Requirement: Visão geral dos grupos em cards
A aba "Grupos de acesso" SHALL apresentar cada grupo como um card com o nome, as pessoas (avatares com iniciais e a contagem excedente), os departamentos (com indicação de subdepartamentos) e os nomes das linhas. Pessoas e departamentos SHALL ser identificados pelo nome. O card SHALL avisar quando o grupo não tem linhas e quando não tem nenhuma pessoa nem departamento. Usuário gravado que está desativado no Bitrix24 SHALL continuar visível, sinalizado como inativo.

#### Scenario: Ver quem está no grupo
- **WHEN** o administrador abre a aba com um grupo de 8 pessoas e 2 departamentos
- **THEN** o card mostra avatares das primeiras pessoas, a quantidade restante e o nome dos 2 departamentos

#### Scenario: Membro fora da primeira página do portal
- **WHEN** um membro do grupo não está entre os primeiros 50 usuários do portal
- **THEN** ele aparece pelo nome, não por número

#### Scenario: Membro desativado
- **WHEN** um membro do grupo foi desativado no Bitrix24
- **THEN** ele aparece com o nome e a indicação de inativo e pode ser removido

#### Scenario: Grupo incompleto
- **WHEN** um grupo não tem linhas ou não tem pessoas nem departamentos
- **THEN** o card exibe o aviso correspondente

### Requirement: Edição do grupo em painel lateral
Criar e editar um grupo SHALL acontecer em um painel lateral sobre a visão geral. O painel SHALL manter visível, separada da busca, a relação de tudo que já tem acesso (pessoas e departamentos), cada item com ação de remover. A busca de pessoas e a de departamentos SHALL ser separadas. As linhas SHALL ser escolhidas em opções que mostram claramente o estado selecionado. Fechar o painel com alterações não salvas SHALL pedir confirmação. O painel SHALL ser utilizável por teclado e em telas estreitas.

#### Scenario: Selecionados sempre visíveis
- **WHEN** o administrador digita uma busca que não corresponde a nenhum membro atual
- **THEN** os membros e departamentos já adicionados continuam listados no painel

#### Scenario: Remover pelo item
- **WHEN** o administrador aciona remover em um item de quem já tem acesso
- **THEN** o item sai da relação e volta a poder ser adicionado pela busca

#### Scenario: Descartar alterações
- **WHEN** o administrador fecha o painel depois de alterar algo sem salvar
- **THEN** o sistema pede confirmação antes de descartar

#### Scenario: Falha ao salvar
- **WHEN** o salvamento falha, por exemplo por nome duplicado
- **THEN** o painel permanece aberto com as escolhas feitas e mostra o motivo
