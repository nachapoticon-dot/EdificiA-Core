export type ProfileEntityType =
  | "supplier"
  | "subcontractor"
  | "trade"
  | "location"
  | "cost_center"
  | "document_type"
  | "currency"
  | "naming_convention";

export type ProfilePatternKind =
  | "naming_convention"
  | "document_format"
  | "currency"
  | "trade_vocabulary"
  | "source_reliability"
  | "frequent_supplier"
  | "frequent_subcontractor"
  | "sensitivity_default";

export type ProfileRiskLevel = "bajo" | "medio" | "alto" | "critico";

export interface ProfileProjectInput {
  id: string;
  name: string;
  status: string | null;
  location: string | null;
  updatedAt: string | null;
}

export interface ProfileSubcontractInput {
  projectId: string;
  vendorName: string | null;
  trade: string | null;
  contractAmount: number | null;
  currency: string | null;
  status: string | null;
  updatedAt: string | null;
}

export interface ProfileSupplyInput {
  projectId: string;
  itemName: string | null;
  category: string | null;
  supplierName: string | null;
  currency: string | null;
  status: string | null;
  updatedAt: string | null;
}

export interface ProfileHseInput {
  projectId: string;
  status: string;
  recordType: string;
  updatedAt: string | null;
}

export interface ProfileScheduleInput {
  projectId: string;
  status: string;
  updatedAt: string | null;
}

export interface ProfileFinancialInput {
  projectId: string;
  currency: string | null;
  updatedAt: string | null;
}

export interface ProfileDocumentInput {
  projectId: string | null;
  documentType: string | null;
  readinessStatus: string;
  sensitivity: string | null;
  sourceType: string | null;
  updatedAt: string | null;
}

export interface ProfileReportInput {
  projectId: string | null;
  documentType: string | null;
  verdict: string;
  confidence: number | null;
  updatedAt: string | null;
}

export interface ProfileFindingInput {
  projectId: string | null;
  severity: string;
  status: string;
}

export interface ProfileInputs {
  projects: ProfileProjectInput[];
  subcontracts: ProfileSubcontractInput[];
  supplies: ProfileSupplyInput[];
  hse: ProfileHseInput[];
  schedule: ProfileScheduleInput[];
  financials: ProfileFinancialInput[];
  documents: ProfileDocumentInput[];
  reports: ProfileReportInput[];
  findings: ProfileFindingInput[];
}

export interface EntityCandidate {
  entityType: ProfileEntityType;
  canonicalName: string;
  displayName: string;
  occurrenceCount: number;
  confidence: number;
  aliases: string[];
  metadata?: Record<string, unknown>;
  lastSeenAt?: string | null;
}

export interface PatternCandidate {
  patternKind: ProfilePatternKind;
  patternKey: string;
  patternValue: Record<string, unknown>;
  confidence: number;
  evidenceCount: number;
  lastObservedAt?: string | null;
}

export interface ProjectCoverage {
  projectId: string;
  documentsTotal: number;
  documentsIndexed: number;
  documentsObserved: number;
  subcontractsCount: number;
  suppliesCount: number;
  hseRecordsCount: number;
  scheduleTasksCount: number;
  findingsOpen: number;
  reportsCount: number;
  coverageScore: number;
  riskLevel: ProfileRiskLevel;
  lastActivityAt: string | null;
  metadata: Record<string, unknown>;
}

export interface ProfileAggregation {
  entities: EntityCandidate[];
  patterns: PatternCandidate[];
  coverage: ProjectCoverage[];
  summary: ProfileSummary;
}

export interface ProfileSummary {
  text: string;
  projectsCount: number;
  topSuppliers: string[];
  topSubcontractors: string[];
  topTrades: string[];
  dominantCurrency: string | null;
  namingHints: string[];
  riskyProjects: number;
}

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "para", "por", "y", "obra", "proyecto",
]);

const NAMING_PREFIX_MIN_SHARE = 0.4;
const NAMING_PREFIX_MIN_ABS = 2;

