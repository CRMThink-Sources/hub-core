# Design

## Context

Motivação e evidência em `proposal.md`. O que importa para o desenho:

- **Quem resolve a expressão é o Bitrix**, antes de chamar o webhook (`robot-config.ts:10-16`). O servidor nunca vê `{=Document:X}`, só o valor final, ou o texto cru quando o Bitrix não resolveu.
- **A tela já tem três modos por valor** (`FieldValue`: `literal`, `document`, `expression`). O modo não é gravado: é derivado da forma do valor ao reabrir (`fromStoredValue`). Por isso o bug de reabrir-e-salvar vive inteiro nessa função e em `toStoredValue`.
- **Os dois robôs compartilham as funções**: `button-robot-config.ts` importa `FieldValue`, `toStoredValue` e `fromStoredValue` do robô de template. Corrigir lá corrige os dois.
- **O destino passa por `normalizePhoneNumber`** (`api/src/shared/helpers/normalize-phone-number.ts`), que descarta tudo que não é dígito. É por isso que um destino `{5511930256909}` ainda foi aceito, e `{}` e `{{{Contato: Celular}}}` viram string vazia e caem em `Invalid destination phone number`.
- **Os avisos da timeline** moram em `timeline-notices.ts`, em três idiomas, nos blocos `templateRobot` e `buttonRobot`, e os controllers pedem o bloco pelo idioma da instalação.
- Evidência de campo, só para dois campos do contato: `{=Document:CONTACT.NAME}` entregou `João`; `{{=Document:CONTACT.NAME}}` entregou `{João}`.

## Goals / Non-Goals

**Goals:**
- Um valor de campo da entidade escolhido na tela chega ao webhook como o conteúdo do campo, sem sobras.
- Abrir e salvar um robô nunca troca um valor funcional por um texto que o Bitrix não resolve.
- O operador sabe, pelo comentário da timeline, se o problema é campo vazio ou campo não resolvido.

**Non-Goals:**
- Reescrever no servidor valores já gravados errados nos portais (ver decisão 4).
- Mudar o resolvedor de contatos relacionados, o filtro de telefone por tipo ou o fallback automático para contatos relacionados.
- Mudar o contrato de propriedades do robô registrado no Bitrix (`build-template-robot-params.ts`).

## Decisions

### 1. Gravar `{=Document:ID}` em `toStoredValue`
É o formato do designer de fluxo de trabalho e o que o teste manual mostrou resolver limpo. `DOCUMENT_EXPRESSION` (`{1,3}`) já aceita chave simples, dupla e tripla na leitura, então nada gravado antes deixa de ser reconhecido e os testes de leitura existentes não mudam.
- *Alternativa: gravar o rótulo `{{Contato: Primeiro nome}}`.* Descartada: o rótulo muda com o idioma do portal e com renomeação de campo, o id não. Também não foi testada.
- *Alternativa: manter `{{=Document:ID}}` e limpar as chaves no servidor.* Descartada: o servidor não distingue `{João}` de um valor legítimo entre chaves, e o problema ficaria escondido em vez de corrigido na origem.

### 2. Reabrir `{{{Rótulo}}}` casando por título, com um índice de campos
`fromStoredValue` passa a receber um `FieldIndex` (ids conhecidos e `título → [ids]`) no lugar de `knownFieldIds`, construído uma vez a partir de `documentFields` no formulário. Ordem de decisão, mantendo a atual:
1. expressão de documento → `document`;
2. token `{{{…}}}` cujo rótulo, sem as chaves e com espaços aparados, é **igual** ao título de **exatamente um** campo → `document` com o id desse campo;
3. outro token `{{{…}}}` → `expression`, verbatim;
4. id puro conhecido → `document`;
5. o resto → `literal`.

Comparação exata, sem ignorar caixa nem acento: é o que o Bitrix usa para montar o rótulo, e relaxar a comparação aumenta a chance de ligar o valor ao campo errado. Título repetido (ambíguo) não converte.
Colchetes não recebem tratamento especial: há campos do documento cujo título começa com colchetes (`[ThinkZap] Data do disparo`), e esses casam normalmente pelo passo 2. Um token de retorno de outro passo (`{{{[Criar usando fonte] ID Empresa}}}`) fica como `expression` porque nenhum campo do documento tem esse título, não por uma regra sobre colchetes.

