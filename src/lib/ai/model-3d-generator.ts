import Replicate from "replicate";

export type Model3DInput = {
  prompt?: string;
  imageUrl?: string;
};

// Unified prompt that handles BOTH raw designer sketches AND existing renders.
// The output is a clean flat-lit white-background image optimised for
// photogrammetry-based 3-D reconstruction inside Meshy.
const MESHY_PREP_PROMPT =
  "You are preparing a jewelry image for professional 3D model reconstruction. " +
  "The input may be a hand-drawn designer sketch OR an existing photorealistic render. " +
  "Generate ONE photorealistic product image following these rules exactly:\n" +
  "1. GEOMETRY: Preserve the EXACT shape, silhouette, stone layout, and metalwork " +
  "proportions from the input — do not simplify or invent details.\n" +
  "2. MATERIALS: If the input is a sketch, infer luxury materials intelligently " +
  "(green tones → flawless emeralds, silver/grey → polished platinum or white gold, " +
  "yellow → 18k solid gold, white/clear → VVS diamonds). " +
  "If the input is already a render, keep all existing materials exactly as they are.\n" +
  "3. LIGHTING: Perfectly flat, even, shadowless studio lighting. " +
  "Absolutely NO dramatic shadows, NO caustic glows, NO specular spill on the background.\n" +
  "4. BACKGROUND: Pure white (#FFFFFF) — no gradients, no surface texture, no fabric.\n" +
  "5. FRAMING: The ENTIRE jewelry piece fully visible, centered, not cropped at any edge.\n" +
  "6. NO bokeh, NO depth-of-field blur, NO humans, NO mannequin, NO text overlays.\n" +
  "This image will be sent directly into a 3D photogrammetry reconstructor — " +
  "clean isolation and flat lighting are critical.";

// Default jewelry texture prompt always sent to Meshy
const MESHY_JEWELRY_TEXTURE_PROMPT =
  "18k polished white gold or platinum metal, brilliant-cut diamond facets with " +
  "internal sparkle, flawless precious gemstones with light caustics and transparency, " +
  "luxury fine-jewelry PBR materials, photorealistic surface detail";

const MESHY_NEGATIVE_TEXTURE_PROMPT =
  "plastic, matte finish, clay, cartoon, toy, rough unfinished surface, unrealistic colours";