export function aggregateEnterpriseProfile(inputs: ProfileInputs): ProfileAggregation {
  const entitiesByKey = new Map<string, EntityCandidate>();

  const addEntity = (params: {
    entityType: ProfileEntityType;
    rawName: string | null | undefined;
    metadata?: Record<string, unknown>;
    timestamp?: string | null;
    confidenceFloor?: number;
  }): void => {
    const raw = (params.rawName ?? "").trim();
    if (!raw) return;
    const canonical = canonicalize(raw);
    if (!canonical) return;
    const key = `${params.entityType}::${canonical}`;
    const existing = entitiesByKey.get(key);
    const displayName = pickDisplayName(existing?.displayName, raw);
    const aliases = mergeAliases(existing?.aliases ?? [], raw, canonical);
    const occurrence = (existing?.occurrenceCount ?? 0) + 1;
    const lastSeenAt = pickMaxTimestamp(existing?.lastSeenAt, params.timestamp ?? null);
    const baseConfidence = Math.min(1, 0.4 + Math.log10(1 + occurrence) * 0.25);
    const confidence = Math.max(baseConfidence, params.confidenceFloor ?? 0);
    entitiesByKey.set(key, {
      entityType: params.entityType,
      canonicalName: canonical,
      displayName,
      occurrenceCount: occurrence,
      confidence: roundConfidence(confidence),
      aliases,
      metadata: { ...(existing?.metadata ?? {}), ...(params.metadata ?? {}) },
      lastSeenAt,
    });
  };

  // suppliers
  for (const supply of inputs.supplies) {
    if (supply.supplierName) {
      addEntity({
        entityType: "supplier",
        rawName: supply.supplierName,
        timestamp: supply.updatedAt,
      });
    }
    if (supply.category) {
      addEntity({
        entityType: "trade",
        rawName: supply.category,
        timestamp: supply.updatedAt,
        metadata: { fromSupplyCategory: true },
      });
    }
  }

  // subcontractors + trades
  for (const sub of inputs.subcontracts) {
    if (sub.vendorName) {
      addEntity({
        entityType: "subcontractor",
        rawName: sub.vendorName,
        timestamp: sub.updatedAt,
        metadata: { lastStatus: sub.status ?? null },
      });
    }
    if (sub.trade) {
      addEntity({
        entityType: "trade",
        rawName: sub.trade,
        timestamp: sub.updatedAt,
      });
    }
  }

  // locations from projects
  for (const project of inputs.projects) {
    if (project.location) {
      addEntity({
        entityType: "location",
        rawName: project.location,
        timestamp: project.updatedAt,
      });
    }
  }

  // document types from enterprise documents and document intelligence reports
  for (const doc of inputs.documents) {
    if (doc.documentType) {
      addEntity({
        entityType: "document_type",
        rawName: doc.documentType,
        timestamp: doc.updatedAt,
        metadata: { lastSource: doc.sourceType ?? null },
      });
    }
  }
  for (const report of inputs.reports) {
    if (report.documentType) {
      addEntity({
        entityType: "document_type",
        rawName: report.documentType,
        timestamp: report.updatedAt,
      });
    }
  }

  // currencies
  const currencyTimestamps = new Map<string, string | null>();
  const collectCurrency = (currency: string | null | undefined, timestamp: string | null | undefined) => {
    if (!currency) return;
    addEntity({ entityType: "currency", rawName: currency, timestamp });
    const upper = currency.toUpperCase();
    currencyTimestamps.set(upper, pickMaxTimestamp(currencyTimestamps.get(upper) ?? null, timestamp ?? null));
  };
  for (const sub of inputs.subcontracts) collectCurrency(sub.currency, sub.updatedAt);
  for (const supply of inputs.supplies) collectCurrency(supply.currency, supply.updatedAt);
  for (const financial of inputs.financials) collectCurrency(financial.currency, financial.updatedAt);

  const entities = Array.from(entitiesByKey.values()).sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  const patterns: PatternCandidate[] = [];

  // naming conventions
  const namingPrefixes = detectNamingPrefixes(inputs.projects.map((p) => p.name));
  for (const prefix of namingPrefixes) {
    patterns.push({
      patternKind: "naming_convention",
      patternKey: prefix.token,
      patternValue: {
        token: prefix.displayToken,
        share: prefix.share,
        examples: prefix.examples,
      },
      confidence: roundConfidence(prefix.share),
      evidenceCount: prefix.count,
      lastObservedAt: null,
    });
  }

  // dominant currency
  const currencyEntities = entities.filter((e) => e.entityType === "currency");
  const dominantCurrency = currencyEntities[0] ?? null;
  if (dominantCurrency) {
    patterns.push({
      patternKind: "currency",
      patternKey: dominantCurrency.canonicalName,
      patternValue: {
        currency: dominantCurrency.displayName.toUpperCase(),
        occurrenceCount: dominantCurrency.occurrenceCount,
      },
      confidence: roundConfidence(Math.min(1, 0.5 + dominantCurrency.occurrenceCount * 0.05)),
      evidenceCount: dominantCurrency.occurrenceCount,
      lastObservedAt: dominantCurrency.lastSeenAt ?? null,
    });
  }

  // frequent suppliers
  const supplierEntities = entities.filter((e) => e.entityType === "supplier");
  for (const supplier of supplierEntities.slice(0, 5)) {
    if (supplier.occurrenceCount < 2) continue;
    patterns.push({
      patternKind: "frequent_supplier",
      patternKey: supplier.canonicalName,
      patternValue: {
        displayName: supplier.displayName,
        occurrenceCount: supplier.occurrenceCount,
      },
      confidence: supplier.confidence,
      evidenceCount: supplier.occurrenceCount,
      lastObservedAt: supplier.lastSeenAt ?? null,
    });
  }

  // frequent subcontractors
  const subEntities = entities.filter((e) => e.entityType === "subcontractor");
  for (const sub of subEntities.slice(0, 5)) {
    if (sub.occurrenceCount < 2) continue;
    patterns.push({
      patternKind: "frequent_subcontractor",
      patternKey: sub.canonicalName,
      patternValue: {
        displayName: sub.displayName,
        occurrenceCount: sub.occurrenceCount,
        lastStatus: sub.metadata?.lastStatus ?? null,
      },
      confidence: sub.confidence,
      evidenceCount: sub.occurrenceCount,
      lastObservedAt: sub.lastSeenAt ?? null,
    });
  }

  // trade vocabulary
  const tradeEntities = entities.filter((e) => e.entityType === "trade");
  for (const trade of tradeEntities.slice(0, 8)) {
    if (trade.occurrenceCount < 2) continue;
    patterns.push({
      patternKind: "trade_vocabulary",
      patternKey: trade.canonicalName,
      patternValue: {
        displayName: trade.displayName,
        occurrenceCount: trade.occurrenceCount,
      },
      confidence: trade.confidence,
      evidenceCount: trade.occurrenceCount,
      lastObservedAt: trade.lastSeenAt ?? null,
    });
  }

  // source reliability
  const reliability = computeSourceReliability(inputs.documents);
  for (const entry of reliability) {
    patterns.push({
      patternKind: "source_reliability",
      patternKey: entry.sourceType,
      patternValue: {
        indexedShare: entry.indexedShare,
        observedShare: entry.observedShare,
        totalDocs: entry.total,
      },
      confidence: roundConfidence(0.5 + entry.indexedShare * 0.5),
      evidenceCount: entry.total,
      lastObservedAt: null,
    });
  }

  // document format frequency (top document types as preferred formats)
  const docTypeEntities = entities.filter((e) => e.entityType === "document_type");
  for (const docType of docTypeEntities.slice(0, 5)) {
    if (docType.occurrenceCount < 2) continue;
    patterns.push({
      patternKind: "document_format",
      patternKey: docType.canonicalName,
      patternValue: {
        displayName: docType.displayName,
        occurrenceCount: docType.occurrenceCount,
      },
      confidence: docType.confidence,
      evidenceCount: docType.occurrenceCount,
      lastObservedAt: docType.lastSeenAt ?? null,
    });
  }

  const coverage = computeCoverage(inputs);

  const riskyProjects = coverage.filter((c) => c.riskLevel === "alto" || c.riskLevel === "critico").length;
  const summary: ProfileSummary = {
    text: buildSummaryText({
      projectsCount: inputs.projects.length,
      topSuppliers: supplierEntities.slice(0, 3).map((e) => e.displayName),
      topSubcontractors: subEntities.slice(0, 3).map((e) => e.displayName),
      topTrades: tradeEntities.slice(0, 3).map((e) => e.displayName),
      dominantCurrency: dominantCurrency ? dominantCurrency.displayName.toUpperCase() : null,
      namingHints: namingPrefixes.slice(0, 3).map((p) => p.displayToken),
      riskyProjects,
    }),
    projectsCount: inputs.projects.length,
    topSuppliers: supplierEntities.slice(0, 5).map((e) => e.displayName),
    topSubcontractors: subEntities.slice(0, 5).map((e) => e.displayName),
    topTrades: tradeEntities.slice(0, 5).map((e) => e.displayName),
    dominantCurrency: dominantCurrency ? dominantCurrency.displayName.toUpperCase() : null,
    namingHints: namingPrefixes.slice(0, 5).map((p) => p.displayToken),
    riskyProjects,
  };

  return { entities, patterns, coverage, summary };
}

