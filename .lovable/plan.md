
# App do garçom — cadastro e permissões

Vamos adicionar no menu lateral do `Gestor de Pedidos` (`/pedidos-loja/$storeId`) uma nova seção colapsável **App do garçom**, igual em estilo à seção **Entregas** que já existe. Dentro dela o lojista poderá cadastrar os garçons da loja, definir o PIN de cada um e marcar o que cada garçom pode fazer no app.

O app dos garçons em si será feito depois — agora preparamos o cadastro e as permissões para que ele já tenha contra o que validar.

## 1. Nova seção na sidebar

Em `src/routes/pedidos-loja.$storeId.tsx`, logo abaixo do bloco **Entregas** (linhas 384–418), adicionar um bloco igual chamado **App do garçom** com ícone (ex.: `Users` / `Smartphone`), `chevron` e os itens filhos:

- **Garçons cadastrados** → `/pedidos-loja/$storeId/garcons`
- **Permissões padrão** → `/pedidos-loja/$storeId/garcons/permissoes` (opcional, ver §4)

Mesmo padrão visual de `entregasOpen`: estado local `garconsOpen`, borda roxa, ícones pequenos.

## 2. Banco de dados

Duas tabelas novas, ambas escopadas por `store_id`:

**`store_waiters`** — um garçom por linha, pertence a uma loja só.
- `id uuid pk`
- `store_id uuid not null` (FK lógica para `stores.id`)
- `full_name text not null`
- `pin text not null` — armazenado como hash (`crypt(pin, gen_salt('bf'))`), nunca texto puro
- `is_active boolean default true`
- `created_at`, `updated_at`
- Constraint: `unique (store_id, full_name)` para evitar nomes duplicados na mesma loja.
- Trigger `update_updated_at_column` no `updated_at`.

**`store_waiter_permissions`** — 1:1 com `store_waiters`, uma linha por garçom.
- `id uuid pk`
- `waiter_id uuid not null unique` (FK lógica para `store_waiters.id`, `on delete cascade`)
- `can_edit_orders boolean default false`
- `can_cancel_orders boolean default false`
- `auto_print_orders boolean default true`
- `created_at`, `updated_at`

Criada automaticamente por trigger `after insert on store_waiters` com todos os valores default, para o gestor já ter um registro pronto pra editar.

### RLS

Em ambas:
- `enable row level security`
- Policy `ALL` para `is_store_owner(auth.uid(), store_id)` (em `store_waiter_permissions`, via `EXISTS` no `store_waiters` correspondente).
- Policy `ALL` para `has_role(auth.uid(), 'admin')`.
- Nenhuma policy pública — `pin` nunca pode vazar.

### Função SQL pública pro futuro login do garçom
`verify_waiter_pin(_store_id uuid, _full_name text, _pin text) returns table(waiter_id uuid, permissions jsonb)` — `security definer`, faz `crypt(_pin, pin) = pin` e retorna o id + permissões. Já fica pronta para o futuro app dos garçons consumir.

## 3. Rota nova: `/pedidos-loja/$storeId/garcons`

Arquivo: `src/routes/pedidos-loja_.$storeId.garcons.tsx` (usar prefixo `pedidos-loja_` igual às rotas de entregas — fora do layout do painel, com guard `can_manage_store_orders` no `beforeLoad`).

Conteúdo da tela:

- Header no estilo Anota AI: ícone `Users` roxo, título **App do garçom**, subtítulo "Cadastre os garçons desta loja e defina o que cada um pode fazer no aplicativo."
- Link "Voltar ao painel".
- Botão **+ Novo garçom** abrindo um `Dialog`:
  - Campos: **Nome**, **PIN (4 dígitos)**, **Confirmar PIN**.
  - Valida com `zod`: nome 1–80, PIN numérico exatamente 4 dígitos, PIN === confirmação.
  - Ao salvar: insere em `store_waiters` (o trigger cria a linha de permissões com defaults).
- Lista de garçons da loja (`select * from store_waiters where store_id = $storeId order by full_name`).
  - Cada card mostra: nome, status ativo/inativo, e os 3 toggles de permissão:
    - **Editar pedidos** (`can_edit_orders`)
    - **Cancelar pedidos** (`can_cancel_orders`)
    - **Impressão automática dos pedidos** (`auto_print_orders`)
  - Cada toggle atualiza imediatamente via `update store_waiter_permissions`.
  - Menu de 3 pontinhos com: **Trocar PIN** (mesmo dialog reduzido), **Desativar/Reativar**, **Excluir** (com confirmação).
- Estado vazio: ilustração simples + "Nenhum garçom cadastrado ainda. Clique em Novo garçom para começar."

Todos os reads/writes são feitos com o cliente Supabase do browser (`@/integrations/supabase/client`) — a RLS de `is_store_owner` já garante o escopo.

## 4. Permissões: por garçom vs. padrão da loja

Por hora, **permissões são por garçom** (linha em `store_waiter_permissions`), seguindo a sua escolha. Não vamos criar agora a tela "Permissões padrão" — ela vira só se você quiser mais tarde aplicar um padrão pra todos os garçons da loja de uma vez. Então o submenu **Permissões padrão** fica fora deste plano; o submenu da sidebar terá só **Garçons cadastrados**.

## 5. Fora do escopo

- App do garçom em si (autenticação por PIN, tela de pedidos, criar pedido, imprimir). Vai vir depois e consumirá `verify_waiter_pin` + a tabela `store_waiter_permissions`.
- Vincular o garçom a um `user_id` do Supabase Auth (PIN puro, sem conta).
- Multi-loja por garçom (cada garçom pertence a uma loja só; se precisar trabalhar em duas lojas, cadastra duas vezes).

## Detalhes técnicos

- Hash do PIN: usar `pgcrypto` (`crypt(pin, gen_salt('bf'))`). Ao inserir/atualizar pelo client, mandar o PIN em texto e ter um trigger `before insert/update` que substitui `new.pin := crypt(new.pin, gen_salt('bf'))` quando o valor não começa com `$2`. Isso evita o front ter que conhecer o algoritmo.
- Migration roda `create extension if not exists pgcrypto`.
- Tipos do Supabase (`src/integrations/supabase/types.ts`) serão regenerados automaticamente após a migration aprovada.
- A sidebar usa `Link to="/pedidos-loja/$storeId/garcons" params={{ storeId }}` exatamente como os links de entregas.

Aprovação: a migration cria 2 tabelas, 1 função, 2 triggers e RLS. Posso prosseguir?
