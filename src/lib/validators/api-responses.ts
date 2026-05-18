import { z } from "zod";
import { budgetItemSchema } from "@/lib/math-engine/validators";

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

const piiTypeSchema = z.enum(["cuit", "dni", "cbu", "email", "phone"]);

export const piiScanResultSchema = z.object({
  hasMatches: z.boolean(),
  totalCount: z.number().int().nonnegative(),
  matches: z.array(z.object({
    type: piiTypeSchema,
    count: z.number().int().nonnegative(),
    samples: z.array(z.string()),
  })),
});

const uploadedMetaSchema = z.object({
  fileId: z.string().nullable(),
  cacheId: z.string().nullable(),
  piiScan: piiScanResultSchema,
  contextScan: z.object({
    hasFindings: z.boolean(),
    totalCount: z.number().int().nonnegative(),
    findings: z.array(z.object({
      type: z.enum(["budget_total_mismatch", "document_amount_mismatch", "plan_area_mismatch"]),
      severity: z.enum(["warning", "error"]),
      message: z.string(),
      relatedFileId: z.string().nullable(),
      relatedFileName: z.string(),
      evidence: z.object({
        currentValue: z.number(),
        relatedValue: z.number(),
        deltaPct: z.number(),
      }),
    })),
  }),
});

const baseProcessedFileSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
});

const excelProcessedFileSchema = baseProcessedFileSchema.extend({
  type: z.literal("excel"),
  sheetName: z.string(),
  items: z.array(budgetItemSchema),
  detectedTotal: z.number().nullable(),
  itemCount: z.number().int().nonnegative(),
});

const pdfProcessedFileSchema = baseProcessedFileSchema.extend({
  type: z.literal("pdf"),
  pageCount: z.number().int().nonnegative(),
  text: z.string(),
  isScanned: z.boolean(),
  pageImages: z.array(z.string()),
});

const dxfGeometrySummarySchema = z.object({
  totalAreaM2: z.number().nonnegative(),
  totalLinearM: z.number().nonnegative(),
  areasByLayer: z.array(z.object({
    layer: z.string(),
    areaM2: z.number().nonnegative(),
  })),
  linearByLayer: z.array(z.object({
    layer: z.string(),
    totalM: z.number().nonnegative(),
  })),
  unitFactor: z.number().positive(),
});

const dxfProcessedFileSchema = baseProcessedFileSchema.extend({
  type: z.literal("dxf"),
  layers: z.array(z.string()),
  textAnnotations: z.array(z.string()),
  dimensions: z.array(z.object({
    text: z.string(),
    value: z.number().nullable(),
    layer: z.string(),
  })),
  blockNames: z.array(z.string()),
  entitySummary: z.record(z.number().int().nonnegative()),
  geometrySummary: dxfGeometrySummarySchema,
});

const imageProcessedFileSchema = baseProcessedFileSchema.extend({
  type: z.literal("image"),
  mimeType: z.string(),
  dataUrl: z.string(),
  widthHint: z.number().int().positive().optional(),
  heightHint: z.number().int().positive().optional(),
});

const docxProcessedFileSchema = baseProcessedFileSchema.extend({
  type: z.literal("docx"),
  text: z.string(),
  wordCount: z.number().int().nonnegative(),
});

export const processedFileResponseSchema = z.discriminatedUnion("type", [
  excelProcessedFileSchema,
  pdfProcessedFileSchema,
  dxfProcessedFileSchema,
  imageProcessedFileSchema,
  docxProcessedFileSchema,
]);

export const uploadResponseSchema = processedFileResponseSchema.and(uploadedMetaSchema);

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

