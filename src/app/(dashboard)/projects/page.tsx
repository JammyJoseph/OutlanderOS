"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Project = {
  id: number;
  name: string;
  client: string;
  status: "active" | "on-hold" | "completed";
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");

  function addProject() {
    if (!newName.trim()) return;
    setProjects((prev) => [
      ...prev,
      { id: Date.now(), name: newName, client: newClient, status: "active" },
    ]);
    setNewName("");
    setNewClient("");
    setIsOpen(false);
  }

  if (projects.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to track campaigns, shoots, and client work."
            actionLabel="Create First Project"
            onAction={() => setIsOpen(true)}
          />
        </div>
        <AddProjectDialog
          open={isOpen}
          onOpenChange={setIsOpen}
          name={newName}
          client={newClient}
          onNameChange={setNewName}
          onClientChange={setNewClient}
          onAdd={addProject}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Projects</h1>
        <Button
          size="sm"
          onClick={() => setIsOpen(true)}
          className="bg-[#D4A853] text-zinc-900 hover:bg-[#C49843]"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">{p.name}</p>
                {p.client && <p className="mt-0.5 text-xs text-zinc-500">{p.client}</p>}
              </div>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <AddProjectDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        name={newName}
        client={newClient}
        onNameChange={setNewName}
        onClientChange={setNewClient}
        onAdd={addProject}
      />
    </div>
  );
}

function AddProjectDialog({
  open,
  onOpenChange,
  name,
  client,
  onNameChange,
  onClientChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  client: string;
  onNameChange: (v: string) => void;
  onClientChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Project name</label>
            <Input
              placeholder="e.g. Issue 03 Editorial"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="border-zinc-700 bg-zinc-800 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Client (optional)</label>
            <Input
              placeholder="e.g. Nike UK"
              value={client}
              onChange={(e) => onClientChange(e.target.value)}
              className="border-zinc-700 bg-zinc-800 text-sm text-zinc-200"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <Button
            onClick={onAdd}
            size="sm"
            className="bg-[#D4A853] text-zinc-900 hover:bg-[#C49843]"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
