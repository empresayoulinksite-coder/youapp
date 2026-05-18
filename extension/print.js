function brl(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function isPickup(o) {
  const t = (o.delivery_type ?? "").toLowerCase();
  return t.includes("retir") || t === "pickup" || !o.delivery_address;
}
function fmtCpf(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function buildHTML({ store, order, items, customer }) {
  const itemsHTML = (items ?? [])
    .map((it) => {
      const extras = [];
      if (it.pizza_size_name)
        extras.push(`Tam: ${it.pizza_size_name}${it.pizza_crust_name ? ` · Borda: ${it.pizza_crust_name}` : ""}`);
      else if (it.selected_size) extras.push(`Tam: ${it.selected_size}`);
      if (Array.isArray(it.pizza_flavors) && it.pizza_flavors.length)
        extras.push(`Sabores: ${it.pizza_flavors.map((f) => f.name).join(" e ")}`);
      if (Array.isArray(it.pizza_addons) && it.pizza_addons.length)
        extras.push(`Adicionais: ${it.pizza_addons.map((a) => a.name).join(", ")}`);
      if (it.half_two_name) extras.push(`2ª metade: ${it.half_two_name}`);
      if (it.notes) extras.push(`Obs: ${it.notes}`);
      return `<tr>
        <td style="vertical-align:top">${it.quantity}x</td>
        <td>${it.name}${extras.length ? `<br><small>${extras.join("<br>")}</small>` : ""}</td>
        <td style="text-align:right;vertical-align:top">${brl((it.unit_price || 0) * (it.quantity || 1))}</td>
      </tr>`;
    })
    .join("");

  const subtotal = (order.total || 0) - (order.delivery_fee || 0) + (order.discount || 0);
  const pickup = isPickup(order);

  return `
    <h1 class="bold">${store.name}</h1>
    <div class="center">Pedido #${order.order_number ?? "-"}</div>
    <div class="center">${fmtTime(order.created_at)}</div>
    <div class="center">${order.table_number ? `Mesa ${order.table_number}` : pickup ? "RETIRADA" : "DELIVERY"}</div>
    <hr>
    ${customer && (customer.display_name || customer.phone) ? `
      <h2>Cliente</h2>
      ${customer.display_name ? `<div>${customer.display_name}</div>` : ""}
      ${customer.phone ? `<div>Tel: ${customer.phone}</div>` : ""}
      ${!pickup && order.delivery_address ? `<div>End: ${order.delivery_address}</div>` : ""}
      <hr>
    ` : (!pickup && order.delivery_address ? `<h2>Endereço</h2><div>${order.delivery_address}</div><hr>` : "")}
    <h2>Itens</h2>
    <table>${itemsHTML}</table>
    <hr>
    <div class="row"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
    ${order.delivery_fee ? `<div class="row"><span>Entrega:</span><span>${brl(order.delivery_fee)}</span></div>` : ""}
    ${order.discount ? `<div class="row"><span>Desconto:</span><span>-${brl(order.discount)}</span></div>` : ""}
    <div class="row bold"><span>TOTAL:</span><span>${brl(order.total)}</span></div>
    ${order.payment_method ? `<div style="margin-top:6px">Pagamento: ${order.payment_method}</div>` : ""}
    ${order.customer_notes ? `<hr><h2>Observações</h2><div>${order.customer_notes}</div>` : ""}
    <div class="center" style="margin-top:10px">Obrigado!</div>
  `;
}

(async () => {
  const key = decodeURIComponent(location.hash.slice(1));
  if (!key) return;
  const { [key]: payload } = await chrome.storage.local.get(key);
  if (!payload) return;
  document.title = `Pedido #${payload.order?.order_number ?? ""}`;
  document.getElementById("content").innerHTML = buildHTML(payload);
  // Cleanup stored payload
  chrome.storage.local.remove(key);
  // Print + close
  setTimeout(() => {
    window.print();
    setTimeout(() => window.close(), 800);
  }, 200);
})();
