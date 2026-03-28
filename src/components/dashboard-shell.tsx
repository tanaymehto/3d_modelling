"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Loader2, Minus, PanelLeft, Plus, Send } from "lucide-react";
import { GLBViewer } from "@/components/glb-viewer";

function ImageCard({ src, onView3D, onViewImage, label, disabled }: { src: string; onView3D: () => void; onViewImage: () => void; label?: string; disabled?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      if (imgRef.current.naturalWidth === 0) setErrored(true);
      else setLoaded(true);
    }
  }, [src]);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[24px] border border-white/5 bg-[#18181b] p-3 h-[380px] transition hover:border-white/10 shadow-lg cursor-pointer" onClick={(e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      onViewImage();
    }}>
      <div className="absolute left-6 top-6 z-20 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
        <div className="flex items-center rounded-full bg-black/40 p-1 backdrop-blur shadow-sm">
          <button className="rounded-full p-1.5 text-white/60 hover:bg-white/20 hover:text-white transition"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>
          <button className="rounded-full p-1.5 text-white/60 hover:bg-white/20 hover:text-white transition"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg></button>
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); setIsChecked(!isChecked); }} className={`absolute right-6 top-6 z-20 flex h-6 w-6 items-center justify-center rounded border opacity-0 transition group-hover:opacity-100 ${isChecked ? "border-[#4a3dff] bg-[#4a3dff] text-white opacity-100" : "border-white/20 bg-black/20 hover:bg-white/20"}`}>
        {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
      </button>

      <div className="relative flex-1 rounded-[16px] bg-[#222226] mb-3 overflow-hidden">
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/30">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-[11px] font-medium tracking-wide">Loading image…</span>
          </div>
        )}
        {errored ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400/50">Image failed to load</div>
        ) : (
          <img ref={imgRef} src={src} alt="Generated" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`} onLoad={() => setLoaded(true)} onError={() => setErrored(true)} />
        )}

        {/* Prominent Overlay Actions */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 transition-opacity bg-black/50 group-hover:opacity-100 pointer-events-none z-10">
          <button onClick={(e) => { e.stopPropagation(); onView3D(); }} disabled={disabled} className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-emerald-400 transition pointer-events-auto disabled:opacity-50 hover:scale-105">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            Convert to 3D
          </button>
          <button onClick={(e) => { e.stopPropagation(); onViewImage(); }} className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-6 py-2 text-sm font-medium text-white backdrop-blur-md hover:bg-white/20 transition pointer-events-auto hover:scale-105">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
            View Full Image
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1 pb-1">
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-[#25252b] px-3 py-1.5 text-[11px] font-medium text-white/50">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          {label ?? "Mu..."} <span className="text-white/80">10</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-[#25252b] px-3 py-1.5 text-[11px] font-medium text-white/50">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          Ge... <span className="text-white/80">40</span>
        </div>
      </div>
    </article>
  );
}

type Project = {
  id: string;
  name: string;
};

type Workspace = {
  id: string;
  name: string;
  projects: Project[];
};

type DashboardShellProps = {
  userName: string;
  imageCredits: number;
  modelCredits: number;
  workspaces: Workspace[];
  initialMessages?: Message[];
};

type Message = {
  id: string;
  prompt: string;
  images?: string[];
  modelUrl?: string;
  previewUrl?: string;
  cadDownloads?: {
    glb?: string;
    obj?: string;
    fbx?: string;
    stl?: string;
    dwg?: string;
  };
  loading?: boolean;
  error?: string;
  isMultiView?: boolean;
};

export function DashboardShell({
  userName,
  imageCredits,
  modelCredits,
  workspaces,
  initialMessages = [],
}: DashboardShellProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>(
    workspaces[0]?.projects[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"design" | "multiview" | "zboard">("design");
  const [style, setStyle] = useState("Default");
  const [variations, setVariations] = useState(3);
  const [credits, setCredits] = useState({ image: imageCredits, model: modelCredits });
  const [toast, setToast] = useState<string | null>(null);
  const [viewingGlb, setViewingGlb] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ url: string; name: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autodeskConnected, setAutodeskConnected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/autodesk/status", { credentials: "include" })
      .then((response) => response.ok ? response.json() : { connected: false })
      .then((data) => {
        if (active) setAutodeskConnected(Boolean(data?.connected));
      })
      .catch(() => {
        if (active) setAutodeskConnected(false);
      });

    // Handle auto-opening AutoCAD if returning from auth
    if (typeof window !== "undefined" && window.location.search.includes("autodesk=connected")) {
      const pendingStr = sessionStorage.getItem("pendingAutoCAD");
      if (pendingStr) {
        sessionStorage.removeItem("pendingAutoCAD");
        try {
          const pending = JSON.parse(pendingStr);
          if (pending?.url && pending?.extension) {
            // Need setTimeout to let react mount fully before firing async state
            setTimeout(() => {
              void handleOpenInAutoCAD({ [pending.extension]: pending.url }, pending.url);
            }, 100);

            // Cleanup URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (e) { }
      }
    }

    return () => {
      active = false;
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function triggerBrowserDownload(url: string, suggestedName: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleOpenInAutoCAD(cad: Message["cadDownloads"], fallbackModelUrl: string) {
    const preferred = cad?.stl || cad?.obj || cad?.fbx || cad?.glb || fallbackModelUrl;
    const extension = cad?.stl ? "stl" : cad?.obj ? "obj" : cad?.fbx ? "fbx" : "glb";

    if (!autodeskConnected) {
      sessionStorage.setItem("pendingAutoCAD", JSON.stringify({ url: preferred, extension }));
      window.location.href = "/api/autodesk/login";
      return;
    }

    showToast("Pushing model to Autodesk Drive... Please wait.");

    // Open tab immediately to bypass popup blockers, then redirect it when done
    const newTab = window.open("about:blank", "_blank", "noopener,noreferrer");

    try {
      const res = await fetch("/api/autodesk/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: preferred, extension })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.warn("Upload failed:", data.error);
        showToast(`Failed to push automatically. Initializing local download...`);
        triggerBrowserDownload(preferred, `zennah-export.${extension}`);
        if (newTab) newTab.location.href = "https://drive.autodesk.com/";
        return;
      }

      showToast(`Pushed ${data.filename} to Autodesk!`);
      if (newTab) newTab.location.href = "https://drive.autodesk.com/";
    } catch (e: any) {
      console.error(e);
      showToast(`Failed to push automatically. Downloading locally instead.`);
      triggerBrowserDownload(preferred, `zennah-export.${extension}`);
      if (newTab) newTab.location.href = "https://drive.autodesk.com/";
    }
  }

  const allProjects = useMemo(() => workspaces.flatMap((w) => w.projects), [workspaces]);

  async function handleGenerateImage() {
    if (!prompt.trim() || !selectedProject || busy) return;
    setBusy(true);
    const currentPrompt = prompt.trim();
    const attachedForRequest = attachedImage;
    setPrompt("");

    // Add a pending placeholder immediately
    const pendingId = crypto.randomUUID();
    setMessages((prev) => [{ id: pendingId, prompt: currentPrompt, loading: true }, ...prev]);

    const res = await fetch("/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProject,
        prompt: currentPrompt,
        mode,
        referenceImageUrl: attachedForRequest?.url,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
              id: pendingId,
              prompt: attachedForRequest
                ? `${currentPrompt} (enhanced from attached sketch)`
                : currentPrompt,
              images: data.images,
              loading: false,
              isMultiView: mode === "multiview",
            }
            : m,
        ),
      );
      setCredits((c) => ({ ...c, image: c.image - 1 }));
      if (attachedForRequest) {
        setAttachedImage(null);
      }
    } else {
      const errMsg = data?.error ?? "Generation failed";
      showToast(errMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, loading: false, error: errMsg } : m,
        ),
      );
    }
    setBusy(false);
  }

  async function handleGenerate3D(imageUrl: string, sourcePrompt?: string) {
    if (!selectedProject || busy) return;

    setBusy(true);
    const pendingId = crypto.randomUUID();
    setMessages((prev) => [{ id: pendingId, prompt: "Generating 3D model…", loading: true }, ...prev]);

    try {
      const res = await fetch("/api/generate/3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject, imageUrl, prompt: sourcePrompt }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                id: pendingId,
                prompt: "3D generation",
                modelUrl: data.modelUrl,
                previewUrl: data.previewUrl ?? undefined,
                cadDownloads: data.cadDownloads ?? undefined,
                loading: false,
              }
              : m,
          ),
        );
        setCredits((c) => ({ ...c, model: c.model - 1 }));
      } else {
        const errMsg = data?.error ?? "3D generation failed";
        showToast(errMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, loading: false, error: errMsg } : m,
          ),
        );
      }
    } catch {
      const errMsg = "3D generation failed";
      showToast(errMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, loading: false, error: errMsg } : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadSketch(file: File) {
    if (!selectedProject || busy) return;

    setBusy(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("projectId", selectedProject);

    try {
      const uploadRes = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.imageUrl) {
        showToast(uploadData?.error ?? "Sketch upload failed");
        return;
      }

      const uploadedImageUrl = String(uploadData.imageUrl);
      setAttachedImage({ url: uploadedImageUrl, name: file.name });
      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          prompt: `Attached sketch: ${file.name}`,
          images: [uploadedImageUrl],
        },
        ...prev,
      ]);

      showToast("Sketch attached! Use 'Direct to 3D' or type a prompt to enhance first.");
    } catch {
      showToast("Sketch upload failed");
    } finally {
      setBusy(false);
    }
  }

  const activeProjectName = workspaces.flatMap((w) => w.projects).find((p) => p.id === selectedProject)?.name ?? "Untitled";

  return (
    <div className="flex h-screen bg-[#111114] text-[#ededed]">
      {viewingGlb ? <GLBViewer url={viewingGlb} onClose={() => setViewingGlb(null)} /> : null}

      {/* Lightbox for large image view */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
          <img src={viewingImage} alt="Expanded view" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-6 right-6 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition" onClick={() => setViewingImage(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; void handleUploadSketch(file); }} />
      {toast ? <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#1e1e24] px-6 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md">{toast}</div> : null}

      <aside className={`${sidebarCollapsed ? "w-0 overflow-hidden border-r-0 p-0" : "w-64 border-r border-white/10 flex flex-col"} transition-all duration-200`}>
        {/* Top Logo */}
        <div className="flex items-center justify-between p-4 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#18181b] text-lg font-serif italic text-white/90">Z</div>
          <button type="button" className="text-white/40 hover:text-white/70" onClick={() => setSidebarCollapsed(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {/* Workspaces header */}
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/50">
            <span>Workspaces</span>
            <button className="rounded bg-white/5 p-1 text-white/70 hover:bg-white/10"><Plus size={12} /></button>
          </div>

          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <div className="grid grid-cols-2 gap-[2px] opacity-60"><div className="h-1.5 w-1.5 rounded-sm border border-current" /><div className="h-1.5 w-1.5 rounded-sm border border-current" /><div className="h-1.5 w-1.5 rounded-sm border border-current" /><div className="h-1.5 w-1.5 rounded-sm border border-current" /></div>
            All projects
          </button>

          {/* Workspaces List */}
          <div className="mt-4 space-y-4">
            {workspaces.map((workspace) => (
              <div key={workspace.id}>
                <button className="flex w-full items-center justify-between px-2 py-1 text-[13px] font-medium text-white/80 hover:text-white">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    {workspace.name}
                  </div>
                  <ChevronDown size={14} className="text-white/40" />
                </button>
                <div className="mt-2 space-y-1 border-l border-white/10 ml-3.5 pl-3">
                  {workspace.projects.map((project) => (
                    <button
                      key={project.id}
                      className={`w-full rounded-full px-4 py-1.5 text-left text-xs ${selectedProject === project.id ? "bg-white/10 text-white font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      onClick={() => setSelectedProject(project.id)}
                      type="button"
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="mt-6 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            Shared Designs
          </button>
        </div>

        {/* Bottom Account Section */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-2 text-[11px] font-medium text-white/40 px-2 uppercase tracking-wider">Account</div>
          <div className="space-y-0.5">
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              Profile
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              Billing
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Collaboration
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
              Settings
            </button>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg border-t border-white/5 pt-3 px-2 text-xs text-red-400/60 hover:bg-white/5 hover:text-red-400 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col relative w-full overflow-hidden">
        {/* Top Header */}
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/5 px-8">
          <button className="flex items-center gap-2 text-[13px] font-medium text-white/50 hover:text-white transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Projects
          </button>

          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-lg font-normal text-white">
            {activeProjectName}
            <button className="text-white/30 hover:text-white/70"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-[#18181b] p-1 pr-4 border border-white/10 shadow-sm">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"><Plus size={14} /></button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></button>
              <div className="text-xs font-medium text-white/60">0</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0ea5e9] text-sm font-semibold text-white shadow-sm ring-2 ring-[#111114]">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Scrollable Canvas area */}
        <div className="flex-1 overflow-y-auto pb-48">
          <div className="mx-auto max-w-6xl px-8 pt-8 pb-12">

            {/* Subheader */}
            {messages.length > 0 && (
              <>
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#18181b] px-3 py-1.5 text-[10px] font-bold tracking-wider text-white/60 uppercase border border-white/5">
                      {(messages.length * 3) + 20} Variations
                    </div>
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#18181b] border border-white/5 text-white/50 hover:text-white hover:bg-white/10 transition shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-white/40">Generated recently</span>
                    <div className="flex items-center gap-1 bg-[#18181b] rounded-lg border border-white/5 p-0.5 shadow-sm">
                      <button className="rounded px-2 py-1 text-white/70 bg-white/5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></button>
                      <button className="rounded px-2 py-1 text-white/30 hover:text-white/70 transition"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
                    </div>
                  </div>
                </div>

                {/* Timeline divider */}
                <div className="mb-8 flex items-center gap-4">
                  <div className="rounded-full bg-[#18181b] border border-white/5 px-4 py-1.5 flex items-center gap-2 text-[10px] font-bold tracking-wider text-white/50 uppercase shadow-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Today
                  </div>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>
              </>
            )}

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-24 pb-32 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[#18181b] to-black border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
                  <span className="text-4xl text-white/40 drop-shadow-lg scale-110">💎</span>
                </div>
                <h3 className="mb-3 text-2xl font-semibold text-white tracking-tight">Design smarter</h3>
                <p className="max-w-[400px] text-sm text-white/40 leading-relaxed shadow-sm">Upload a sketch or write a prompt below to generate high-fidelity concepts and ready-to-use 3D models.</p>

                <div className="mt-12 w-full max-w-2xl grid grid-cols-2 gap-4 text-left">
                  <button onClick={() => setPrompt("Ornate 18k gold necklace with emerald center stone")} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#18181b] p-6 transition hover:border-white/15 hover:bg-[#1c1c20] hover:scale-[1.02] shadow-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
                    <span className="mb-3 block text-2xl drop-shadow-md">✨</span>
                    <span className="block text-sm font-medium text-white/80 group-hover:text-white transition">Ornate 18k gold necklace with emerald center stone</span>
                  </button>
                  <button onClick={() => setPrompt("Minimalist platinum engagement ring with a round diamond")} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#18181b] p-6 transition hover:border-white/15 hover:bg-[#1c1c20] hover:scale-[1.02] shadow-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
                    <span className="mb-3 block text-2xl drop-shadow-md">💍</span>
                    <span className="block text-sm font-medium text-white/80 group-hover:text-white transition">Minimalist platinum engagement ring with a round diamond</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-12">
              {messages.map((msg) => (
                <section key={msg.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white/90">{msg.prompt}</p>
                    {msg.isMultiView ? (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">Multi-view</span>
                    ) : null}
                  </div>

                  {/* Loading skeleton */}
                  {msg.loading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
                        >
                          <div className="aspect-square w-full bg-white/8 relative overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            {i === 1 ? (
                              <div className="flex flex-col items-center gap-2 text-white/40">
                                <Loader2 size={28} className="animate-spin" />
                                <span className="text-xs">Generating…</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between p-2">
                            <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                            <div className="h-6 w-14 animate-pulse rounded-md bg-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Error card */}
                  {msg.error ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {msg.error}
                    </div>
                  ) : null}

                  {/* Real images */}
                  {!msg.loading && msg.images ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {msg.images.map((img, i) => (
                        <ImageCard
                          key={img}
                          src={img}
                          disabled={busy}
                          onView3D={() => handleGenerate3D(img, msg.prompt)}
                          onViewImage={() => setViewingImage(img)}
                          label={msg.isMultiView ? ["Front", "45° Side", "Top-down"][i] : "flux-1.1-pro"}
                        />
                      ))}
                    </div>
                  ) : null}

                  {!msg.loading && msg.modelUrl ? (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      {msg.previewUrl ? (
                        <video
                          src={msg.previewUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full rounded-t-xl"
                        />
                      ) : (
                        <div className="flex h-[380px] relative items-center justify-center bg-[#151518]">
                          <div className="absolute inset-0 z-0">
                            {/* Abstract stylish 3D background placeholder */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_0%,_transparent_60%)]" />
                            <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 opacity-40 animate-[spin_10s_linear_infinite]" />
                            <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 opacity-20 animate-[spin_7s_linear_infinite_reverse]" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingGlb(msg.modelUrl!)}
                            className="relative z-10 flex flex-col items-center gap-3 rounded-[32px] border border-white/10 bg-[#1e1e24]/80 px-10 py-6 hover:bg-[#25252b] transition shadow-2xl backdrop-blur-md hover:scale-105"
                          >
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18181b] shadow-inner text-emerald-400">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            </span>
                            <span className="text-[13px] font-semibold tracking-wide text-white">Open 3D Viewer</span>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3">
                        <span className="text-xs text-white/60">AI 3D Model · AutoCAD-ready exports</span>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingGlb(msg.modelUrl!)}
                            className="rounded-md bg-indigo-500/25 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/40"
                          >
                            Open 3D Viewer
                          </button>
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              const url = event.currentTarget.value;
                              if (!url) return;

                              const ext = event.currentTarget.selectedOptions[0]?.getAttribute("data-ext") || "glb";
                              triggerBrowserDownload(url, `zennah-export.${ext}`);
                              event.currentTarget.value = "";
                            }}
                            className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs text-white outline-none hover:bg-white/15"
                          >
                            <option value="" className="bg-[#111114]">Download format</option>
                            <option value={msg.cadDownloads?.glb || msg.modelUrl} data-ext="glb" className="bg-[#111114]">
                              Download GLB
                            </option>
                            {msg.cadDownloads?.obj ? (
                              <option value={msg.cadDownloads.obj} data-ext="obj" className="bg-[#111114]">
                                Download OBJ
                              </option>
                            ) : null}
                            {msg.cadDownloads?.fbx ? (
                              <option value={msg.cadDownloads.fbx} data-ext="fbx" className="bg-[#111114]">
                                Download FBX
                              </option>
                            ) : null}
                            {msg.cadDownloads?.stl ? (
                              <option value={msg.cadDownloads.stl} data-ext="stl" className="bg-[#111114]">
                              </option>
                            ) : null}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleOpenInAutoCAD(msg.cadDownloads, msg.modelUrl!)}
                            className="rounded-md bg-emerald-500/25 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/40"
                          >
                            {autodeskConnected ? "Open Autodesk Drive" : "Connect Autodesk"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </div>

        {/* Floating AI Prompt Footer */}
        <div className="absolute bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4 shadow-2xl">
          <div className="flex flex-col gap-3">

            {/* Attached sketch preview bubble if exists */}
            {attachedImage ? (
              <div className="flex items-center gap-3 self-center rounded-[24px] border border-emerald-400/20 bg-[#1e1e24] p-2 pr-4 shadow-xl mb-2 backdrop-blur-xl">
                <img src={attachedImage.url} alt="Attached sketch" className="h-10 w-10 rounded-[14px] object-cover" />
                <div className="text-xs">
                  <p className="text-emerald-100 font-medium tracking-wide">Sketch attached: {attachedImage.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = attachedImage.url;
                    setAttachedImage(null);
                    void handleGenerate3D(url, prompt || `Generated 3D from ${attachedImage.name}`);
                  }}
                  className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-300 hover:bg-emerald-500/30 transition ml-2"
                >
                  Direct to 3D
                </button>
                <button type="button" className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition" onClick={() => setAttachedImage(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : null}

            {/* Main Prompt Input Bar */}
            <div className="flex w-full items-center gap-3 rounded-[32px] border border-white/10 bg-[#1f1f23] p-[8px] drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)] transition hover:border-white/20">
              <button
                type="button"
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition"
                aria-label="Upload sketch"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerateImage(); } }}
                placeholder={attachedImage ? "Describe how to enhance the attached sketch..." : "Describe the image you want to create..."}
                className="flex-1 bg-transparent px-3 py-2 text-[15px] font-medium text-white placeholder:text-white/40 outline-none"
                disabled={busy}
              />
              <button
                onClick={handleGenerateImage}
                disabled={busy || !selectedProject || !prompt.trim()}
                type="button"
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#35153a] hover:bg-[#451e4d] text-white disabled:opacity-50 transition drop-shadow-md"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>}
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="mt-1 flex items-center justify-center gap-8 pl-1 text-[13px] font-medium text-white/40">
              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider text-white/30">Mode</span>
                <div className="flex items-center gap-1 opacity-80">
                  <button onClick={() => setMode("design")} className={`rounded-full px-3 py-1.5 transition ${mode === "design" ? "bg-white/15 text-white shadow-sm" : "hover:text-white hover:bg-white/5"}`}>Design</button>
                  <button onClick={() => setMode("multiview")} className={`rounded-full px-3 py-1.5 transition ${mode === "multiview" ? "bg-[#35153a]/80 text-[#d499ed] shadow-sm" : "hover:text-white hover:bg-white/5"}`}>Multi-view</button>
                  <button onClick={() => setMode("zboard")} className={`rounded-full px-3 py-1.5 transition ${mode === "zboard" ? "bg-white/15 text-white shadow-sm" : "hover:text-white hover:bg-white/5"}`}>Z-board</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider text-white/30">Style</span>
                <div className="relative border-b flex items-center border-transparent hover:border-white/20 transition cursor-pointer">
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="appearance-none bg-transparent pr-5 py-1.5 font-medium text-white/80 outline-none cursor-pointer">
                    <option className="bg-[#18181b]">Default</option>
                    <option className="bg-[#18181b]">Photorealistic</option>
                    <option className="bg-[#18181b]">Sketch</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-0 text-white/50" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-wider text-white/30">Variations</span>
                <div className="flex items-center gap-3 opacity-80">
                  <button onClick={() => setVariations(Math.max(1, variations - 1))} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:text-white transition"><Minus size={12} strokeWidth={3} /></button>
                  <span className="w-2 text-center text-[13px] text-white/90">{variations}</span>
                  <button onClick={() => setVariations(Math.min(4, variations + 1))} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:text-white transition"><Plus size={12} strokeWidth={3} /></button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div >
  );
}
