"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Loader2, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgMember } from "@/hooks/useOrgMember";
import { getAuthHeaders } from "@/lib/insforge/client";
import { orgSettingsResponseSchema, type OrgSettingsResponse } from "@/lib/validators/api-responses";

type OrgSettings = OrgSettingsResponse;

export default function AdminSettingsPage() {
  const orgMember = useOrgMember();
  const router = useRouter();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({ name: "", primaryColor: "#6366f1", logoUrl: "", agentName: "EdificIA" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (orgMember.status === "ok" && orgMember.member.role !== "admin") {
      router.replace("/dashboard/chat");
    }
  }, [orgMember, router]);

  useEffect(() => {
    if (orgMember.status !== "ok" || orgMember.member.role !== "admin") return;
    async function load() {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      const res = await fetch("/api/admin/settings", { headers }).catch(() => null);
      if (!res?.ok) return;
      const parsed = orgSettingsResponseSchema.safeParse(await res.json());
      if (!parsed.success) return;
      const data = parsed.data;
      setSettings(data);
      setForm({
        name: data.name,
        primaryColor: data.primary_color ?? "#6366f1",
        logoUrl: data.logo_url ?? "",
        agentName: data.agent_name ?? "EdificIA",
      });
    }
    void load();
  }, [orgMember]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          name: form.name,
          primaryColor: form.primaryColor,
          logoUrl: form.logoUrl || null,
          agentName: form.agentName,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (orgMember.status === "loading" || !settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/admin")}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Settings className="h-5 w-5 text-primary" />
            Configuración de empresa
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{settings.slug}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={(e) => { void handleSave(e); }} className="space-y-5 rounded-xl border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Nombre de la empresa</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Mi Constructora S.A."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Nombre del agente IA</label>
          <input
            value={form.agentName}
            onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="EdificIA"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cómo se presenta el asistente en el chat de tu empresa.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Color principal</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              className="h-10 w-16 cursor-pointer rounded-lg border bg-background p-1"
            />
            <input
              value={form.primaryColor}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              placeholder="#6366f1"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div
              className="h-8 w-8 rounded-full border shadow-sm"
              style={{ backgroundColor: form.primaryColor }}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">URL del logo</label>
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="https://..."
          />
          {form.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoUrl}
              alt="Logo preview"
              className="mt-2 h-10 w-auto rounded border object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando…
            </span>
          ) : saved ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Guardado
            </span>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </form>
    </div>
  );
}