const proactivityFindingSchema = z.object({
  id: z.string(),
  type: z.enum([
    "schedule.overdue",
    "schedule.upcoming",
    "schedule.blocked",
    "hse.non_compliant",
    "hse.expiring",
    "supply.delayed",
    "supply.required_soon",
    "financial.overrun",
    "project.stale_docs",
  ]),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  detail: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const dailyProjectScanResponseSchema = z.object({
  scannedAt: z.string(),
  scannedProjects: z.number().int().nonnegative(),
  findingsCount: z.number().int().nonnegative(),
  bySeverity: z.object({
    info: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
  }),
  projects: z.array(z.object({
    organizationId: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    findings: z.array(proactivityFindingSchema),
  })),
});

export type DailyProjectScanResponse = z.infer<typeof dailyProjectScanResponseSchema>;

export const proactivityFindingsResponseSchema = z.object({
  hasData: z.boolean(),
  latestScanAt: z.string().nullable(),
  projectsScanned: z.number().int().nonnegative(),
  findingsCount: z.number().int().nonnegative(),
  bySeverity: z.object({
    info: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
  }),
  projects: z.array(z.object({
    projectId: z.string(),
    projectName: z.string(),
    scannedAt: z.string(),
    findingsCount: z.number().int().nonnegative(),
    bySeverity: z.object({
      info: z.number().int().nonnegative(),
      warning: z.number().int().nonnegative(),
      critical: z.number().int().nonnegative(),
    }),
    findings: z.array(proactivityFindingSchema),
  })),
});

export type ProactivityFindingsResponse = z.infer<typeof proactivityFindingsResponseSchema>;

export const scheduleImportResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.enum(["append", "replace"]),
  totalRows: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export type ScheduleImportResponse = z.infer<typeof scheduleImportResponseSchema>;

export const dailyBriefResponseSchema = z.object({
  found: z.boolean(),
  projectId: z.string(),
  projectName: z.string(),
  generatedAt: z.string(),
  schedule: z.object({
    overdue: z.number().int().nonnegative(),
    dueToday: z.number().int().nonnegative(),
    dueNext7Days: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    items: z.array(z.object({
      id: z.string(),
      code: z.string().nullable(),
      name: z.string(),
      dueDate: z.string().nullable(),
      status: z.string(),
      progressPct: z.number(),
      bucket: z.enum(["overdue", "due_today", "due_soon", "blocked"]),
    })),
  }),
  hse: z.object({
    expiringSoon: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
    items: z.array(z.object({
      id: z.string(),
      subject: z.string(),
      recordType: z.string(),
      expiresAt: z.string().nullable(),
      status: z.string(),
      daysToExpire: z.number().int().nullable(),
    })),
  }),
  supplies: z.object({
    delayed: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    items: z.array(z.object({
      id: z.string(),
      itemName: z.string(),
      requiredBy: z.string().nullable(),
      status: z.string(),
      receivedPct: z.number().int().nullable(),
    })),
  }),
  financial: z.object({
    latestSnapshotDate: z.string().nullable(),
    plannedAmount: z.number().nullable(),
    actualAmount: z.number().nullable(),
    committedAmount: z.number().nullable(),
    deviationPct: z.number().nullable(),
    currency: z.string(),
  }),
  alerts: z.object({
    critical: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
    topTitles: z.array(z.string()),
  }),
  weather: z.object({
    location: z.string(),
    date: z.string(),
    riskLevel: z.string(),
    precipitationMm: z.number().nullable(),
    windKph: z.number().nullable(),
    tempMinC: z.number().nullable(),
    tempMaxC: z.number().nullable(),
  }).nullable(),
  summary: z.string(),
});

export type DailyBriefResponse = z.infer<typeof dailyBriefResponseSchema>;

export const orgMemberResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  orgId: z.string(),
  role: z.enum(["admin", "engineer", "viewer"]),
  orgName: z.string(),
  branding: z.object({
    primaryColor: z.string(),
    logoUrl: z.string().nullable(),
    agentName: z.string(),
  }),
  stats: z.object({
    activeProjects: z.number().int().nonnegative(),
    memberCount: z.number().int().nonnegative(),
  }),
});

export type OrgMemberResponse = z.infer<typeof orgMemberResponseSchema>;

const apiProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const projectsResponseSchema = z.object({
  projects: z.array(apiProjectSchema),
});

export const projectResponseSchema = z.object({
  project: apiProjectSchema,
});

export type ApiProjectResponse = z.infer<typeof apiProjectSchema>;

export const sessionEntryResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileType: z.enum(["excel", "pdf", "dxf", "docx", "image"]).optional(),
  startedAt: z.number().int(),
  projectId: z.string().optional(),
});

export const sessionsResponseSchema = z.object({
  sessions: z.array(sessionEntryResponseSchema),
});

export type SessionEntryResponse = z.infer<typeof sessionEntryResponseSchema>;

export const workCaseVerdictSchema = z.enum([
  "approved",
  "flagged",
  "inconclusive",
  "rejected",
  "superseded",
]);

