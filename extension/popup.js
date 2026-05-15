const $ = (id) => document.getElementById(id);

async function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

async function refresh() {
  const state = await send({ type: "getState" });
  const status = $("status");
  if (state.loggedIn && state.stats?.connected) {
    status.textContent = "● conectado";
    status.className = "status connected";
  } else if (state.loggedIn) {
    status.textContent = "○ conectando…";
    status.className = "status";
  } else {
    status.textContent = "desconectado";
    status.className = "status error";
  }

  if (!state.loggedIn) {
    $("login-view").classList.remove("hidden");
    $("main-view").classList.add("hidden");
    return;
  }
  $("login-view").classList.add("hidden");
  $("main-view").classList.remove("hidden");
  $("user-email").textContent = state.email ?? "";
  $("stat-count").textContent = state.stats?.printedToday ?? 0;
  $("stat-last").textContent = state.stats?.lastOrderNumber
    ? `#${state.stats.lastOrderNumber}`
    : "—";

  const enabled = new Set(state.enabledStoreIds ?? []);
  const list = $("stores");
  list.innerHTML = "";
  if (!state.stores || state.stores.length === 0) {
    list.innerHTML = '<div class="muted small">Nenhuma loja vinculada.</div>';
    return;
  }
  for (const s of state.stores) {
    const div = document.createElement("label");
    div.className = "store";
    div.innerHTML = `
      <input type="checkbox" ${enabled.has(s.id) ? "checked" : ""} data-id="${s.id}" />
      <span>${s.emoji ?? "🏪"}</span>
      <span class="store-name">${s.name}</span>
    `;
    list.appendChild(div);
  }
  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async () => {
      const ids = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(
        (el) => el.dataset.id,
      );
      await send({ type: "setEnabledStores", ids });
    });
  });
}

$("signin-btn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return;
  $("login-error").textContent = "";
  $("signin-btn").disabled = true;
  $("signin-btn").textContent = "Entrando…";
  const res = await send({ type: "signIn", email, password });
  $("signin-btn").disabled = false;
  $("signin-btn").textContent = "Entrar";
  if (!res?.ok) {
    $("login-error").textContent = res?.error ?? "Falha no login";
    return;
  }
  await refresh();
});

$("signout-btn").addEventListener("click", async () => {
  await send({ type: "signOut" });
  await refresh();
});
$("refresh-btn").addEventListener("click", async () => {
  await send({ type: "refreshStores" });
  await refresh();
});
$("forgot-btn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const msgEl = $("forgot-msg");
  if (!email) {
    msgEl.textContent = "Digite seu email acima primeiro.";
    msgEl.style.color = "#b91c1c";
    return;
  }
  msgEl.style.color = "";
  msgEl.textContent = "Enviando…";
  const res = await send({
    type: "forgotPassword",
    email,
    redirectTo: "https://youapp.lovable.app/reset-password",
  });
  if (res?.ok) {
    msgEl.style.color = "#166534";
    msgEl.textContent = "Email enviado! Verifique sua caixa de entrada.";
  } else {
    msgEl.style.color = "#b91c1c";
    msgEl.textContent = res?.error ?? "Falha ao enviar email.";
  }
});
$("test-btn").addEventListener("click", async () => {
  await send({ type: "testPrint" });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "stats") refresh();
});

refresh();
setInterval(refresh, 3000);
