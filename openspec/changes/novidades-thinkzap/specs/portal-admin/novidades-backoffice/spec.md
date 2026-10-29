# Spec Delta

## Purpose

Define como o time da CRMThink cadastra, revisa e publica no backoffice as novidades do ThinkZap mostradas aos clientes: conteúdo em três idiomas, imagem opcional, ciclo de vida e a regra de que nada chega ao cliente sem revisão.

## ADDED Requirements

### Requirement: Conteúdo de uma novidade
Uma novidade SHALL ter título e descrição em português, inglês e espanhol (texto puro), e no máximo uma imagem opcional. A imagem SHALL ser PNG ou JPEG e ficar armazenada de forma permanente (sem expiração). Em rascunho, qualquer campo de texto MAY ficar vazio.

#### Scenario: Rascunho incompleto
- **WHEN** um operador salva uma novidade nova só com o título em português
- **THEN** a novidade é criada como rascunho e a edição indica que inglês e espanhol estão incompletos

#### Scenario: Imagem inválida
- **WHEN** um operador envia um arquivo que não é PNG nem JPEG como imagem
- **THEN** a API responde `422` e a novidade não muda

### Requirement: Ciclo de vida da novidade
Cada novidade SHALL estar em exatamente uma destas situações:
- **Rascunho**: nunca publicada ou despublicada. O cliente não vê.
- **Em breve**: publicada e ainda não disponível. O cliente vê em "Em breve".
- **Aguardando revisão**: concluída e ainda não disponível. Se estiver publicada, o cliente continua vendo em "Em breve".
- **Disponível**: publicada como disponível. O cliente vê em "Já disponível" com a data de disponibilidade.

Concluir uma novidade (no backoffice ou pela tarefa do Bitrix) SHALL NOT mudar o que o cliente vê. Só a ação "Publicar como disponível" SHALL levar uma novidade para "Já disponível", e ela só é aceita para novidade concluída.

#### Scenario: Conclusão não publica
- **WHEN** uma novidade "Em breve" é concluída
- **THEN** a situação passa para "Aguardando revisão" e o cliente continua vendo a novidade em "Em breve"

#### Scenario: Publicar como disponível
- **WHEN** um operador publica como disponível uma novidade concluída
- **THEN** ela passa para "Disponível", a data de disponibilidade passa a ser o momento da ação e o cliente a vê em "Já disponível"

#### Scenario: Rascunho direto para disponível
- **WHEN** um operador publica como disponível um rascunho concluído e com os três idiomas completos
- **THEN** a novidade passa direto para "Disponível", sem ter aparecido em "Em breve"

#### Scenario: Publicar como disponível sem conclusão
- **WHEN** um operador tenta publicar como disponível uma novidade não concluída
- **THEN** a API responde `409` e nada muda

### Requirement: Publicação exige os três idiomas
Publicar (em "Em breve" ou como disponível) e publicar alterações SHALL exigir título e descrição preenchidos nos três idiomas. Caso contrário, a API SHALL responder `422` indicando os idiomas incompletos.

#### Scenario: Falta espanhol
- **WHEN** um operador tenta publicar uma novidade sem a descrição em espanhol
- **THEN** a API responde `422` apontando `es` e a novidade continua em rascunho

### Requirement: Alterações em novidade publicada passam por revisão
Salvar texto ou imagem de uma novidade publicada SHALL NOT alterar o que o cliente vê. As alterações SHALL ficar pendentes até um operador acionar "Publicar alterações" ou "Descartar alterações". O backoffice SHALL indicar, na lista e na edição, que há alterações pendentes, e SHALL permitir pré-visualizar a versão pendente.

#### Scenario: Correção pendente
- **WHEN** um operador corrige o título em inglês de uma novidade disponível e salva
- **THEN** o cliente continua vendo o título antigo e a novidade aparece com "alterações pendentes" no backoffice

#### Scenario: Publicar alterações
- **WHEN** um operador publica as alterações pendentes de uma novidade com os três idiomas completos
- **THEN** o cliente passa a ver o novo conteúdo e a data de disponibilidade não muda

#### Scenario: Descartar alterações
- **WHEN** um operador descarta as alterações pendentes
- **THEN** a edição volta a mostrar o conteúdo publicado e o indicador some

### Requirement: Despublicar e excluir
Um operador SHALL poder despublicar uma novidade publicada. Ela volta a ser rascunho, o cliente deixa de vê-la e a data de disponibilidade é mantida. Ao ser republicada como disponível, ela SHALL voltar com a data original. Só rascunhos que nunca foram publicados SHALL poder ser excluídos. Para os demais, a API SHALL responder `409`.

#### Scenario: Republicar mantém a data
- **WHEN** um operador despublica uma novidade disponível desde 22/10/2026 e a publica como disponível de novo em 05/11/2026
- **THEN** o cliente vê a novidade em "Já disponível" com a data 22/10/2026

#### Scenario: Excluir publicada
- **WHEN** um operador tenta excluir uma novidade que já foi publicada
- **THEN** a API responde `409` e a novidade continua existindo

### Requirement: Desmarcar conclusão
Um operador SHALL poder desmarcar a conclusão de uma novidade enquanto ela não estiver disponível. Ela volta para pendente: "Em breve" se estiver publicada, rascunho caso contrário. Para uma novidade despublicada que já tinha sido disponível, desmarcar a conclusão SHALL apagar a data de disponibilidade.

#### Scenario: Desmarcar antes de disponibilizar
- **WHEN** um operador desmarca a conclusão de uma novidade "Aguardando revisão" publicada
- **THEN** ela volta para "Em breve"

#### Scenario: Desmarcar novidade disponível
- **WHEN** um operador tenta desmarcar a conclusão de uma novidade "Disponível"
- **THEN** a API responde `409`

### Requirement: Telas de novidades no backoffice
O backoffice SHALL ter uma lista de novidades em `/admin/novidades` com:
- título em português;
- situação;
- indicador de alterações pendentes;
- tarefa vinculada (ID e status);
- data de disponibilidade;
- filtro por situação.

Novidades "Aguardando revisão" SHALL ficar destacadas. A edição SHALL ter:
- uma aba por idioma, com indicação de idioma incompleto;
- upload, troca e remoção da imagem;
- pré-visualização do card como o cliente o verá, em cada idioma;
- as ações permitidas para a situação atual.

Ações que mudam o que o cliente vê e a exclusão SHALL pedir confirmação. Todos os textos SHALL existir em pt, en e es.

#### Scenario: Ações por situação
- **WHEN** um operador abre um rascunho não concluído
- **THEN** a edição oferece Salvar, Publicar, Marcar como concluída e Excluir, e não oferece Publicar como disponível

#### Scenario: Pré-visualização
- **WHEN** um operador abre a pré-visualização em inglês
- **THEN** vê o card com o título, a descrição e a imagem em inglês, no formato da aba do cliente

### Requirement: Acesso restrito ao portal
Todas as rotas de novidades do backoffice SHALL exigir sessão do portal e responder `401` sem ela. O backoffice SHALL registrar qual usuário do portal criou, publicou e concluiu cada novidade, e quando.

#### Scenario: Sem sessão
- **WHEN** alguém chama a API de novidades do backoffice sem token do portal
- **THEN** a resposta é `401`
