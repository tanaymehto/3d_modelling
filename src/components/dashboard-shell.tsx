"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Loader2, Minus, PanelLeft, Plus, Send } from "lucide-react";
import { GLBViewer } from "@/components/glb-viewer";

function ImageCard({ src, onView3D, label, disabled }: { src: string; onView3D: () => void; label?: string; disabled?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <article className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-white/20">
      <div className="relative aspect-square w-full bg-white/8">
        {!loaded && !errored && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs">Loading image…</span>
          </div>
        )}
        {errored ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400/70">
            Image failed to load
          </div>
        ) : (
          <img
            src={src}
            alt="Generated jewelry"
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${loaded ? "opacity-100 group-hover:scale-105" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        )}
      </div>
      <div className="flex items-center justify-between p-2.5">
        <span className="text-xs text-white/50">{label ?? "AI generated"}</span>
        <button
          className="rounded-lg bg-[#4a3dff]/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4a3dff] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onView3D}
          type="button"
          disabled={disabled}
        >
          Convert to 3D
        </button>
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
      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");

      showToast(`Pushed ${data.filename} to Autodesk!`);
      if (newTab) newTab.location.href = "https://web.autocad.com/";
    } catch (e: any) {
      console.error(e);
      showToast(`Failed to push automatically: ${e.message}. Downloading locally instead.`);
      triggerBrowserDownload(preferred, `zennah-export.${extension}`);
      if (newTab) newTab.location.href = "https://web.autocad.com/";
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

  return (
    <div className="flex h-screen bg-[#111114] text-[#ededed]">
      {/* Toast notification */}
      {viewingGlb ? <GLBViewer url={viewingGlb} onClose={() => setViewingGlb(null)} /> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          void handleUploadSketch(file);
        }}
      />
      {toast ? (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-500/15 px-5 py-3 text-sm text-red-300 shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}
      <aside className={`${sidebarCollapsed ? "w-0 overflow-hidden border-r-0 p-0" : "w-64 border-r border-white/10 p-4"} transition-all duration-200`}>
        <div className="mb-6 text-lg font-semibold">Zennah</div>
        <div className="mb-4 text-xs text-white/60">Workspaces</div>
        <div className="space-y-3 overflow-y-auto pr-1">
          {workspaces.map((workspace) => (
            <div key={workspace.id}>
              <div className="mb-2 text-sm text-white/80">{workspace.name}</div>
              <div className="space-y-1">
                {workspace.projects.map((project) => (
                  <button
                    key={project.id}
                    className={`w-full rounded-md px-2 py-1 text-left text-sm ${selectedProject === project.id ? "bg-white/15" : "hover:bg-white/10"
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
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="rounded-md border border-white/20 p-1.5 text-white/70 hover:bg-white/10"
                title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              >
                <PanelLeft size={14} />
              </button>
              <div className="text-sm text-white/80">Welcome, {userName}</div>
            </div>
            <div className="text-xs text-white/50">{allProjects.length} projects</div>
          </div>
          <div className="rounded-full border border-white/20 px-4 py-2 text-sm">
            {credits.image} image runs left | {credits.model} 3D runs left
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 text-sm text-white/60">Previous Generations</div>
          <div className="space-y-8">
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
                      <div className="flex h-48 items-center justify-center text-xs text-white/40">
                        <button
                          type="button"
                          onClick={() => setViewingGlb(msg.modelUrl!)}
                          className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-8 py-5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-2xl">🪐</span>
                          <span className="text-sm text-white/60">Open 3D Viewer</span>
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
                              Download STL
                            </option>
                          ) : null}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleOpenInAutoCAD(msg.cadDownloads, msg.modelUrl!)}
                          className="rounded-md bg-emerald-500/25 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/40"
                        >
                          {autodeskConnected ? "Open in AutoCAD Web" : "Connect Autodesk"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mx-auto max-w-4xl space-y-3">
            {attachedImage ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <img src={attachedImage.url} alt="Attached sketch" className="h-14 w-14 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-emerald-100">Sketch attached: {attachedImage.name}</p>
                    <p className="text-xs text-emerald-200/80">Choose an action below</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25"
                    onClick={() => setAttachedImage(null)}
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const url = attachedImage.url;
                      setAttachedImage(null);
                      void handleGenerate3D(
                        url,
                        "ornate jewelry pendant, isolated single object, preserve exact silhouette, high-detail metal and gemstone structure",
                      );
                    }}
                    className="flex-1 rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/40 disabled:opacity-40"
                  >
                    🔮 Direct to 3D
                  </button>
                  <span className="text-xs text-white/30">or type a prompt below to enhance first ↓</span>
                </div>
              </div>
            ) : null}

            {/* Prompt input */}
            <div className="flex items-center gap-3 rounded-full bg-white/8 px-2 py-2">
              <button
                type="button"
                className="rounded-full p-2 hover:bg-white/10 transition-colors"
                aria-label="Upload a sketch"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus size={18} />
              </button>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleGenerateImage(); } }}
                placeholder={attachedImage ? "Describe how to enhance the attached sketch..." : "Describe the image you want to create..."}
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                disabled={busy}
              />
              <button
                onClick={handleGenerateImage}
                disabled={busy || !selectedProject || !prompt.trim()}
                type="button"
                className="rounded-full bg-[#4a3dff] p-3 text-white transition-opacity disabled:opacity-40"
                aria-label="Generate"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 px-1 text-sm text-white/60">
              {/* Mode toggle */}
              <span className="text-white/40">Mode</span>
              <div className="flex rounded-full border border-white/15 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setMode("design")}
                  className={`px-3 py-1.5 transition-colors ${mode === "design" ? "bg-white/15 text-white" : "hover:bg-white/8"}`}
                >
                  Design
                </button>
                <button
                  type="button"
                  onClick={() => setMode("multiview")}
                  className={`px-3 py-1.5 transition-colors ${mode === "multiview" ? "bg-indigo-500/30 text-indigo-200" : "hover:bg-white/8"}`}
                >
                  Multi-view
                </button>
                <button
                  type="button"
                  onClick={() => setMode("zboard")}
                  className={`px-3 py-1.5 transition-colors ${mode === "zboard" ? "bg-white/15 text-white" : "hover:bg-white/8"}`}
                >
                  Z-board
                </button>
              </div>

              {/* Style dropdown */}
              <span className="text-white/40">Style</span>
              <div className="relative">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="appearance-none rounded-full border border-white/15 bg-transparent py-1.5 pl-3 pr-7 text-xs text-white outline-none cursor-pointer hover:bg-white/8"
                >
                  {["Default", "Photorealistic", "Sketch", "Watercolor", "Minimalist"].map((s) => (
                    <option key={s} value={s} className="bg-[#111114]">{s}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40" />
              </div>

              {/* Variations */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-white/40">Variations</span>
                <button
                  type="button"
                  onClick={() => setVariations((v) => Math.max(1, v - 1))}
                  className="rounded-full border border-white/15 p-1 hover:bg-white/8"
                >
                  <Minus size={12} />
                </button>
                <span className="w-4 text-center text-xs text-white">{variations}</span>
                <button
                  type="button"
                  onClick={() => setVariations((v) => Math.min(4, v + 1))}
                  className="rounded-full border border-white/15 p-1 hover:bg-white/8"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