export const workCaseEntryResponseSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "budget_audit",
    "document_audit",
    "schedule_review",
    "financial_review",
    "hse_review",
    "supplies_review",
    "subcontract_review",
    "daily_brief",
    "operations_update",
    "communication",
    "general",
    "legacy_conversation",
  ]),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed", "archived"]),
  title: z.string(),
  summary: z.string().nullable(),
  verdict: workCaseVerdictSchema.nullable(),
  closedByUserId: z.string().nullable(),
  closedAt: z.string().nullable(),
  projectId: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  chatSessionId: z.string().nullable(),
  chatSessionTitle: z.string().nullable(),
  chatSessionFileType: z.enum(["excel", "pdf", "dxf", "docx", "image"]).nullable(),
  chatSessionStartedAt: z.number().int().nullable(),
});

export const workCasesResponseSchema = z.object({
  workCases: z.array(workCaseEntryResponseSchema),
});

export const workCaseEventResponseSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  summary: z.string().nullable(),
  payload: z.record(z.unknown()),
  actorUserId: z.string().nullable(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
});

export const workCaseEvidenceResponseSchema = z.object({
  id: z.string(),
  evidenceType: z.enum([
    "file",
    "chunk",
    "relation",
    "audit_event",
    "tool_run",
    "finding",
    "message",
    "schedule_task",
    "hse_record",
    "supply_item",
    "financial_snapshot",
    "subcontract",
    "document_report",
    "external",
  ]),
  entityType: z.string(),
  entityId: z.string().nullable(),
  label: z.string().nullable(),
  confidence: z.number().nullable(),
  metadata: z.record(z.unknown()),
  projectId: z.string().nullable(),
  createdAt: z.string(),
});

export const documentReportVerdictSchema = z.enum([
  "consistent",
  "inconsistent",
  "needs_review",
  "unsupported",
]);

export const documentReportEntrySchema = z.object({
  id: z.string(),
  fileId: z.string().nullable(),
  fileName: z.string().nullable(),
  reportType: z.enum(["upload_scan", "agent_audit", "manual_review"]),
  status: z.enum(["ready", "needs_review", "superseded", "failed"]),
  source: z.enum(["system", "agent", "user"]),
  documentType: z.string(),
  verdict: documentReportVerdictSchema,
  confidence: z.number().nullable(),
  summary: z.string().nullable(),
  classification: z.record(z.unknown()),
  extraction: z.record(z.unknown()),
  risks: z.array(z.record(z.unknown())),
  findings: z.array(z.record(z.unknown())),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workCaseDetailResponseSchema = z.object({
  workCase: workCaseEntryResponseSchema,
  events: z.array(workCaseEventResponseSchema),
  evidence: z.array(workCaseEvidenceResponseSchema),
  documentReports: z.array(documentReportEntrySchema),
});

export type WorkCaseEntryResponse = z.infer<typeof workCaseEntryResponseSchema>;
export type WorkCaseVerdict = z.infer<typeof workCaseVerdictSchema>;
export type WorkCasesResponse = z.infer<typeof workCasesResponseSchema>;
export type WorkCaseEventResponse = z.infer<typeof workCaseEventResponseSchema>;
export type WorkCaseEvidenceResponse = z.infer<typeof workCaseEvidenceResponseSchema>;
export type WorkCaseDetailResponse = z.infer<typeof workCaseDetailResponseSchema>;
export type DocumentReportEntry = z.infer<typeof documentReportEntrySchema>;

export const orgOptionSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  role: z.enum(["admin", "engineer", "viewer"]),
});

export const orgsResponseSchema = z.object({
  orgs: z.array(orgOptionSchema),
});

export type OrgOptionResponse = z.infer<typeof orgOptionSchema>;

const documentFileSchema = z.object({
  id: z.string(),
  file_name: z.string(),
  file_type: z.string(),
  file_size_bytes: z.number().int().nonnegative(),
  processing_status: z.string(),
  created_at: z.string(),
  chunkCount: z.number().int().nonnegative(),
  project_id: z.string().nullable().optional(),
});

export const documentsResponseSchema = z.object({
  files: z.array(documentFileSchema),
});

const projectFileSchema = z.object({
  id: z.string(),
  file_name: z.string(),
  file_type: z.string(),
  file_size_bytes: z.number().int().nonnegative().nullable(),
  created_at: z.string(),
});

export const projectFilesResponseSchema = z.object({
  files: z.array(projectFileSchema),
});

const projectStatusSchema = z.enum(["en_obra", "planificacion", "finalizado", "pausado"]);

const projectDetailsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  code: z.string().nullable(),
  location: z.string().nullable(),
  contract_amount: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const storageStatsSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  quotaBytes: z.number().int().positive(),
  pct: z.number().int().min(0).max(100),
});

