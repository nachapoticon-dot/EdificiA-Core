"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useProjects, type Project } from "@/hooks/useProjects";

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  createProject: (name: string) => Promise<import("@/hooks/useProjects").Project>;
  activateProject: (project: Project) => void;
  clearActiveProject: () => void;
  isLoading: boolean;
  isCreating: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const value = useProjects();
  return <ProjectContext value={value}>{children}</ProjectContext>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be inside ProjectProvider");
  return ctx;
}
