"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Check, X, Edit2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FileProposal {
  fileName: string;
  content: string;        // text or base64
  contentType: string;
  description: string;
  organizationId: string;
}

interface DocumentProposalCardProps {
  proposal: FileProposal;
  /** Called with null when user rejects */
  onDecision: (accepted: boolean, finalName?: string) => void;
}

/**
 * Approval UI for AI-generated files.
 * Shown when the agent calls `generar_archivo`.
 * User can accept (optionally renaming), or reject.
 */
export function DocumentProposalCard({ proposal, onDecision }: DocumentProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(proposal.fileName);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          fileName: name,
          content: proposal.content,
          contentType: proposal.contentType,
          organizationId: proposal.organizationId,
        }),
      });
      setDone(true);
      onDecision(true, name);
    } catch {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
      >
        <Check className="h-4 w-4" />
        <span>
          <strong>{name}</strong> guardado en la base documental.
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 24 }}
      className="w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm"
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">EdificIA propone guardar</p>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 h-7 w-full rounded border bg-background px-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary truncate max-w-full"
            >
              <span className="truncate">{name}</span>
              <Edit2 className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{proposal.description}</p>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={saving || !name.trim()}
          className="flex-1"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 animate-bounce" />
              Guardando…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Guardar
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDecision(false)}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getInsForgeClient } = await import("@/lib/insforge/client");
    const all = getInsForgeClient().getHttpClient().getHeaders();
    return all.Authorization ? { Authorization: all.Authorization } : {};
  } catch {
    return {};
  }
}
