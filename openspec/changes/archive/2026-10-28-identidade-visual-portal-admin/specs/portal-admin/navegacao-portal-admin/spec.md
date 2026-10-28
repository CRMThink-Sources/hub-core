# Spec Delta

## Purpose

Define o shell comum das telas autenticadas do portal admin: como a navegação é organizada e mostrada no desktop e no celular, como a página atual é indicada e como o usuário encerra a sessão.

## ADDED Requirements

### Requirement: Navegação agrupada do portal
Toda tela autenticada do portal admin SHALL ser exibida dentro do mesmo shell. O shell SHALL mostrar a marca do portal e uma navegação com dois grupos, nesta ordem:
- o grupo geral, com Início (`/admin`), Clientes (`/admin/clientes`), Usuários (`/admin/usuarios`) e Usuários MCP (`/admin/usuarios-mcp`);
- o grupo "Operação", com Jobs (`/admin/jobs`) e Falhas de envio (`/admin/falhas-envio`).

Cada item SHALL ter ícone e rótulo traduzido no idioma do portal. A tela de login SHALL NOT exibir o shell.

#### Scenario: Itens e grupos
- **WHEN** um usuário logado abre qualquer tela do portal admin
- **THEN** a navegação mostra os seis itens, com Jobs e Falhas de envio sob o grupo "Operação"

#### Scenario: Login sem shell
- **WHEN** alguém abre `/admin/login`
- **THEN** a tela não mostra a navegação do portal

### Requirement: Página atual destacada
O item da página atual SHALL aparecer destacado e SHALL ser anunciado como página atual para tecnologias assistivas. Início SHALL ficar ativo só em `/admin`. Os demais itens SHALL ficar ativos também nas sub-rotas.

#### Scenario: Sub-rota de Jobs
- **WHEN** o usuário está em `/admin/jobs/expiracao-assinaturas`
- **THEN** o item Jobs aparece ativo e Início não

#### Scenario: Início exato
- **WHEN** o usuário está em `/admin/clientes`
- **THEN** o item Início não aparece ativo

### Requirement: Navegação disponível no celular
Em telas estreitas, onde a navegação lateral não cabe, o shell SHALL oferecer um botão que abre a navegação completa sobre o conteúdo. Escolher um item SHALL navegar e fechar a navegação. A navegação aberta SHALL fechar com `Esc` e ao tocar fora dela.

#### Scenario: Navegar pelo celular
- **WHEN** o usuário, numa tela de 375px de largura, abre o menu e escolhe Jobs
- **THEN** o portal vai para `/admin/jobs` e o menu fecha

### Requirement: Menu do usuário com saída
O shell SHALL mostrar o nome do usuário da sessão e um menu com a ação "Sair". "Sair" SHALL encerrar a sessão do portal e levar para `/admin/login`.

#### Scenario: Sair
- **WHEN** o usuário abre o menu do usuário e escolhe "Sair"
- **THEN** a sessão é encerrada e o portal mostra `/admin/login`

### Requirement: Status com cores semânticas do tema
Os indicadores de status do portal admin (resultado de rodada de job, saúde de job, status de falha de envio) SHALL usar as cores semânticas do tema do portal (sucesso, atenção, falha, em andamento, neutro). Eles SHALL NOT depender só da cor: todo indicador SHALL ter um rótulo de texto.

#### Scenario: Rodada com falha
- **WHEN** uma rodada aparece como "Falhou"
- **THEN** o indicador usa a cor de falha do tema e mostra o texto "Falhou"
