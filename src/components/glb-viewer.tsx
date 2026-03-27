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

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
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

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative flex h-[80vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111114]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <span className="text-sm text-white/70">3D Model Viewer · drag to rotate · scroll to zoom</span>
          <div className="flex items-center gap-3">
            <a
              href={url}
              download
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
            >
              <Download size={12} />
              Download GLB
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          {isLegacyMock ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
              This is a legacy mock 3D entry and the file is missing. Generate 3D again from an image to open the real viewer.
            </div>
          ) : (
            <ViewerErrorBoundary
              fallback={
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300">
                  Could not load this GLB model. Try regenerating 3D from the source image.
                </div>
              }
            >
              <Canvas camera={{ position: [0, 0, 3], fov: 50 }} shadows>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                <Environment preset="studio" />
                <Suspense fallback={<Spinner3D />}>
                  <Model url={url} />
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={1.5} enablePan={false} />
              </Canvas>
            </ViewerErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
