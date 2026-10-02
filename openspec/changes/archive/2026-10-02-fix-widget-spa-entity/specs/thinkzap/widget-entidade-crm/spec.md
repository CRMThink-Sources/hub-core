# Spec Delta

## Purpose

Define como o widget de CRM do ThinkZap identifica a entidade do Bitrix24 em que está aberto (tipo e id) — inclusive itens de SPA — e a envia com cada mensagem, para que o envio, a timeline e a conversa no canal aberto fiquem vinculados ao registro certo.

## ADDED Requirements

### Requirement: Widget identifica a entidade do CRM pelo placement
O widget SHALL derivar o tipo da entidade a partir do placement em que foi aberto:

| Placement | Tipo da entidade enviado |
|---|---|
| `CRM_LEAD_DETAIL_TAB` | `lead` |
| `CRM_DEAL_DETAIL_TAB` | `deal` |
| `CRM_CONTACT_DETAIL_TAB` | `contact` |
| `CRM_COMPANY_DETAIL_TAB` | `company` |
| `CRM_DYNAMIC_<entityTypeId>_DETAIL_TAB` | `DYNAMIC_<entityTypeId>` |

O id da entidade SHALL ser o `ID` das opções do placement. O tipo e o id SHALL acompanhar todo envio feito pelo widget — mensagem livre, mensagem com anexo, template e mensagem com botões.

#### Scenario: Envio de texto a partir de um item de SPA
- **WHEN** o operador abre o widget na aba de um item de SPA (placement `CRM_DYNAMIC_1060_DETAIL_TAB`, item `1613`), escolhe uma linha WhatsApp Web e envia o texto "Teste"
- **THEN** a mensagem é aceita para envio (`202`) com tipo de entidade `DYNAMIC_1060` e id `1613`, sem erro de validação no campo `entity`

#### Scenario: Envio de anexo, template e botões a partir de um item de SPA
- **WHEN** o operador, no widget aberto em um item de SPA, envia uma mensagem com anexo, um template ou uma mensagem com botões
- **THEN** o envio carrega o tipo `DYNAMIC_<entityTypeId>` e o id do item, e não é recusado por falta de `entity`

#### Scenario: Entidades padrão continuam como antes
- **WHEN** o operador envia uma mensagem a partir do widget aberto em um Negócio, Lead, Contato ou Empresa
- **THEN** o tipo enviado é `deal`, `lead`, `contact` ou `company`, respectivamente

### Requirement: Widget recusa envio sem entidade identificada
Quando o widget não conseguir identificar o tipo ou o id da entidade (placement desconhecido ou sem `ID`), o widget SHALL bloquear o envio antes de chamar a API e SHALL exibir ao operador uma mensagem em português explicando que a ficha do CRM não foi identificada. O texto digitado e os anexos NÃO SHALL ser descartados.

#### Scenario: Placement não reconhecido
- **WHEN** o widget é aberto em um placement que não está na tabela de mapeamento e o operador clica em enviar
- **THEN** nenhuma requisição de envio é feita, o operador vê a mensagem de erro e o rascunho permanece no composer

### Requirement: Mensagens enviadas de SPA são registradas no item
Um envio feito a partir de um item de SPA SHALL registrar o comentário de timeline e os avisos de falha de entrega no próprio item de SPA, do mesmo modo que já ocorre para as entidades padrão. Ao abrir a conversa no canal aberto, o sistema SHALL usar o título do item de SPA como nome da conversa quando disponível, e o telefone do destino quando o título não puder ser lido.

#### Scenario: Timeline do item de SPA recebe o envio
- **WHEN** uma mensagem enviada do widget aberto no item `1613` da SPA `1060` é entregue
- **THEN** o comentário de timeline é criado no item `1613` da SPA `1060`

#### Scenario: Nome da conversa vindo do item de SPA
- **WHEN** a conversa no canal aberto é criada para um envio feito a partir de um item de SPA com título "Proposta ACME"
- **THEN** a conversa recebe o nome "Proposta ACME"

#### Scenario: Título do item de SPA indisponível
- **WHEN** a leitura do item de SPA no Bitrix falha ao nomear a conversa
- **THEN** a conversa é criada com o telefone do destino como nome e o envio não é afetado
