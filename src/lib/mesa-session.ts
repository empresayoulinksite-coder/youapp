// Helpers para o "modo mesa" no sessionStorage com validade.
// Evita que um QR Code lido há dias continue marcando o cliente como "na mesa".

const KEY_NUMBER = "youapp_mesa";
const KEY_STORE = "youapp_mesa_store";
const KEY_TS = "youapp_mesa_ts";

export const MESA_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas

export function setMesaSession(tableNumber: string | number, storeId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_NUMBER, String(tableNumber));
  sessionStorage.setItem(KEY_STORE, storeId);
  sessionStorage.setItem(KEY_TS, String(Date.now()));
}

export function clearMesaSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_NUMBER);
  sessionStorage.removeItem(KEY_STORE);
  sessionStorage.removeItem(KEY_TS);
}

/**
 * Retorna a sessão de mesa válida para a loja informada, ou null.
 * Se houver sessão expirada, limpa automaticamente.
 */
export function getMesaSession(
  storeId: string
): { tableNumber: number; storeId: string } | null {
  if (typeof window === "undefined") return null;
  const mesa = sessionStorage.getItem(KEY_NUMBER);
  const mesaStore = sessionStorage.getItem(KEY_STORE);
  const tsRaw = sessionStorage.getItem(KEY_TS);
  if (!mesa || !mesaStore) return null;

  const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
  const expired = !ts || Date.now() - ts > MESA_TTL_MS;
  if (expired) {
    clearMesaSession();
    return null;
  }

  if (mesaStore !== storeId) return null;

  const n = parseInt(mesa, 10);
  if (!Number.isFinite(n)) return null;
  return { tableNumber: n, storeId: mesaStore };
}