async function fetchImageAsInlineData(
  url: string,
): Promise<{ mimeType: string; data: string } | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1] ?? "image/png", data: match[2] ?? "" };
  }

  let fetchUrl = trimmed;
  if (trimmed.startsWith("/")) {
    const baseUrl = process.env.AUTH_URL?.trim();
    fetchUrl = baseUrl
      ? new URL(trimmed, baseUrl).toString()
      : `http://localhost:3000${trimmed}`;
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return null;
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return { mimeType, data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

/**
 * Uses Gemini to regenerate the source jewelry image with flat lighting and a
 * white background — dramatically improving Meshy's 3-D reconstruction quality.
 * Returns a data-URI on success, or null if the step should be skipped.
 */
async function generateCleanMeshyImage(
  sourceImageUrl: string,
): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const inlineData = await fetchImageAsInlineData(sourceImageUrl);
  if (!inlineData) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: MESHY_PREP_PROMPT },
                {
                  inlineData: {
                    mimeType: inlineData.mimeType,
                    data: inlineData.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
      },
    );

    if (!response.ok) return null;
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const candidates = Array.isArray(payload.candidates)
      ? payload.candidates
      : [];
    for (const candidate of candidates) {
      const parts =
        (
          candidate as { content?: { parts?: unknown[] } }
        ).content?.parts ?? [];
      for (const part of parts) {
        const p = part as Record<string, unknown>;
        const id = (p.inlineData ?? p.inline_data) as
          | Record<string, unknown>
          | undefined;
        if (id?.data) {
          const mime =
            String(id.mimeType ?? id.mime_type ?? "image/png");
          return `data:${mime};base64,${id.data}`;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type Model3DOutput = {
  modelUrl: string;
  previewUrl?: string;
  cadDownloads?: {
    glb?: string;
    obj?: string;
    fbx?: string;
    stl?: string;
  };
  provider:
    | "meshy-image-to-3d"
    | "replicate-hunyuan3d-2"
    | "replicate-hunyuan3d-2.1"
    | "replicate-hunyuan-3d-3.1";
};

const REPLICATE_MIN_GAP_MS = 1200;
const REPLICATE_MAX_ATTEMPTS = 3;
const MESHY_BASE_URL = "https://api.meshy.ai";
const MESHY_DEFAULT_TIMEOUT_SEC = 1200;
const MESHY_DEFAULT_POLL_INTERVAL_MS = 2500;

const HUNYUAN3D_2_VERSION = "tencent/hunyuan3d-2:b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb";
const HUNYUAN3D_21_VERSION = "ndreca/hunyuan3d-2.1:895e514f953d39e8b5bfb859df9313481ad3fa3a8631e5c54c7e5c9c85a6aa9f";
const HUNYUAN3D_31_VERSION = "tencent/hunyuan-3d-3.1:a2838628b41a2e0ee2eb19b3ea98a40d75f8d7639bf5a1ddd37ea299bb334854";

let nextReplicateRequestAt = 0;
let replicateQueue = Promise.resolve();

type MeshyTaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

type MeshyTask = {
  id?: string;
  status?: MeshyTaskStatus;
  progress?: number;
  thumbnail_url?: string;
  model_urls?: {
    glb?: string;
    obj?: string;
    fbx?: string;
    stl?: string;
    pre_remeshed_glb?: string;
  };
  task_error?: {
    message?: string;
  };
};

async function readMeshyError(response: Response): Promise<string> {
  const bodyText = await response.text();
  if (!bodyText) {
    return response.statusText || `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(bodyText) as { message?: string; error?: string; detail?: string };
    return parsed.message || parsed.error || parsed.detail || bodyText;
  } catch {
    return bodyText;
  }
}

function parseDataUriMimeType(value: string): string {
  const match = value.match(/^data:([^;]+);base64,/i);
  return String(match?.[1] ?? "").toLowerCase();
}

function isMeshySupportedMimeType(mimeType: string): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType === "image/png";
}

async function toMeshyImageInput(imageUrl: string): Promise<string> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("Missing input image for Meshy.");
  }

  // Already a data URI - validate and return
  if (trimmed.startsWith("data:")) {
    const mimeType = parseDataUriMimeType(trimmed);
    if (!isMeshySupportedMimeType(mimeType)) {
      throw new Error("Meshy supports only PNG/JPEG images. Please upload PNG or JPG.");
    }
    return trimmed;
  }

  // Try to fetch as absolute URL first, then relative
  let fetchUrl = trimmed;
  const baseUrl = process.env.AUTH_URL?.trim();
  
  if (trimmed.startsWith("/")) {
    // Relative path - add base URL if available
    if (baseUrl) {
      fetchUrl = new URL(trimmed, baseUrl).toString();
    } else {
      // Try localhost as fallback for local dev
      fetchUrl = `http://localhost:3000${trimmed}`;
    }
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const mimeType = String(response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() || "";
    if (!isMeshySupportedMimeType(mimeType)) {
      throw new Error("Meshy supports only PNG/JPEG images. Please upload PNG or JPG.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (fetchErr) {
    // If fetch fails on relative URL, give helpful error
    if (trimmed.startsWith("/")) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      throw new Error(
        `Unable to fetch image. Make sure it was uploaded successfully. (${errMsg})`
      );
    }
    throw fetchErr;
  }
}

async function generateWithMeshy(imageUrl: string, prompt?: string): Promise<Model3DOutput> {
  const apiKey = process.env.MESHY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MESHY_API_KEY is not set.");
  }

  const timeoutSec = Number(process.env.MESHY_TIMEOUT_SEC ?? String(MESHY_DEFAULT_TIMEOUT_SEC));
  const timeoutMs = Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec * 1000 : MESHY_DEFAULT_TIMEOUT_SEC * 1000;
  const pollIntervalMs = Number(process.env.MESHY_POLL_INTERVAL_MS ?? String(MESHY_DEFAULT_POLL_INTERVAL_MS));
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs >= 500 ? Math.floor(pollIntervalMs) : MESHY_DEFAULT_POLL_INTERVAL_MS;

  // Pre-process: generate a flat-lit white-bg version optimised for 3-D reconstruction.
  console.log("[Meshy] Pre-processing image via Gemini for optimal 3-D quality…");
  const cleanImageUrl = await generateCleanMeshyImage(imageUrl);
  if (cleanImageUrl) {
    console.log("[Meshy] Using Gemini-preprocessed clean image.");
  } else {
    console.log("[Meshy] Preprocessing skipped (no Gemini key or failed) — using original image.");
  }

  const meshyImageInput = await toMeshyImageInput(cleanImageUrl ?? imageUrl);

  // Compose texture prompt: user hint first, then always include jewelry defaults.
  const userHint = String(prompt ?? "").trim();
  const texturePrompt = userHint
    ? `${userHint}. ${MESHY_JEWELRY_TEXTURE_PROMPT}`.slice(0, 600)
    : MESHY_JEWELRY_TEXTURE_PROMPT.slice(0, 600);

  const createPayload: Record<string, unknown> = {
    image_url: meshyImageInput,
    // meshy-4 is their highest-quality image-to-3D model
    ai_model: "meshy-4",
    should_texture: true,
    enable_pbr: true,
    target_formats: ["glb", "obj", "fbx", "stl"],
    image_enhancement: true,
    remove_lighting: true,
    moderation: false,
    // Jewelry-specific quality settings
    symmetry_mode: "auto",      // exploit bilateral symmetry common in jewelry
    topology: "quad",           // quad mesh = cleaner geometry for CAD workflows
    surface_mode: "smooth",     // no hard facets on organic jewelry surfaces
    texture_richness: "high",   // maximum material detail
    texture_resolution: 4096,   // highest available resolution
    texture_prompt: texturePrompt,
    negative_texture_prompt: MESHY_NEGATIVE_TEXTURE_PROMPT,
  };

  const createRes = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const details = await readMeshyError(createRes);
    if (createRes.status === 401) throw new Error("Meshy API key is invalid.");
    if (createRes.status === 402) throw new Error("Meshy credits are required for 3D generation.");
    if (createRes.status === 429) throw new Error("Meshy is rate limited. Try again shortly.");
    throw new Error(`Meshy task creation failed (${createRes.status}): ${details.slice(0, 280)}`);
  }

  const createJson = (await createRes.json()) as { result?: string };
  const taskId = String(createJson.result ?? "").trim();
  if (!taskId) {
    throw new Error("Meshy did not return a task id.");
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const taskRes = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!taskRes.ok) {
      const details = await readMeshyError(taskRes);
      if (taskRes.status === 401) throw new Error("Meshy API key is invalid.");
      if (taskRes.status === 429) throw new Error("Meshy is rate limited. Try again shortly.");
      throw new Error(`Meshy task polling failed (${taskRes.status}): ${details.slice(0, 280)}`);
    }

    const task = (await taskRes.json()) as MeshyTask;
    if (task.status === "SUCCEEDED") {
      const modelUrl = String(task.model_urls?.glb ?? task.model_urls?.pre_remeshed_glb ?? "").trim();
      if (!modelUrl) {
        throw new Error("Meshy task succeeded but no GLB URL was returned.");
      }

      const previewUrl = String(task.thumbnail_url ?? "").trim() || undefined;
      const objUrl = String(task.model_urls?.obj ?? "").trim() || undefined;
      const fbxUrl = String(task.model_urls?.fbx ?? "").trim() || undefined;
      const stlUrl = String(task.model_urls?.stl ?? "").trim() || undefined;
      return {
        provider: "meshy-image-to-3d",
        modelUrl,
        previewUrl,
        cadDownloads: {
          glb: modelUrl,
          obj: objUrl,
          fbx: fbxUrl,
          stl: stlUrl,
        },
      };
    }

    if (task.status === "FAILED" || task.status === "CANCELED") {
      const reason = String(task.task_error?.message ?? "").trim();
      throw new Error(`Meshy task ${task.status.toLowerCase()}: ${reason || "No reason provided."}`);
    }

    await sleep(pollMs);
  }

  throw new Error(`Meshy timed out after ${Math.ceil(timeoutMs / 1000)}s.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUrlLike(value: unknown): string {
  if (value == null) return "";
  if (typeof (value as { url?: () => URL }).url === "function") {
    return (value as { url: () => URL }).url().href;
  }
  const asStr = String(value);
  return asStr.startsWith("http") ? asStr : "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function getRetryAfterMs(error: unknown): number {
  const asRecord = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const directRetryAfter = asRecord.retry_after ?? asRecord.retryAfter;
  if (typeof directRetryAfter === "number" && Number.isFinite(directRetryAfter)) {
    return Math.max(1000, Math.ceil(directRetryAfter * 1000));
  }

  const message = getErrorMessage(error);
  const retryAfterMatch = message.match(/"retry_after"\s*:\s*(\d+)/i);
  if (retryAfterMatch) {
    return Math.max(1000, Number(retryAfterMatch[1]) * 1000);
  }

  const resetMatch = message.match(/resets in ~?(\d+)s/i);
  if (resetMatch) {
    return Math.max(1000, Number(resetMatch[1]) * 1000);
  }

  return REPLICATE_MIN_GAP_MS;
}

function isRateLimitError(error: unknown): boolean {
  const asRecord = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  if (asRecord.status === 429) return true;

  const message = getErrorMessage(error).toLowerCase();
  return message.includes("429") || message.includes("too many requests") || message.includes("throttled");
}

function isPaymentRequiredError(error: unknown): boolean {
  const asRecord = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  if (asRecord.status === 402) return true;

  const message = getErrorMessage(error).toLowerCase();
  return message.includes("402") || message.includes("payment required") || message.includes("insufficient") || message.includes("billing");
}

async function withReplicateQueue<T>(task: () => Promise<T>): Promise<T> {
  const previous = replicateQueue;
  let release = () => {};
  replicateQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    const waitMs = Math.max(0, nextReplicateRequestAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    return await task();
  } finally {
    release();
  }
}

async function runHunyuan3D2(replicate: Replicate, imageUrl: string): Promise<Model3DOutput> {
  const output = (await replicate.run(HUNYUAN3D_2_VERSION, {
    input: {
      image: imageUrl,
      remove_background: true,
    },
  })) as Record<string, unknown>;

  const modelUrl =
    extractUrlLike(output.mesh) ||
    extractUrlLike(output.model_file) ||
    extractUrlLike(output.output) ||
    "";

  if (!modelUrl) {
    throw new Error("hunyuan3d-2 returned no model URL.");
  }

  return {
    provider: "replicate-hunyuan3d-2",
    modelUrl,
    previewUrl: extractUrlLike(output.video) || undefined,
    cadDownloads: {
      glb: modelUrl,
    },
  };
}

async function runHunyuan3D21(replicate: Replicate, imageUrl: string): Promise<Model3DOutput> {
  const output = (await replicate.run(HUNYUAN3D_21_VERSION, {
    input: {
      image: imageUrl,
      remove_background: true,
      generate_texture: true,
    },
  })) as Record<string, unknown>;

  const modelUrl =
    extractUrlLike(output.mesh) ||
    extractUrlLike(output.model_file) ||
    extractUrlLike(output.output) ||
    "";

  if (!modelUrl) {
    throw new Error("hunyuan3d-2.1 returned no model URL.");
  }

  return {
    provider: "replicate-hunyuan3d-2.1",
    modelUrl,
    previewUrl: extractUrlLike(output.video) || undefined,
    cadDownloads: {
      glb: modelUrl,
    },
  };
}

async function runHunyuan3D31(replicate: Replicate, imageUrl: string): Promise<Model3DOutput> {
  const output = (await replicate.run(HUNYUAN3D_31_VERSION, {
    input: {
      image: imageUrl,
      enable_pbr: true,
      face_count: 20000,
    },
  })) as unknown;

  const modelUrl = extractUrlLike(output);
  if (!modelUrl) {
    throw new Error("hunyuan-3d-3.1 returned no model URL.");
  }

  return {
    provider: "replicate-hunyuan-3d-3.1",
    modelUrl,
    cadDownloads: {
      glb: modelUrl,
    },
  };
}

async function generateFromReplicateProviders(replicate: Replicate, imageUrl: string): Promise<Model3DOutput> {
  const errors: string[] = [];

  const providers = [
    () => runHunyuan3D2(replicate, imageUrl),
    () => runHunyuan3D21(replicate, imageUrl),
    () => runHunyuan3D31(replicate, imageUrl),
  ];

  for (const run of providers) {
    try {
      return await run();
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(message);

      if (isPaymentRequiredError(error)) {
        throw new Error("Replicate 3D models require billing/credits on your account.");
      }

      if (isRateLimitError(error)) {
        throw error;
      }
    }
  }

  throw new Error(`All 3D providers failed: ${errors.map((e) => e.slice(0, 120)).join(" | ")}`);
}

export async function generate3DModel(input: Model3DInput): Promise<Model3DOutput> {
  const imageUrl = String(input.imageUrl ?? "").trim();
  const prompt = String(input.prompt ?? "").trim();
  if (!imageUrl) {
    throw new Error("3D generation needs an image first. Generate an image and click View 3D.");
  }

  const meshyKey = process.env.MESHY_API_KEY?.trim();
  const allowReplicateFallback = String(process.env.ALLOW_REPLICATE_FALLBACK ?? "").trim().toLowerCase() === "true";
  if (meshyKey) {
    console.log("[3D] Attempting Meshy image-to-3D.");
    try {
      return await generateWithMeshy(imageUrl, prompt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[Meshy] failed:", msg);
      if (!allowReplicateFallback) {
        throw new Error(`Meshy 3D failed: ${msg}`);
      }
      console.error("[Meshy] ALLOW_REPLICATE_FALLBACK=true, falling back to Replicate providers.");
    }
  } else {
    console.log("[3D] MESHY_API_KEY not set, skipping Meshy.");
  }

  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim();
  if (!replicateKey) {
    throw new Error(
      "3D generation unavailable. Set MESHY_API_KEY or REPLICATE_API_TOKEN.",
    );
  }

  const replicate = new Replicate({ auth: replicateKey });

  return withReplicateQueue(async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= REPLICATE_MAX_ATTEMPTS; attempt += 1) {
      try {
        nextReplicateRequestAt = Date.now() + REPLICATE_MIN_GAP_MS;
        return await generateFromReplicateProviders(replicate, imageUrl);
      } catch (error) {
        lastError = error;

        if (isPaymentRequiredError(error)) {
          throw error instanceof Error ? error : new Error("Replicate billing is required for 3D generation.");
        }

        if (!isRateLimitError(error) || attempt === REPLICATE_MAX_ATTEMPTS) {
          break;
        }

        const retryAfterMs = getRetryAfterMs(error) + 250;
        nextReplicateRequestAt = Date.now() + retryAfterMs;
        await sleep(retryAfterMs);
      }
    }

    if (isRateLimitError(lastError)) {
      const retryAfterMs = getRetryAfterMs(lastError);
      throw new Error(`Replicate 3D is rate limited. Wait ${Math.ceil(retryAfterMs / 1000)}s and try again.`);
    }

    throw lastError instanceof Error ? lastError : new Error("3D generation failed.");
  });
}
