import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "welcome_modal_seen_v1";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["welcome-modal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("welcome_modal")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (seen === data.id) return;
    setOpen(true);
    sessionStorage.setItem(STORAGE_KEY, data.id);
  }, [data]);

  if (!data) return null;

  const handleCta = () => {
    if (data.cta_url) {
      if (data.cta_url.startsWith("http")) {
        window.open(data.cta_url, "_blank");
      } else {
        window.location.href = data.cta_url;
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        {data.image_url && (
          <img
            src={data.image_url}
            alt={data.title}
            className="h-48 w-full object-cover"
          />
        )}
        <div className="space-y-3 p-5">
          <h2 className="text-xl font-bold">{data.title}</h2>
          {data.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {data.description}
            </p>
          )}
          {data.cta_label && (
            <Button onClick={handleCta} className="w-full">
              {data.cta_label}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