No robô de botões só o **destino** é guardado como valor de campo; os botões são texto `TIPO|rótulo|valor`. A regra vale, portanto, para o destino nesse robô, e para o destino, as variáveis, os valores de botão e a imagem do cabeçalho no robô de template.
- *Alternativa: nunca reabrir como `expression`, sempre como `document` ou `literal`.* Descartada: perde o retorno de outro passo, que a tela não sabe produzir.
- *Alternativa: gravar o modo ao lado do valor.* Descartada: o Bitrix só guarda o valor das propriedades; não há onde pôr o modo.

Quando a lista de campos ainda não carregou, o índice é vazio e o comportamento atual se mantém. O formulário já recarrega a lista e relê o valor quando ela chega (`template-robot-form.tsx:63-110`), então o modo é corrigido sozinho.

### 3. Diagnóstico do destino na API, num helper puro
Um helper `classifyRobotDestination(value)` devolve `empty` (vazio ou só chaves e espaços, como `{}`), `unresolved-token` (contém `{{{…}}}`) ou `other`. Fica em `application/helpers/`, sem dependência de infra, testado isoladamente.

Nos dois controllers, o laço de enfileiramento já captura a falha por destinatário. Ele passa a registrar a classificação de cada destino que falhou. Quando nenhum destinatário foi enfileirado:
- se algum destino foi `unresolved-token`, usa o aviso de token não resolvido, com o valor recebido;
- senão, se algum foi `empty`, usa o aviso de campo vazio;
- senão, o `noValidRecipients` de hoje.

O caminho `recipients.length === 0` (destino ausente, sem relacionados) usa o aviso de campo vazio, já que a causa é a mesma do ponto de vista do operador. Os avisos novos entram nos blocos `templateRobot` e `buttonRobot` em pt, en e es; o do token recebe o valor como parâmetro e o cita como veio. O log estruturado já existente (`template_robot_enqueue_failed`) não muda.
- *Alternativa: validar o destino antes do laço.* Descartada: duplicaria a validação de telefone e mudaria o motivo de recusa de casos hoje cobertos por testes.

### 4. Não corrigir valores já gravados no handler
Robôs salvos como `{{=Document:X}}` continuam entregando `{valor}`, e os salvos como `{{{…}}}` literal continuam falhando, até alguém reabrir e salvar. Uma limpeza de chaves nos parâmetros do template seria possível, mas altera qualquer valor legítimo entre chaves e esconde o problema. Fica fora; o aviso da decisão 3 é o que leva o operador a corrigir.

## Risks / Trade-offs

- **Chave simples validada em dois campos só** (`CONTACT.NAME`, `CONTACT.PHONE_MOBILE`) → antes de trocar o formato, repetir o teste manual com um campo do próprio negócio (`TITLE`) e um personalizado (`UF_CRM_…`); é a primeira tarefa. Se algum não resolver, o formato precisa de outra decisão antes de seguir.
- **O título da lista de campos pode diferir do rótulo que o Bitrix usa no token** (campo personalizado, idioma do portal) → nesse caso não casa e o valor fica como `expression`, que é o comportamento de hoje. Falha segura, mas o operador não ganha a conversão.
- **Robôs já salvos errado seguem errados** → mitigado só pelo aviso novo; documentar no resumo da entrega.
- **Conflito de merge** com `imagem-cabecalho-template-oficial`, que altera `robot-config.ts`, `template-robot-form.tsx` e o handler do template → aplicar sobre a branch em que essa change estiver, ou reconciliar os três arquivos; as mudanças aqui são localizadas.
- **O aviso pode acusar "campo vazio" para quem nunca preencheu o destino** → o texto cobre as duas causas: "o destino está vazio ou o campo escolhido veio vazio".

## Migration Plan

Sem migration e sem env. Deploy normal (front e API sobem juntos, mas são independentes: a API só passa a comentar melhor, o front só passa a gravar diferente). Rollback é reverter o commit. Nenhuma ordem obrigatória entre os dois.

## Open Questions

- Texto final dos avisos em en e es: redigidos na implementação e revisados na PR.
