# Spec Delta

## Purpose

Define a aba "Novidades" do ThinkZap, onde o cliente final vê, no idioma dele, as melhorias já disponíveis e as que vêm em breve, além do endpoint de leitura que a alimenta.

## ADDED Requirements

### Requirement: Endpoint de novidades para o cliente
A API SHALL expor `GET /api/thinkzap/novidades?locale=<pt|en|es>`, autenticado como as demais rotas do ThinkZap.
- **Itens retornados:** só novidades publicadas, na versão publicada, sem alterações pendentes.
- **Campos de cada item:** id, título, descrição, URL da imagem (ou nulo), situação (`soon` ou `available`) e, para `available`, a data de disponibilidade.
- **Idioma:** os textos vêm no idioma pedido; `locale` ausente ou inválido usa `pt`.
- **Campos internos:** a resposta SHALL NOT incluir dados da tarefa do Bitrix nem quem publicou.
- **Escopo:** a lista é a mesma para todos os clientes.

#### Scenario: Mistura de situações
- **WHEN** existem um rascunho, uma novidade "Em breve", uma "Aguardando revisão" publicada e uma "Disponível"
- **THEN** a resposta traz três itens: dois `soon` e um `available` com data, e o rascunho não aparece

#### Scenario: Idioma espanhol
- **WHEN** o cliente pede `locale=es`
- **THEN** títulos e descrições vêm em espanhol

#### Scenario: Sem autenticação
- **WHEN** a rota é chamada sem a autenticação do ThinkZap
- **THEN** a resposta é `401`

### Requirement: Aba Novidades no ThinkZap
O menu lateral do ThinkZap SHALL ter o item "Novidades" (`/thinkzap/novidades`), visível para todo usuário do ThinkZap e traduzido em pt, en e es. A página SHALL ter duas abas internas:
- **"Já disponível":** aberta por padrão. Mostra os itens `available` do mais recente para o mais antigo, cada um com selo de disponível e data.
- **"Em breve":** mostra o número de itens no rótulo e os itens `soon` com selo "Em breve", sem nenhuma data ou prazo.

Cada card SHALL mostrar título, descrição e a imagem, quando houver. Os textos SHALL seguir o idioma atual do ThinkZap e SHALL ser atualizados quando o cliente trocar de idioma.

#### Scenario: Abertura da aba
- **WHEN** um usuário do ThinkZap abre Novidades
- **THEN** a aba "Já disponível" está selecionada e os cards aparecem do mais recente para o mais antigo, com data

#### Scenario: Em breve sem prazos
- **WHEN** o usuário abre "Em breve"
- **THEN** os cards mostram só o selo "Em breve", sem nenhuma data

#### Scenario: Troca de idioma
- **WHEN** o usuário troca o idioma do ThinkZap para inglês com a página aberta
- **THEN** os cards passam a mostrar o conteúdo em inglês

### Requirement: Estados da página
A página SHALL mostrar estado de carregamento enquanto busca as novidades. Cada aba vazia SHALL ter uma mensagem amigável própria. Se a busca falhar, a página SHALL mostrar um erro com a opção de tentar de novo.

#### Scenario: Nada em breve
- **WHEN** não há novidades `soon` e o usuário abre "Em breve"
- **THEN** a aba mostra uma mensagem amigável de vazio

#### Scenario: Falha ao carregar
- **WHEN** a API de novidades falha
- **THEN** a página mostra o erro e um botão para tentar de novo