interface NamingPrefix {
  token: string;
  displayToken: string;
  count: number;
  share: number;
  examples: string[];
}

export function detectNamingPrefixes(names: string[]): NamingPrefix[] {
  const cleaned = names
    .map((name) => (name ?? "").trim())
    .filter((name) => name.length > 0);
  if (cleaned.length < NAMING_PREFIX_MIN_ABS) return [];

  const buckets = new Map<string, { display: string; count: number; examples: string[] }>();
  for (const name of cleaned) {
    const firstToken = name.split(/\s+/)[0] ?? "";
    const canonical = canonicalize(firstToken);
    if (!canonical || canonical.length < 3) continue;
    if (STOPWORDS.has(canonical)) continue;
    const bucket = buckets.get(canonical) ?? { display: firstToken, count: 0, examples: [] };
    bucket.count += 1;
    if (bucket.examples.length < 3 && !bucket.examples.includes(name)) bucket.examples.push(name);
    if (firstToken.length > bucket.display.length) bucket.display = firstToken;
    buckets.set(canonical, bucket);
  }

  const total = cleaned.length;
  const results: NamingPrefix[] = [];
  for (const [token, bucket] of buckets) {
    const share = bucket.count / total;
    if (bucket.count >= NAMING_PREFIX_MIN_ABS && share >= NAMING_PREFIX_MIN_SHARE) {
      results.push({ token, displayToken: bucket.display, count: bucket.count, share, examples: bucket.examples });
    }
  }
  results.sort((a, b) => b.count - a.count);
  return results;
}

