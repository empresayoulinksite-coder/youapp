import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, User as UserIcon, Mail, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Youapp" },
      { name: "description", content: "Gerencie seus dados de perfil." },
    ],
  }),
  component: ProfilePage,
});

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
      }
      setFetching(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Perfil atualizado!");
      setProfile((p) => (p ? { ...p, display_name: displayName } : p));
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const avatar = profile?.avatar_url;
  const initial = (profile?.display_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link to="/" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">Meu Perfil</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col items-center text-center">
          {avatar ? (
            <img
              src={avatar}
              alt="Avatar"
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-2xl font-bold">
              {initial}
            </div>
          )}
          <h2 className="mt-3 text-lg font-bold">{profile?.display_name || "Sem nome"}</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1 flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5" /> Nome de exibição
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={fetching}
              className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
              placeholder="Como você quer ser chamado"
            />
          </div>

          {msg && (
            <div className="text-sm bg-brand-soft text-brand rounded-lg px-3 py-2">{msg}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || fetching}
            className="w-full bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-card border border-border text-destructive font-semibold py-3 rounded-full flex items-center justify-center gap-2 hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </main>
    </div>
  );
}
