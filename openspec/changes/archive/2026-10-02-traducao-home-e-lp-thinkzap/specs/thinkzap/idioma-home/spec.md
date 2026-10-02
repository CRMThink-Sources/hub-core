# Spec Delta

## Purpose

Garante que a página inicial do ThinkZap (`/thinkzap`), aberta dentro do Bitrix24, apareça no idioma ativo do app (português, inglês ou espanhol) e acompanhe a troca de idioma feita no menu lateral.

## ADDED Requirements

### Requirement: Textos da home no idioma ativo
Todo texto visível da home do ThinkZap SHALL ser exibido no idioma ativo do app, entre `pt`, `en` e `es`. Isso inclui a saudação e o subtítulo do banner, o estado vazio sem linhas conectadas e seu botão, o título "Mensagens no período", os rótulos do seletor de período e o aviso de período máximo, os rótulos dos cards por provider (enviadas, recebidas, contagem de linhas ativas), o resumo total, a barra Web vs Business, o badge de novidade, a seção de atalhos (título, rótulos e descrições) e as mensagens de carregamento e de erro geradas pela própria home.

Os nomes próprios "ThinkZap", "Web" e "Business" e o nome do usuário na saudação NÃO SHALL ser traduzidos. Uma mensagem de erro que vem do servidor SHALL ser mostrada como veio. Só o texto padrão, usado quando o servidor não manda mensagem, é traduzido.

#### Scenario: Home aberta com idioma inglês
- **WHEN** o usuário abre a home do ThinkZap com o idioma do app em `en`
- **THEN** a saudação, o subtítulo, os títulos das seções, os rótulos dos cards e os atalhos aparecem em inglês, sem nenhum texto de interface em português

#### Scenario: Home aberta com idioma espanhol
- **WHEN** o usuário abre a home do ThinkZap com o idioma do app em `es`
- **THEN** os textos da home aparecem em espanhol

#### Scenario: Estado vazio traduzido
- **WHEN** o usuário, sem nenhuma linha ativa e com idioma `en`, abre a home
- **THEN** o título, a descrição e o botão do estado vazio aparecem em inglês

#### Scenario: Idioma padrão
- **WHEN** nenhum idioma foi escolhido pelo usuário
- **THEN** a home aparece em português, como hoje

### Requirement: Troca de idioma sem recarregar
Quando o usuário troca o idioma pelo menu lateral do ThinkZap com a home aberta, a home SHALL passar a mostrar o novo idioma sem recarregar a página e sem perder o período selecionado.

#### Scenario: Troca de PT para EN com a home aberta
- **WHEN** o usuário está na home em português, com um período personalizado selecionado, e clica na bandeira dos EUA no menu lateral
- **THEN** os textos da home mudam para inglês e o período selecionado continua o mesmo

### Requirement: Contagem de linhas com plural correto
O rótulo com a quantidade de linhas ativas em cada card SHALL usar singular para exatamente uma linha e plural para as demais quantidades, no idioma ativo.

#### Scenario: Uma linha ativa em inglês
- **WHEN** o card Web tem exatamente uma linha ativa e o idioma é `en`
- **THEN** o rótulo mostra a forma singular em inglês (ex.: "1 active line")

#### Scenario: Várias linhas ativas em português
- **WHEN** o card Business tem três linhas ativas e o idioma é `pt`
- **THEN** o rótulo mostra "3 linhas ativas"

### Requirement: Números no formato do idioma ativo
Os números da home (contagens de mensagens e valores da barra Web vs Business) SHALL seguir o separador de milhar do idioma ativo.

#### Scenario: Contagem grande em inglês
- **WHEN** o total enviado no período é 12345 e o idioma é `en`
- **THEN** o número aparece como "12,345"

#### Scenario: Contagem grande em português
- **WHEN** o total enviado no período é 12345 e o idioma é `pt`
- **THEN** o número aparece como "12.345"
