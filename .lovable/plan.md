## Objetivo

Deixar a seção de **Áreas de entrega** dentro do painel do lojista (`/painel`) com o mesmo visual estilo Anota AI, sem mexer na lógica (que já funciona e tem RLS correta para `is_store_owner`).

## Mudanças

### 1. `src/components/StoreDeliveryAreasEditor.tsx` — refinar visual

- Cabeçalho com ícone de localização (`MapPin` roxo), título "Áreas de entrega" e subtítulo "Adicione pelo menos uma região de atendimento".
- Toolbar: campo de busca com ícone à esquerda + botão "+ Bairro" alinhado à direita (estilo do print).
- Linha "Total de N registros".
- Tabela com cabeçalho **Status / Bairro / Valor** + colunas de ação, com linhas zebradas (cinza claro alternado), toggle azul maior (mantém o componente atual), valor à direita, ícones de editar/excluir discretos.
- Formulário de adicionar/editar continua inline, mas com inputs e botões mais claros (mesmos componentes shadcn que já uso).
- Estado vazio: card centralizado com ícone, frase "Nenhum bairro cadastrado ainda" e botão primário "Cadastrar primeiro bairro".

### 2. Sem outras mudanças

- Não mexo no `StoreDeliveryEditor` (só renderiza o componente).
- Não mexo na rota `/admin/entregas/areas` — ela já reaproveita o mesmo componente, então o admin também herda o novo visual.
- Sem migração: a tabela `store_delivery_areas` e suas policies já permitem o lojista gerenciar.

## Arquivos afetados

- `src/components/StoreDeliveryAreasEditor.tsx`

## Fora do escopo

- Abas "Bairro / Raio" do Anota AI (o app só usa bairros hoje).
- Mudar permissões — o lojista já consegue editar.