export const projectDetailsResponseSchema = z.object({
  project: projectDetailsSchema,
  storage: storageStatsSchema,
});

const priceIndexSourceSchema = z.enum(["CAC", "INDEC", "company_list", "company_learned"]);

export const priceIndexRowSchema = z.object({
  id: z.string(),
  organization_id: z.string().nullable(),
  source: priceIndexSourceSchema,
  category: z.string(),
  subcategory: z.string().nullable(),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  value_min: z.number().nullable(),
  value_max: z.number().nullable(),
  value_avg: z.number(),
  currency: z.string(),
  period_month: z.number().int().min(1).max(12).nullable(),
  period_year: z.number().int(),
  published_at: z.string().nullable(),
  uploaded_by: z.string().nullable(),
  source_file: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const priceIndicesResponseSchema = z.object({
  indices: z.array(priceIndexRowSchema),
});

export const insertedCountResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
});

const parsedPriceRowSchema = z.object({
  category: z.string(),
  subcategory: z.string().nullable(),
  description: z.string(),
  unit: z.string().nullable(),
  value_min: z.number().nullable(),
  value_max: z.number().nullable(),
  value_avg: z.number(),
});

export const priceIndexUploadPreviewResponseSchema = z.object({
  preview: z.array(parsedPriceRowSchema),
  total: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  period_year: z.number().int(),
  period_month: z.number().int().min(1).max(12),
});

export const priceIndexUploadConfirmResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  period_year: z.number().int(),
  period_month: z.number().int().min(1).max(12),
});

export const orgSettingsResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  primary_color: z.string().nullable(),
  logo_url: z.string().nullable(),
  agent_name: z.string().nullable(),
});

const roleSchema = z.enum(["admin", "engineer", "viewer"]);

const adminMemberSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().email().nullable(),
  role: roleSchema,
  created_at: z.string(),
});

const adminInvitationSchema = z.object({
  id: z.string(),
  invited_email: z.string().email(),
  role: roleSchema,
  status: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
  token: z.string(),
});

export const adminMembersResponseSchema = z.object({
  members: z.array(adminMemberSchema),
  invitations: z.array(adminInvitationSchema),
});

export const adminInvitationCreatedResponseSchema = z.object({
  invitation: z.object({
    id: z.string(),
    token: z.string(),
  }),
  emailSent: z.boolean(),
});

const patternRowSchema = z.object({
  document_type: z.string(),
  pattern_key: z.string(),
  pattern_value: z.unknown(),
  sample_count: z.number().int().nonnegative(),
  updated_at: z.string(),
});

export const adminPatternsResponseSchema = z.object({
  grouped: z.record(z.object({
    patterns: z.array(patternRowSchema),
    maxSampleCount: z.number().int().nonnegative(),
  })),
  totalPatterns: z.number().int().nonnegative(),
});

export type AdminMembersResponse = z.infer<typeof adminMembersResponseSchema>;
export type AdminPatternsResponse = z.infer<typeof adminPatternsResponseSchema>;
export type OrgSettingsResponse = z.infer<typeof orgSettingsResponseSchema>;

const founderInvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  company_name: z.string(),
  organization_id: z.string().nullable().optional(),
  status: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  expires_at: z.string(),
  invite_token: z.string().nullable().optional(),
});

export const superAdminFoundersResponseSchema = z.object({
  invitations: z.array(founderInvitationSchema),
});

export const superAdminFounderResponseSchema = z.object({
  invitation: founderInvitationSchema,
});

const companyStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  disabled: z.boolean(),
  subscriptionStatus: z.string(),
  members: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  storage: storageStatsSchema,
});

export const superAdminCompaniesResponseSchema = z.object({
  companies: z.array(companyStatsSchema),
});

export const superAdminMemberInviteResponseSchema = z.object({
  ok: z.literal(true),
  token: z.string(),
});

export const superAdminResetResponseSchema = z.object({
  ok: z.literal(true),
  log: z.array(z.string()),
});

export type SuperAdminFounderInvitation = z.infer<typeof founderInvitationSchema>;
export type SuperAdminCompanyStats = z.infer<typeof companyStatsSchema>;

export const documentSaveResponseSchema = z.object({
  success: z.literal(true),
  path: z.string(),
});

export const registerInvitationCheckResponseSchema = z.discriminatedUnion("authorized", [
  z.object({
    authorized: z.literal(false),
  }),
  z.object({
    authorized: z.literal(true),
    organizationName: z.string(),
    role: roleSchema,
    isFounder: z.boolean().optional(),
  }),
]);
