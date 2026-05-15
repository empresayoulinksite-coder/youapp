// YouApp Print — Supabase Realtime client (Manifest V3 service worker)
// No external deps. Uses fetch + WebSocket.

const SUPABASE_URL = "https://ugfsatbvbiwxqsnxeakp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZnNhdGJ2Yml3eHFzbnhlYWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzA4OTAsImV4cCI6MjA5MjEwNjg5MH0.EZA8DWSLWMsSSiu7RI67oKFkeoiElrA_7voTVJqC9hk";

const REALTIME_URL = `wss://ugfsatbvbiwxqsnxeakp.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let pollTimer = null;
let refCounter = 0;
const subscribedStores = new Set();
const printedOrders = new Set(); // session-level dedupe
let stats = { printedToday: 0, lastPrintedAt: null, lastOrderNumber: null, connected: false };
const PRINTED_HISTORY_KEY = "printedOrderHistory";
const PRINTED_TTL_MS = 24 * 60 * 60 * 1000;

// ------------- Storage helpers -------------
async function getSession() {
  const { session } = await chrome.storage.local.get("session");
  return session ?? null;
}
async function setSession(session) {
  await chrome.storage.local.set({ session });
}
async function getStores() {
  const { stores } = await chrome.storage.local.get("stores");
  return stores ?? [];
}
async function getEnabledStoreIds() {
  const { enabledStoreIds } = await chrome.storage.local.get("enabledStoreIds");
  return enabledStoreIds ?? [];
}
async function loadStats() {
  const { stats: s } = await chrome.storage.local.get("stats");
  if (s) {
    // Reset counter if day changed
    const today = new Date().toDateString();
    if (s.day !== today) {
      stats = { printedToday: 0, lastPrintedAt: null, lastOrderNumber: null, connected: false, day: today };
      await chrome.storage.local.set({ stats });
    } else {
      stats = { ...s, connected: false };
    }
  } else {
    stats = { printedToday: 0, lastPrintedAt: null, lastOrderNumber: null, connected: false, day: new Date().toDateString() };
  }
}
async function saveStats() {
  await chrome.storage.local.set({ stats });
  chrome.runtime.sendMessage({ type: "stats", stats }).catch(() => {});
}
async function loadPrintedOrders() {
  const { [PRINTED_HISTORY_KEY]: history } = await chrome.storage.local.get(PRINTED_HISTORY_KEY);
  const now = Date.now();
  printedOrders.clear();
  for (const entry of Array.isArray(history) ? history : []) {
    if (entry?.id && now - Number(entry.t || 0) < PRINTED_TTL_MS) {
      printedOrders.add(entry.id);
    }
  }
  await savePrintedOrders();
}
async function savePrintedOrders() {
  const now = Date.now();
  await chrome.storage.local.set({
    [PRINTED_HISTORY_KEY]: Array.from(printedOrders).map((id) => ({ id, t: now })),
  });
}

// ------------- Auth -------------
async function refreshIfNeeded() {
  const session = await getSession();
  if (!session) return null;
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (Date.now() < expiresAt - 60_000) return session;
  // Refresh
  const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    await chrome.storage.local.remove("session");
    return null;
  }
  const fresh = await res.json();
  await setSession(fresh);
  return fresh;
}

// ------------- REST -------------
async function restGet(path, accessToken) {
  const res = await fetch(`${REST_URL}/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status}`);
  return res.json();
}

// ------------- WebSocket / Realtime -------------
function nextRef() {
  refCounter += 1;
  return String(refCounter);
}

async function connectRealtime() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const session = await refreshIfNeeded();
  if (!session) {
    stats.connected = false;
    await saveStats();
    return;
  }
  const enabled = await getEnabledStoreIds();
  if (enabled.length === 0) {
    stats.connected = false;
    await saveStats();
    return;
  }

  console.log("[YouApp Print] Connecting realtime...");
  ws = new WebSocket(REALTIME_URL);
  subscribedStores.clear();

  ws.onopen = () => {
    console.log("[YouApp Print] WS open");
    stats.connected = true;
    saveStats();
    // Subscribe to each store
    for (const storeId of enabled) {
      const topic = `realtime:store:${storeId}`;
      ws.send(
        JSON.stringify({
          topic,
          event: "phx_join",
          ref: nextRef(),
          payload: {
            config: {
              broadcast: { self: false },
              postgres_changes: [
                {
                  event: "INSERT",
                  schema: "public",
                  table: "orders",
                  filter: `store_id=eq.${storeId}`,
                },
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "orders",
                  filter: `store_id=eq.${storeId}`,
                },
              ],
            },
            access_token: session.access_token,
          },
        }),
      );
      subscribedStores.add(storeId);
    }
    // Catch-up + polling: garante impressão mesmo se o Realtime falhar ou o service worker dormir
    void catchUpRecentOrders(enabled, session.access_token);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      const freshSession = await refreshIfNeeded();
      const freshEnabled = await getEnabledStoreIds();
      if (freshSession && freshEnabled.length > 0) {
        void catchUpRecentOrders(freshEnabled, freshSession.access_token);
      }
    }, 15_000);
    // Heartbeat
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() }));
      }
    }, 25_000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === "postgres_changes") {
        const payload = msg.payload?.data;
        if ((payload?.type === "INSERT" || payload?.type === "UPDATE") && payload.table === "orders") {
          const newRow = payload.record;
          if (newRow?.id && ["em_analise", "em_producao"].includes(newRow.status)) handleNewOrder(newRow.id);
        }
      }
    } catch (e) {
      console.error("[YouApp Print] WS parse error", e);
    }
  };

  ws.onclose = () => {
    console.log("[YouApp Print] WS closed");
    stats.connected = false;
    saveStats();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    // Reconnect with backoff
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connectRealtime(), 5000);
  };

  ws.onerror = (e) => {
    console.error("[YouApp Print] WS error", e);
  };
}

function disconnectRealtime() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pollTimer) clearInterval(pollTimer);
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  stats.connected = false;
  saveStats();
}

// ------------- Order print pipeline -------------
async function fetchOrderItems(orderId, token, { retries = 6, delayMs = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    const items = await restGet(`order_items?order_id=eq.${orderId}&select=*`, token);
    if (Array.isArray(items) && items.length > 0) return items;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  // Devolve vazio se ainda não chegaram (imprime mesmo assim)
  return [];
}

async function catchUpRecentOrders(storeIds, token) {
  try {
    const sinceIso = new Date(Date.now() - 30 * 60_000).toISOString();
    for (const storeId of storeIds) {
      const path = `orders?store_id=eq.${storeId}&created_at=gte.${encodeURIComponent(
        sinceIso,
      )}&status=in.(em_analise,em_producao)&select=id&order=created_at.asc`;
      const recent = await restGet(path, token);
      for (const r of recent ?? []) {
        if (r?.id && !printedOrders.has(r.id)) {
          handleNewOrder(r.id);
        }
      }
    }
  } catch (e) {
    console.error("[YouApp Print] catchUpRecentOrders error", e);
  }
}

async function handleNewOrder(orderId) {
  if (printedOrders.has(orderId)) return;
  printedOrders.add(orderId);

  try {
    const session = await refreshIfNeeded();
    if (!session) return;
    const token = session.access_token;

    const orders = await restGet(`orders?id=eq.${orderId}&select=*`, token);
    const order = orders?.[0];
    if (!order) return;

    // Espera os itens aparecerem (pedido + itens são inseridos em chamadas separadas)
    const items = await fetchOrderItems(orderId, token);

    const [storeArr, profileArr] = await Promise.all([
      restGet(`stores?id=eq.${order.store_id}&select=name,whatsapp`, token),
      restGet(`profiles?user_id=eq.${order.user_id}&select=display_name,phone`, token),
    ]);
    const store = storeArr?.[0] ?? { name: "Pedido", whatsapp: null };
    const customer = profileArr?.[0] ?? null;

    await openPrintTab({ store, order, items: items ?? [], customer });
    await savePrintedOrders();

    stats.printedToday += 1;
    stats.lastOrderNumber = order.order_number ?? null;
    stats.lastPrintedAt = new Date().toISOString();
    stats.day = new Date().toDateString();
    await saveStats();
  } catch (e) {
    console.error("[YouApp Print] handleNewOrder error", e);
    printedOrders.delete(orderId); // allow retry
  }
}

async function openPrintTab(payload) {
  const url = chrome.runtime.getURL("print.html");
  // Stash payload keyed by random id in storage; print.html reads it.
  const key = `print:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await chrome.storage.session?.set?.({ [key]: payload }).catch(() => {});
  // Fallback to local storage if session storage unavailable
  await chrome.storage.local.set({ [key]: payload });

  await chrome.windows.create({
    url: `${url}#${encodeURIComponent(key)}`,
    type: "popup",
    width: 420,
    height: 600,
    focused: false,
    state: "minimized",
  });
}

