# Spec Delta

## MODIFIED Requirements

### Requirement: Navegação agrupada do portal
Toda tela autenticada do portal admin SHALL ser exibida dentro do mesmo shell. O shell SHALL mostrar a marca do portal e uma navegação com dois grupos, nesta ordem:
- o grupo geral, com Início (`/admin`), Clientes (`/admin/clientes`), Novidades (`/admin/novidades`), Usuários (`/admin/usuarios`) e Usuários MCP (`/admin/usuarios-mcp`);
- o grupo "Operação", com Jobs (`/admin/jobs`) e Falhas de envio (`/admin/falhas-envio`).

Cada item SHALL ter ícone e rótulo traduzido no idioma do portal. A tela de login SHALL NOT exibir o shell.

#### Scenario: Itens e grupos
- **WHEN** um usuário logado abre qualquer tela do portal admin
- **THEN** a navegação mostra os sete itens, com Novidades no grupo geral e Jobs e Falhas de envio sob o grupo "Operação"

#### Scenario: Login sem shell
- **WHEN** alguém abre `/admin/login`
- **THEN** a tela não mostra a navegação do portal
