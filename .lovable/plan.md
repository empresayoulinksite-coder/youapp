## Objetivo

Hoje a página `/admin` só abre para quem tem `role = admin`. Quero que um **dono de loja** (registro em `store_owners`) também entre nessa mesma página — porém vendo só as **lojas dele** e a seção **Entregas** restrita às lojas dele. Tudo que é global (Donos, Categorias Home/E-com, Importar cardápio, Modal boas-vindas, Impressão automática) fica oculto para ele.

## O que muda

### 1. Liberar acesso a `/admin` para donos de loja
- Em `src/routes/admin.tsx`, trocar o gate `useIsAdmin` por um novo hook `useAdminAccess` que retorna `{ isAdmin, isOwner, ownedStoreIds, loading, user }`.
- Permite entrar se `isAdmin || isOwner`. Mantém a tela de "Acesso restrito" se não for nenhum dos dois.
- Cabeçalho da sidebar mostra "Admin" se admin, "Minhas lojas" se dono.

### 2. Sidebar dinâmica por perfil
- **Admin** (sem mudança): Lojas, Donos de loja, Categorias Home, Categorias E-com, Importar cardápio, Modal boas-vindas, Impressão automática + Entregas (Cadastro, Relatório, Áreas).
- **Dono de loja**: apenas **Lojas** + **Entregas** (Cadastro entregadores, Relatório, Áreas).
- O mobile top-nav segue a mesma regra.

### 3. Listas escopadas para o dono
Quando `!isAdmin && isOwner`, filtrar as queries pelos IDs em `store_owners` do usuário logado:
- `admin.index.tsx` (Lojas): `from("stores").select(...).in("id", ownedStoreIds)`.
- `admin.entregas.areas.tsx`, `admin.entregas.cadastro.tsx`, `admin.entregas.relatorio.tsx`: mesma filtragem de lojas.
- `admin.loja.$storeId.tsx`: adicionar `beforeLoad` que aceita admin **ou** `is_store_owner(uid, storeId)`; se não, redireciona para `/admin`.

### 4. Sem mudança no fluxo de cadastro de donos
O cadastro continua acontecendo em `/admin/donos` (só admin acessa). Assim que o admin associa um usuário a uma loja em `store_owners`, esse usuário, ao entrar em `/admin`, já passa pelo novo gate.

## Segurança

- **RLS já cobre o servidor**: `is_store_owner`/`can_manage_store_orders` impedem dono de ler/editar dados de outras lojas mesmo se chamar a API direto. As mudanças acima são de UX (esconder o que não é dele).
- **Tabela `stores`**: hoje é leitura pública, então o filtro no front é suficiente para limitar a lista exibida; edição segue protegida por policies.
- Donos **não** ganham acesso a Donos de loja, Categorias Home/E-com, Modal boas-vindas e Impressão automática — itens removidos da sidebar e protegidos no `beforeLoad` de cada rota desses (redirect para `/admin` se não-admin).

## Arquivos afetados

- `src/hooks/use-admin.ts` — adicionar `useAdminAccess`
- `src/routes/admin.tsx` — novo gate + sidebar dinâmica
- `src/routes/admin.index.tsx` — filtrar por `ownedStoreIds`
- `src/routes/admin.entregas.areas.tsx`, `admin.entregas.cadastro.tsx`, `admin.entregas.relatorio.tsx` — filtrar lojas
- `src/routes/admin.loja.$storeId.tsx` — `beforeLoad` aceita admin OU dono
- `src/routes/admin.donos.tsx`, `admin.categorias-home.tsx`, `admin.categorias-ecommerce.tsx`, `admin.importar-cardapio.tsx`, `admin.modal-boas-vindas.tsx`, `admin.impressao-automatica.tsx` — `beforeLoad` redirect se não-admin