import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { OBRA_PHASES, type ObraPhase, type ExpectedDoc } from "./phases";

export interface PhaseCoverage {
  key: string;
  name: string;
  order: number;
  expected: ExpectedDoc[];
  coveredDocTypes: string[];
  missingRequired: ExpectedDoc[];
  status: "complete" | "partial" | "empty";
}

export interface ProjectCoverageResult {
  projectId: string;
  phases: PhaseCoverage[];
  totalPhases: number;
  completePhases: number;
  partialPhases: number;
  emptyPhases: number;
  overallPct: number;
  nextSuggestion: string | null;
  docCount: number;
}

interface PhaseDocRow {
  phase_key: string;
  doc_type: string;
  file_name: string | null;
}

export async function getCoverageForProject(
  projectId: string,
  organizationId: string,
): Promise<ProjectCoverageResult> {
  const client = getInsForgeAdminClient();

  const [phaseResult, fileCountResult] = await Promise.all([
    client.database
      .from("project_phase_docs")
      .select("phase_key, doc_type, file_name")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId),
    client.database
      .from("uploaded_files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("organization_id", organizationId),
  ]);

  const rows = (phaseResult.data ?? []) as PhaseDocRow[];
  const docCount = fileCountResult.count ?? 0;

  // Build a map: phase_key → Set of covered doc_types
  const covered = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!covered.has(row.phase_key)) covered.set(row.phase_key, new Set());
    covered.get(row.phase_key)!.add(row.doc_type);
  }

  const phases: PhaseCoverage[] = OBRA_PHASES.map((phase: ObraPhase) => {
    const coveredDocTypes = [...(covered.get(phase.key) ?? [])];
    const missingRequired = phase.expected.filter(
      (d) => d.required && !coveredDocTypes.includes(d.doc_type),
    );
    const status =
      coveredDocTypes.length === 0
        ? "empty"
        : missingRequired.length === 0
        ? "complete"
        : "partial";

    return {
      key: phase.key,
      name: phase.name,
      order: phase.order,
      expected: phase.expected,
      coveredDocTypes,
      missingRequired,
      status,
    };
  });

  const completePhases = phases.filter((p) => p.status === "complete").length;
  const partialPhases  = phases.filter((p) => p.status === "partial").length;
  const emptyPhases    = phases.filter((p) => p.status === "empty").length;
  const overallPct = Math.round((completePhases / phases.length) * 100);

  // First partial or empty phase with required docs → the next suggestion
  const nextPhase = phases.find(
    (p) => p.status !== "complete" && p.missingRequired.length > 0,
  );
  const nextSuggestion = nextPhase
    ? `Fase "${nextPhase.name}" le falta: ${nextPhase.missingRequired.map((d) => d.label).join(", ")}.`
    : null;

  return {
    projectId,
    phases,
    totalPhases: phases.length,
    completePhases,
    partialPhases,
    emptyPhases,
    overallPct,
    nextSuggestion,
    docCount,
  };
}
