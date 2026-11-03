# Spec Delta

## Purpose

Define a aba de templates de uma linha oficial do ThinkZap — como os templates são listados, buscados, filtrados e visualizados — e a edição de um template existente.

## ADDED Requirements

### Requirement: Aba de templates com busca, filtros e cards
A aba de templates de uma linha oficial SHALL mostrar um cabeçalho com a quantidade de templates e as ações de sincronizar e de criar template. SHALL oferecer busca por nome e corpo do template e filtros por status, por categoria e por "com imagem", combináveis, com a contagem de resultados e a opção de limpar os filtros.

Cada template SHALL aparecer como um card com nome, selo de status, categoria, idioma, corpo resumido, os botões do template e, quando o template tiver cabeçalho de imagem, a miniatura da imagem padrão do envio. Template com cabeçalho de imagem sem imagem padrão SHALL mostrar um aviso no lugar da miniatura, com a ação de definir a imagem.

Cada card SHALL ter um menu de ações com Editar, Ver detalhes e, em template com cabeçalho de imagem, Imagem padrão do envio. Ver detalhes SHALL mostrar o preview completo do template, no formato de uma mensagem do WhatsApp, e seus dados.

A aba SHALL mostrar um esqueleto durante o carregamento, um estado vazio com a ação de criar o primeiro template quando a linha não tem templates, um estado de "nenhum resultado" quando a busca ou os filtros não encontram nada, e o erro com a ação de tentar de novo quando a lista não carrega. A aba SHALL funcionar em tema claro e escuro e em telas estreitas.

#### Scenario: Busca por nome
- **WHEN** a linha tem os templates `promo_natal`, `promo_pascoa` e `boleto_vencido` e o operador busca "promo"
- **THEN** a aba mostra só `promo_natal` e `promo_pascoa`, com a contagem de 2 resultados

#### Scenario: Filtro por status
- **WHEN** o operador filtra por Rejeitado
- **THEN** a aba mostra só os templates rejeitados

#### Scenario: Busca sem resultado
- **WHEN** o operador busca um texto que nenhum template contém
- **THEN** a aba mostra o estado de nenhum resultado com a opção de limpar a busca e os filtros

#### Scenario: Linha sem templates
- **WHEN** o operador abre a aba de uma linha sem templates
- **THEN** a aba mostra o estado vazio com a ação de criar o primeiro template

#### Scenario: Template com imagem sem imagem padrão
- **WHEN** a linha tem um template com cabeçalho de imagem sincronizado da Meta, sem imagem padrão
- **THEN** o card mostra o aviso de que falta a imagem padrão do envio, com a ação de defini-la

### Requirement: Formulário de template com preview ao vivo
O formulário de criação e de edição de template SHALL mostrar, ao lado dos campos em telas largas e abaixo deles em telas estreitas, um preview do template no formato de uma mensagem do WhatsApp, atualizado a cada alteração, com cabeçalho de imagem, corpo, rodapé e botões.

#### Scenario: Preview acompanha a digitação
- **WHEN** o operador digita `Olá {{1}}, sua oferta chegou` no corpo
- **THEN** o preview mostra o texto com a variável destacada

### Requirement: Editar template da linha oficial
A aba de templates SHALL permitir editar um template com status aprovado, rejeitado ou pausado, pelo mesmo formulário da criação, preenchido com os dados atuais do template. A ação de editar SHALL ficar indisponível, com o motivo, para template pendente.

Na edição, o nome e o idioma SHALL ficar bloqueados, e a categoria SHALL ficar bloqueada em template aprovado. O formulário SHALL avisar que o template volta para análise da Meta e fica indisponível para envio até ser aprovado de novo.

Na edição de um template com cabeçalho de imagem, se o operador não trocar a imagem, a imagem padrão do envio SHALL ser usada como imagem de exemplo; sem imagem padrão, o formulário SHALL exigir uma imagem nova. Uma imagem trocada na edição SHALL passar a ser a imagem padrão do envio.

As validações da criação SHALL valer também para a edição.

#### Scenario: Corrigir template rejeitado
- **WHEN** o operador edita o corpo de um template rejeitado e salva
- **THEN** o template é reenviado para análise e aparece na lista como pendente

#### Scenario: Editar template aprovado
- **WHEN** o operador abre a edição de um template aprovado
- **THEN** nome, idioma e categoria ficam bloqueados e o aviso de nova análise é exibido

#### Scenario: Template pendente
- **WHEN** o operador abre o menu de ações de um template pendente
- **THEN** a ação de editar aparece indisponível, informando que o template está em análise

#### Scenario: Edição mantendo a imagem padrão
- **WHEN** o operador edita o corpo de um template com imagem que tem imagem padrão, sem trocar a imagem
- **THEN** o template é reenviado com a imagem padrão como imagem de exemplo

### Requirement: API valida a edição de template
A API de edição de template SHALL aplicar as mesmas validações da criação e SHALL recusar, sem chamar o provedor, a edição de template que não existe na linha, de template com status diferente de aprovado, rejeitado ou pausado, com nome ou idioma diferentes do atual, ou com categoria diferente da atual em template aprovado.

Uma recusa da Meta à edição, inclusive por limite de edições, SHALL chegar ao operador com mensagem legível.

#### Scenario: Troca de nome recusada
- **WHEN** um pedido de edição chega com nome diferente do nome atual do template
- **THEN** a API recusa informando que o nome não pode ser alterado, e nada é enviado ao provedor

#### Scenario: Limite de edições da Meta
- **WHEN** a Meta recusa a edição porque o template atingiu o limite de edições
- **THEN** o operador recebe a mensagem de que o limite de edições foi atingido e de quando poderá editar de novo, se a Meta informar
