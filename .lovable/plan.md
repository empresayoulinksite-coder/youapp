## Objetivo

Adicionar um botão "Selecionar bairro" no checkout (estilo Anota AI). Ao tocar, abre uma lista com os bairros cadastrados pela loja em `store_delivery_areas`. Ao escolher, o bairro é aplicado ao pedido e a taxa de entrega aparece imediatamente.

Hoje a taxa só aparece se o `neighborhood` do endereço salvo bater **exatamente** com algum bairro cadastrado pela loja. Quando não bate (acentuação diferente, bairro escrito errado, ou usuário sem endereço com bairro), a taxa cai para R$ 0 silenciosamente. O botão resolve isso deixando o cliente escolher na lista oficial da loja.

## Onde aparece

Dentro do `CheckoutReviewDialog`, na seção "Endereço de entrega", apenas quando `deliveryMode === "delivery"`. Logo abaixo do endereço/linha de número e complemento, um bloco novo:

```text
🛵 BAIRRO PARA ENTREGA
┌─────────────────────────────────────────┐
│ Castelo                  Taxa R$ 5,00  >│   ← botão (abre lista)
└─────────────────────────────────────────┘
```

Se ainda não selecionado: "Selecione seu bairro" com aviso de que a taxa depende disso.
Se a loja não tem bairros cadastrados: o bloco não aparece (mantém comportamento atual).

## Como funciona a seleção

Ao tocar no botão, abre um sheet (bottom sheet no mobile, dialog no desktop) com:
- Campo de busca "Pesquise pelo seu bairro"
- Lista dos bairros ativos da loja, com taxa ao lado (ex: "Castelo — R$ 5,00" / "Grátis")
- Radio à direita, igual ao mock enviado
- Ordenado alfabeticamente

Ao escolher, fecha o sheet e o bairro selecionado vira a base do cálculo de frete. A taxa some/aparece no resumo da sacola em tempo real.

## Pré-seleção

- Se o `neighborhood` do endereço ativo bater (com normalização — minúsculas, sem acento, sem espaço extra) com um bairro da loja, esse fica pré-selecionado.
- Senão, fica em branco e o botão de confirmar muda para "Selecione seu bairro" enquanto não houver escolha.

## Validação

Para `deliveryMode === "delivery"`, agora também é obrigatório ter um bairro selecionado quando a loja tem áreas cadastradas. O botão final reflete isso:

- Sem bairro: "Selecione seu bairro" (desabilitado)
- Resto da validação (nome, telefone, número) continua igual

Para `pickup` e `mesa` nada muda.

## Detalhes técnicos

- `CheckoutReviewDialog` ganha 3 props novas: `deliveryAreas` (lista `{id, neighborhood, fee}`), `selectedNeighborhood` e `onSelectNeighborhood(neighborhood, fee)`.
- `src/routes/sacola.tsx` passa a buscar `store_delivery_areas` uma vez (já busca, hoje dentro do `useEffect` de cálculo) e expor a lista filtrada por `is_active`. O cálculo do `deliveryFeeValue`/`deliveryFeeLabel` passa a depender do bairro selecionado (estado novo `selectedDeliveryNeighborhood`), com fallback no `active.neighborhood` para manter compatibilidade.
- Novo componente `NeighborhoodPickerSheet` em `src/components/NeighborhoodPickerSheet.tsx` para o sheet de seleção (busca + lista + radio), seguindo o mesmo padrão visual do dialog atual.
- Sem migração de banco. Sem mudança em RLS. Sem mudança em pedidos finalizados (o pedido continua salvando `delivery_address`, `delivery_fee` e bairro já vai no endereço/observação como hoje).

## Fora de escopo

- Não cria/edita bairros (isso já existe em `StoreDeliveryAreasEditor`).
- Não muda o fluxo de cadastro de endereço no perfil.
- Não troca o bairro do endereço salvo do usuário — só usa o escolhido para esse pedido.