// ------------- Messages from popup -------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "getState") {
        const session = await getSession();
        const stores = await getStores();
        const enabledStoreIds = await getEnabledStoreIds();
        sendResponse({
          loggedIn: !!session,
          email: session?.user?.email ?? null,
          stores,
          enabledStoreIds,
          stats,
        });
        return;
      }
      if (msg.type === "signIn") {
        const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ email: msg.email, password: msg.password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          sendResponse({ ok: false, error: err.error_description || err.msg || "Falha no login" });
          return;
        }
        const session = await res.json();
        await setSession(session);
        await refreshStores();
        sendResponse({ ok: true });
        connectRealtime();
        return;
      }
      if (msg.type === "forgotPassword") {
        const url = `${AUTH_URL}/recover?redirect_to=${encodeURIComponent(msg.redirectTo)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ email: msg.email }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          sendResponse({ ok: false, error: err.error_description || err.msg || "Falha ao enviar email" });
          return;
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "signOut") {
        disconnectRealtime();
        await chrome.storage.local.clear();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "refreshStores") {
        await refreshStores();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "setEnabledStores") {
        await chrome.storage.local.set({ enabledStoreIds: msg.ids });
        disconnectRealtime();
        connectRealtime();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "testPrint") {
        await openPrintTab({
          store: { name: "Teste YouApp Print", whatsapp: null },
          order: {
            order_number: 999,
            created_at: new Date().toISOString(),
            delivery_type: "retirada",
            delivery_address: null,
            payment_method: "Dinheiro",
            customer_notes: "Pedido de teste da extensão",
            total: 25.5,
            delivery_fee: 0,
            discount: 0,
            table_number: null,
          },
          items: [
            { quantity: 1, name: "Hambúrguer Teste", unit_price: 25.5, notes: null },
          ],
          customer: { display_name: "Cliente Teste", phone: "(11) 99999-9999" },
        });
        sendResponse({ ok: true });
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true;
});

async function refreshStores() {
  const session = await refreshIfNeeded();
  if (!session) return;
  const userId = session.user.id;
  const token = session.access_token;
  try {
    const [owners, staff] = await Promise.all([
      restGet(`store_owners?user_id=eq.${userId}&select=store_id`, token),
      restGet(`store_staff?user_id=eq.${userId}&is_active=eq.true&select=store_id`, token),
    ]);
    const ids = Array.from(
      new Set([...(owners ?? []).map((r) => r.store_id), ...(staff ?? []).map((r) => r.store_id)]),
    );
    if (ids.length === 0) {
      await chrome.storage.local.set({ stores: [] });
      return;
    }
    const filter = `id=in.(${ids.join(",")})`;
    const stores = await restGet(`stores?${filter}&select=id,name,emoji`, token);
    await chrome.storage.local.set({ stores: stores ?? [] });
    // If no enabled list set yet, enable all by default
    const { enabledStoreIds } = await chrome.storage.local.get("enabledStoreIds");
    if (!enabledStoreIds) {
      await chrome.storage.local.set({ enabledStoreIds: ids });
    }
  } catch (e) {
    console.error("[YouApp Print] refreshStores error", e);
  }
}

// Keep service worker warm-ish + auto-reconnect
chrome.alarms.create("keepalive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "keepalive") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      await connectRealtime();
    }
  }
});

// Boot
(async () => {
  await loadStats();
  await connectRealtime();
})();

chrome.runtime.onStartup?.addListener(async () => {
  await loadStats();
  await connectRealtime();
});
chrome.runtime.onInstalled.addListener(async () => {
  await loadStats();
  await connectRealtime();
});
