import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

export interface Project {
  id: number;
  name: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  viewingProject: Project | null;
  setViewingProject: (project: Project) => void;
  createNewProject: (name: string) => Promise<boolean>;
  deleteProject: (projectId: number) => Promise<boolean>;
  loading: boolean;
  isViewingOldProject: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Failed to load projects:", error);
      setLoading(false);
      return;
    }

    const projectList = data || [];
    setProjects(projectList);

    const active = projectList.find((p: Project) => p.is_active);
    if (active) {
      setActiveProject(active);
      // Default to viewing the active project
      if (!viewingProject) {
        setViewingProject(active);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createNewProject = useCallback(async (name: string): Promise<boolean> => {
    try {
      // End the current active project
      if (activeProject) {
        const { error: endErr } = await supabase
          .from("projects")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("id", activeProject.id);

        if (endErr) {
          console.error("Failed to end current project:", endErr);
          return false;
        }
      }

      // Create the new project
      const { data, error: createErr } = await supabase
        .from("projects")
        .insert([{ name, is_active: true }])
        .select()
        .single();

      if (createErr || !data) {
        console.error("Failed to create new project:", createErr);
        return false;
      }

      // Refresh project list and switch to new project
      setActiveProject(data);
      setViewingProject(data);
      await loadProjects();
      return true;
    } catch (err) {
      console.error("Error creating project:", err);
      return false;
    }
  }, [activeProject, loadProjects]);

  const deleteProject = useCallback(async (projectId: number): Promise<boolean> => {
    try {
      // Don't allow deleting the active project
      if (activeProject && activeProject.id === projectId) return false;

      // Delete related data first, then the project
      const { error: e1 } = await supabase.from("measurements").delete().eq("project_id", projectId);
      if (e1) console.error("Failed to delete measurements:", e1);

      const { error: e2 } = await supabase.from("alert_history").delete().eq("project_id", projectId);
      if (e2) console.error("Failed to delete alert_history:", e2);

      const { error: e3 } = await supabase.from("dosing_history").delete().eq("project_id", projectId);
      if (e3) console.error("Failed to delete dosing_history:", e3);

      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) {
        console.error("Failed to delete project:", error);
        return false;
      }

      console.log(`Deleted project ${projectId} and all related data`);

      // If we were viewing the deleted project, switch to active
      if (viewingProject && viewingProject.id === projectId && activeProject) {
        setViewingProject(activeProject);
      }

      await loadProjects();
      return true;
    } catch (err) {
      console.error("Error deleting project:", err);
      return false;
    }
  }, [activeProject, viewingProject, loadProjects]);

  const isViewingOldProject = !!(
    viewingProject &&
    activeProject &&
    viewingProject.id !== activeProject.id
  );

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        viewingProject,
        setViewingProject,
        createNewProject,
        deleteProject,
        loading,
        isViewingOldProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
