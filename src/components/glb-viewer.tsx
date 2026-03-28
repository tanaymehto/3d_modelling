"use client";

import { Component, type ErrorInfo, type ReactNode, Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center } from "@react-three/drei";
import { X, Download } from "lucide-react";

type ViewerErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ViewerErrorBoundaryState = {
  hasError: boolean;
};

class ViewerErrorBoundary extends Component<ViewerErrorBoundaryProps, ViewerErrorBoundaryState> {
  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GLBViewer] model render failed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

import { useEffect, useState } from "react";
import * as THREE from "three";

function Model({ url, materialType }: { url: string; materialType: string }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    // Map material names to THREE.Color hexes
    const colors: Record<string, string> = {
      Gold: "#facc15",
      "Rose Gold": "#e8b0a5",
      Silver: "#e5e7eb",
      Titanium: "#6b7280",
    };

    const targetColor = new THREE.Color(colors[materialType] || "#ffffff");

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          mats.forEach((mat) => {
            if ("color" in mat && "metalness" in mat) {
              const m = mat as THREE.MeshStandardMaterial;
              // Cache original states first time
              if (!m.userData.origColor) {
                m.userData.origColor = m.color.clone();
                m.userData.origMetalness = m.metalness;
                m.userData.origRoughness = m.roughness;
              }

              if (materialType === "Original") {
                m.color.copy(m.userData.origColor);
                m.metalness = m.userData.origMetalness;
                m.roughness = m.userData.origRoughness;
              } else {
                m.color.copy(targetColor);
                m.metalness = 1.0;
                m.roughness = 0.2;
              }
              m.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [scene, materialType]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

function Spinner3D() {
  return (
    <mesh>
      <torusGeometry args={[1, 0.3, 16, 100]} />
      <meshStandardMaterial color="#4a3dff" wireframe />
    </mesh>
  );
}

type GLBViewerProps = {
  url: string;
  onClose: () => void;
};

export function GLBViewer({ url, onClose }: GLBViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isLegacyMock = useMemo(() => url.startsWith("/sample/"), [url]);
  const [material, setMaterial] = useState("Original");
  const [viewMode, setViewMode] = useState<"render" | "materials">("render");

  const colors = [
    { name: "Original", gradient: "conic-gradient(from 90deg, #ff9f43, #ff5252, #341f97, #1dd1a1, #feca57)" },
    { name: "Gold", hex: "#facc15" },
    { name: "Rose Gold", hex: "#e8b0a5" },
    { name: "Silver", hex: "#e5e7eb" },
    { name: "Titanium", hex: "#6b7280" }
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111114]/80 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative flex h-[90vh] w-full max-w-[90vw] overflow-hidden rounded-[2rem] border border-white/5 bg-[#18181b] shadow-2xl">

        {/* Floating Top Bar overlay */}
        <div className="absolute left-6 right-6 top-6 z-10 flex items-start justify-between pointer-events-none">
          {/* Top Left Title */}
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-md pointer-events-auto shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            3D Viewer
          </div>

          {/* Top Right Controls & Close */}
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="flex items-center rounded-full border border-white/10 bg-black/40 p-1 text-xs text-white backdrop-blur-md shadow-lg">
              <button onClick={() => { setViewMode("render"); setMaterial("Original"); }} className={`rounded-full px-4 py-1.5 transition ${viewMode === "render" ? "bg-white/20 font-medium" : "hover:bg-white/10"}`}>Original</button>
              <button onClick={() => setViewMode("materials")} className={`rounded-full px-4 py-1.5 transition ${viewMode === "materials" ? "bg-white/20 font-medium" : "hover:bg-white/10"}`}>Materials</button>
              <button className="rounded-full px-4 py-1.5 transition hover:bg-white/10">Inspect</button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-full border border-white/10 bg-black/40 p-2.5 text-white transition hover:bg-white/20 backdrop-blur-md shadow-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Floating instruction pill (Top Left, under Title) */}
        <div className="absolute left-6 top-[72px] z-10 rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/70 backdrop-blur-md border border-white/5 pointer-events-none">
          <span className="font-semibold text-white/90">Ctrl</span> or <span className="font-semibold text-white/90">Right-click</span> + Drag to reposition
        </div>

        {/* Floating Material Picker (Right Side) */}
        {viewMode === "materials" && (
          <div className="absolute right-6 top-24 z-10 flex flex-col gap-3 rounded-[20px] border border-white/10 bg-black/40 p-4 backdrop-blur-md shadow-xl pointer-events-auto animate-in slide-in-from-right-4">
            {colors.map((c) => (
              <button
                key={c.name}
                onClick={() => setMaterial(c.name)}
                className="group flex flex-col items-center gap-1.5 outline-none"
              >
                <div
                  className={`h-10 w-10 shrink-0 rounded-full border-2 transition-all ${material === c.name ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-transparent hover:scale-105"}`}
                  style={c.gradient ? { background: c.gradient } : { backgroundColor: c.hex }}
                />
                <span className={`text-[10px] ${material === c.name ? "text-white font-medium" : "text-white/60"}`}>
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Floating Download Button (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 pointer-events-auto">
          <a
            href={url}
            download
            className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-6 py-3 text-sm font-medium text-white backdrop-blur-md shadow-xl transition hover:bg-black/80 hover:scale-105"
          >
            <Download size={16} />
            Download
          </a>
        </div>

        {/* Fullscreen Canvas Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] to-[#1a1a24]">
          {isLegacyMock ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
              This is a legacy mock 3D entry. Generate 3D again from an image to view.
            </div>
          ) : (
            <ViewerErrorBoundary
              fallback={
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300">
                  Could not load this GLB model. Try regenerating 3D from the source image.
                </div>
              }
            >
              <Canvas camera={{ position: [0, 0, 3], fov: 45 }} shadows>
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <pointLight position={[-5, 5, -5]} intensity={0.5} />
                <Environment preset="studio" />
                <Suspense fallback={<Spinner3D />}>
                  <Model url={url} materialType={material} />
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={1.0} enablePan={true} enableZoom={true} makeDefault />
              </Canvas>
            </ViewerErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
