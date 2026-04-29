import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, X, Clock, Star, Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { norm as normalize } from "@/lib/categories";

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  image_url: string | null;
  category: string;
  rating: number;
  delivery_time: string;
  delivery_fee: string;
  free_delivery: boolean;
  delivery_enabled: boolean;
}

const HISTORY_KEY = "youapp:search-history";
const MAX_HISTORY = 8;

export const Route = createFileRoute("/busca")({
  loader: async () => {
    const { data, error } = await supabase
      .from("stores")
      .select(
        "id, slug, name, emoji, image_url, category, rating, delivery_time, delivery_fee, free_delivery, delivery_enabled",
      )
      .eq("is_hidden", false)
      .order("name");
    if (error) throw error;
    return { stores: (data ?? []) as StoreRow[] };
  },
  errorComponent: ({ error }) => {
    if (typeof window !== "undefined") console.error(error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Algo deu errado. Tente novamente.
      </div>
    );
  },
  head: () => ({
    meta: [
      { title: "Buscar — Youapp" },
      {
        name: "description",
        content: "Encontre lojas e produtos pelo nome ou categoria no Youapp.",
      },
    ],
  }),
  component: BuscaPage,
});

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function BuscaPage() {
  const { stores } = Route.useLoaderData() as { stores: StoreRow[] };
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return stores
      .filter(
        (s) =>
          normalize(s.name).includes(q) || normalize(s.category).includes(q),
      )
      .slice(0, 30);
  }, [stores, query]);

  const commitSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...history.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(
      0,
      MAX_HISTORY,
    );
    setHistory(next);
    saveHistory(next);
  };

  const removeTerm = (term: string) => {
    const next = history.filter((h) => h !== term);
    setHistory(next);
    saveHistory(next);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const popularCategories = [
    "Lanches",
    "Pizza",
    "Japonesa",
    "Mercado",
    "Bebidas",
    "Farmácia",
    "Doces",
    "Saudável",
  ];

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="Voltar"
            className="p-1 -ml-1 rounded-full hover:bg-muted shrink-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitSearch(query);
            }}
            className="flex-1 flex items-center gap-2 rounded-full bg-muted px-4 py-2.5"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busque por loja, item ou categoria"
              className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-6">
        {query.trim() === "" ? (
          <>
            {/* Histórico */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Pesquisas recentes
                </h2>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-semibold text-brand"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm font-semibold">
                    Nenhuma pesquisa ainda
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Suas buscas aparecerão aqui.
                  </p>
                </div>
              ) : (
                <ul className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {history.map((term) => (
                    <li
                      key={term}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <button
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        className="flex-1 text-left text-sm truncate"
                      >
                        {term}
                      </button>
                      <button
                        onClick={() => removeTerm(term)}
                        aria-label={`Remover ${term}`}
                        className="p-1 rounded-full hover:bg-muted text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Sugestões */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
                Categorias populares
              </h2>
              <div className="flex flex-wrap gap-2">
                {popularCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setQuery(c);
                      inputRef.current?.focus();
                    }}
                    className="text-xs font-medium bg-card border border-border rounded-full px-3 py-1.5 hover:border-brand hover:text-brand"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section>
            <p className="text-xs text-muted-foreground mb-3">
              {results.length}{" "}
              {results.length === 1 ? "resultado" : "resultados"} para "{query}"
            </p>
            {results.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="text-3xl mb-2">🤷</div>
                <p className="font-semibold">Nada encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tente outro termo ou categoria.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {results.map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/loja/$slug"
                      params={{ slug: s.slug }}
                      onClick={() => commitSearch(query)}
                      className="flex items-center gap-3 bg-card rounded-2xl p-3 shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform"
                    >
                      <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
                        {s.image_url ? (
                          <img
                            src={s.image_url}
                            alt={s.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{s.emoji}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{s.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          <span className="font-semibold text-foreground">
                            {Number(s.rating).toFixed(1)}
                          </span>
                          <span>•</span>
                          <span className="truncate">{s.category}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs mt-1">
                          {s.delivery_enabled === false ? (
                            <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                              <Bike className="h-3.5 w-3.5" />
                              Apenas retirada
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {s.delivery_time}
                              </span>
                              <span
                                className={`flex items-center gap-1 ${s.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}
                              >
                                <Bike className="h-3.5 w-3.5" />
                                {s.delivery_fee}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
