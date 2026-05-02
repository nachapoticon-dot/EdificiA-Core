"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { getInsForgeClient } from "@/lib/insforge/client";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastActiveAt: number;
}

interface ApiProject {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const ACTIVE_KEY = "edificia_active_project";
const ACTIVE_EVENT = "edificia-active-project-updated";

function toProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    createdAt: new Date(p.created_at).getTime(),
    lastActiveAt: new Date(p.updated_at).getTime(),
  };
}

function getAuthHeaders(): Record<string, string> {
  const h = getInsForgeClient().getHttpClient().getHeaders() as Record<string, string>;
  return h["Authorization"] ? { Authorization: h["Authorization"] } : {};
}

function persistActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event(ACTIVE_EVENT));
}

export function useProjects() {
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeIdLoaded, setActiveIdLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveProjectId(localStorage.getItem(ACTIVE_KEY));
    setActiveIdLoaded(true);
    const handler = () => setActiveProjectId(localStorage.getItem(ACTIVE_KEY));
    window.addEventListener(ACTIVE_EVENT, handler);
    return () => window.removeEventListener(ACTIVE_EVENT, handler);
  }, []);

  const { data: projects = [], isLoading: queryLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch("/api/projects", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = (await res.json()) as { projects: ApiProject[] };
      return (json.projects ?? []).map(toProject);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<Project> => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const json = (await res.json()) as { project: ApiProject };
      return toProject(json.project);
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      persistActiveId(newProject.id);
    },
  });

  const createProject = useCallback(
    (name: string) => { createMutation.mutate(name); },
    [createMutation],
  );

  const activateProject = useCallback(
    (project: Project) => {
      persistActiveId(project.id);
      fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: getAuthHeaders() })
        .then(() => queryClient.invalidateQueries({ queryKey: ["projects"] }))
        .catch(() => null);
    },
    [queryClient],
  );

  const clearActiveProject = useCallback(() => {
    persistActiveId(null);
  }, []);

  const isLoading = !activeIdLoaded || queryLoading;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return {
    projects,
    activeProject,
    createProject,
    activateProject,
    clearActiveProject,
    isLoading,
    isCreating: createMutation.isPending,
  };
}