interface SourceReliabilityEntry {
  sourceType: string;
  total: number;
  indexedShare: number;
  observedShare: number;
}

function computeSourceReliability(documents: ProfileDocumentInput[]): SourceReliabilityEntry[] {
  const buckets = new Map<string, { total: number; indexed: number; observed: number }>();
  for (const doc of documents) {
    const key = (doc.sourceType ?? "manual_upload").trim() || "manual_upload";
    const bucket = buckets.get(key) ?? { total: 0, indexed: 0, observed: 0 };
    bucket.total += 1;
    if (doc.readinessStatus === "indexada" || doc.readinessStatus === "operativa") bucket.indexed += 1;
    if (doc.readinessStatus === "observada") bucket.observed += 1;
    buckets.set(key, bucket);
  }
  const out: SourceReliabilityEntry[] = [];
  for (const [sourceType, bucket] of buckets) {
    if (bucket.total === 0) continue;
    out.push({
      sourceType,
      total: bucket.total,
      indexedShare: round3(bucket.indexed / bucket.total),
      observedShare: round3(bucket.observed / bucket.total),
    });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

export function computeCoverage(inputs: ProfileInputs): ProjectCoverage[] {
  const result: ProjectCoverage[] = [];
  for (const project of inputs.projects) {
    const docs = inputs.documents.filter((d) => d.projectId === project.id);
    const indexed = docs.filter((d) => d.readinessStatus === "indexada" || d.readinessStatus === "operativa").length;
    const observed = docs.filter((d) => d.readinessStatus === "observada").length;

    const subcontracts = inputs.subcontracts.filter(
      (s) => s.projectId === project.id && s.status !== "terminated" && s.status !== "draft",
    ).length;
    const supplies = inputs.supplies.filter((s) => s.projectId === project.id).length;
    const hse = inputs.hse.filter((h) => h.projectId === project.id).length;
    const schedule = inputs.schedule.filter((s) => s.projectId === project.id).length;
    const findingsOpen = inputs.findings.filter((f) => f.projectId === project.id && f.status === "open").length;
    const reports = inputs.reports.filter((r) => r.projectId === project.id).length;

    const docsScore = Math.min(1, docs.length / 3) * 0.4;
    const opsScore =
      (subcontracts > 0 ? 0.1 : 0) +
      (supplies > 0 ? 0.1 : 0) +
      (hse > 0 ? 0.1 : 0) +
      (schedule > 0 ? 0.1 : 0);
    const observedRatio = docs.length > 0 ? observed / docs.length : 0;
    const cleanScore = docs.length > 0 ? Math.max(0, 1 - observedRatio) * 0.2 : 0;
    const coverageScore = clampScore(docsScore + opsScore + cleanScore);

    const riskLevel = computeRiskLevel({ findingsOpen, docsTotal: docs.length, observedRatio });

    const lastActivityAt = pickLatestActivity({
      project,
      docs,
      subcontracts: inputs.subcontracts.filter((s) => s.projectId === project.id),
      supplies: inputs.supplies.filter((s) => s.projectId === project.id),
      hse: inputs.hse.filter((h) => h.projectId === project.id),
      schedule: inputs.schedule.filter((s) => s.projectId === project.id),
      reports: inputs.reports.filter((r) => r.projectId === project.id),
    });

    result.push({
      projectId: project.id,
      documentsTotal: docs.length,
      documentsIndexed: indexed,
      documentsObserved: observed,
      subcontractsCount: subcontracts,
      suppliesCount: supplies,
      hseRecordsCount: hse,
      scheduleTasksCount: schedule,
      findingsOpen,
      reportsCount: reports,
      coverageScore,
      riskLevel,
      lastActivityAt,
      metadata: {
        projectName: project.name,
        projectStatus: project.status,
      },
    });
  }
  result.sort((a, b) => b.coverageScore - a.coverageScore);
  return result;
}

function computeRiskLevel(args: { findingsOpen: number; docsTotal: number; observedRatio: number }): ProfileRiskLevel {
  if (args.findingsOpen >= 5 || (args.docsTotal > 0 && args.observedRatio > 0.5)) return "critico";
  if (args.findingsOpen >= 2 || args.observedRatio > 0.25) return "alto";
  if (args.findingsOpen >= 1 || args.docsTotal === 0) return "medio";
  return "bajo";
}

function pickLatestActivity(args: {
  project: ProfileProjectInput;
  docs: ProfileDocumentInput[];
  subcontracts: ProfileSubcontractInput[];
  supplies: ProfileSupplyInput[];
  hse: ProfileHseInput[];
  schedule: ProfileScheduleInput[];
  reports: ProfileReportInput[];
}): string | null {
  const candidates: Array<string | null | undefined> = [
    args.project.updatedAt,
    ...args.docs.map((d) => d.updatedAt),
    ...args.subcontracts.map((s) => s.updatedAt),
    ...args.supplies.map((s) => s.updatedAt),
    ...args.hse.map((h) => h.updatedAt),
    ...args.schedule.map((s) => s.updatedAt),
    ...args.reports.map((r) => r.updatedAt),
  ];
  let latest: string | null = null;
  for (const candidate of candidates) {
    latest = pickMaxTimestamp(latest, candidate ?? null);
  }
  return latest;
}

function buildSummaryText(args: {
  projectsCount: number;
  topSuppliers: string[];
  topSubcontractors: string[];
  topTrades: string[];
  dominantCurrency: string | null;
  namingHints: string[];
  riskyProjects: number;
}): string {
  const parts: string[] = [];
  parts.push(`${args.projectsCount} obra(s) en el perfil`);
  if (args.dominantCurrency) parts.push(`moneda dominante ${args.dominantCurrency}`);
  if (args.namingHints.length > 0) parts.push(`nombres frecuentes con "${args.namingHints.join(", ")}"`);
  if (args.topSubcontractors.length > 0) parts.push(`subcontratistas habituales: ${args.topSubcontractors.join(", ")}`);
  if (args.topSuppliers.length > 0) parts.push(`proveedores habituales: ${args.topSuppliers.join(", ")}`);
  if (args.topTrades.length > 0) parts.push(`rubros recurrentes: ${args.topTrades.join(", ")}`);
  if (args.riskyProjects > 0) parts.push(`${args.riskyProjects} obra(s) con riesgo alto o crítico`);
  return parts.join(". ");
}

function canonicalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.'`"·]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeAliases(existing: string[], raw: string, canonical: string): string[] {
  const set = new Set(existing);
  const cleaned = raw.trim();
  if (cleaned && canonicalize(cleaned) !== canonical) {
    set.add(cleaned);
  } else if (cleaned && cleaned !== canonical) {
    set.add(cleaned);
  }
  return Array.from(set).slice(0, 8);
}

function pickDisplayName(existing: string | undefined, candidate: string): string {
  const cleaned = candidate.trim();
  if (!existing) return cleaned;
  if (cleaned.length > existing.length) return cleaned;
  return existing;
}

function pickMaxTimestamp(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function roundConfidence(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}
