## Objetivo

Transformar `/admin/entregas/areas` (hoje vazia) em uma página real, no estilo do Anota AI, para o admin cadastrar bairros e taxas de entrega de cada loja.

## Fluxo

1. Ao entrar em **Entregas → Áreas de entrega**, mostra a lista de todas as lojas cadastradas (cards com foto/emoji, nome, categoria e contagem de bairros já cadastrados).
2. Campo de busca no topo para filtrar lojas por nome/categoria/bairro.
3. Ao clicar em **Gerenciar áreas** num card, abre a tela de bairros daquela loja (mesma página, estado interno — botão "← Voltar para lojas").
4. A tela da loja replica o visual do print do Anota AI:
   - Cabeçalho: nome da loja + subtítulo "Adicione pelo menos uma região de atendimento".
   - Busca + botão **+ Bairro** (azul).
   - "Total de N registros".
   - Tabela com colunas: **Status** (toggle azul ativo/inativo), **Bairro**, **Valor** (R$), ações (editar ✏️ / excluir 🗑️).
   - Linhas alternadas em tom claro/cinza.
   - Formulário inline (ou modal) para criar/editar com campos Bairro e Taxa (R$).

## Implementação

- Substituir `src/routes/admin.entregas.areas.tsx`:
  - `useQuery(['admin-stores-areas'])` busca `stores` + agregado de contagem de `store_delivery_areas` por loja.
  - Estado `selectedStoreId`. Quando nulo → render da grade de lojas. Quando preenchido → render do gerenciador.
  - Para o gerenciador, **reaproveitar** `StoreDeliveryAreasEditor` (já existe e cobre exatamente todas as ações: listar, buscar, total, adicionar, editar, ativar/desativar, excluir). Wrappear com cabeçalho (nome da loja + botão voltar).
  - Pequeno ajuste visual em `StoreDeliveryAreasEditor` para deixar a tabela mais parecida com o print (linhas zebradas, toggles azuis maiores, valores à direita) — sem mudar a lógica.

## Banco de dados

Nenhuma mudança. A tabela `store_delivery_areas` (store_id, neighborhood, fee, is_active) já existe e tem RLS adequada (admins gerenciam tudo).

## Arquivos afetados

- `src/routes/admin.entregas.areas.tsx` — reescrito (lista de lojas + container do gerenciador).
- `src/components/StoreDeliveryAreasEditor.tsx` — pequenos ajustes visuais (opcional, só para ficar igual ao print).

## Fora do escopo

- Não vou mexer em "Cadastro entregadores" nem "Relatório entregadores".
- Não vou criar abas "Bairro/Raio" do print agora (o sistema hoje só tem bairros). Posso adicionar depois se você pedir.
