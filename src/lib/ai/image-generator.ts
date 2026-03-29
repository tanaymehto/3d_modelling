import Replicate from "replicate";

export type ImageGenerationInput = {
  prompt: string;
  mode?: "design" | "multiview";
  referenceImageUrl?: string;
};

export type ImageGenerationOutput = {
  images: string[];
  provider: "pixazo" | "gemini" | "pollinations" | "replicate" | "mock" | "modelslab-controlnet" | "modelslab-i2i";
};

const MODELSLAB_CONTROLNET_URL = "https://modelslab.com/api/v5/controlnet";
const MODELSLAB_I2I_URL = "https://modelslab.com/api/v7/images/image-to-image";

// Hard prefix applied to EVERY prompt — ensures jewelry closeup, no human body
const JEWELRY_SYSTEM_PREFIX =
  "Professional macro product photography of jewelry piece only, no humans, no body parts, no hands, no models, clean isolated shot,";

// Positive style suffixes per slot
const STYLE_SUFFIXES = [
  "on a soft neutral velvet surface, studio three-point lighting, ultra-sharp focus",
  "floating on white gradient background, overhead flat-lay composition, crisp shadows",
  "macro lens close-up, bokeh background, luxury catalog lighting, photorealistic",
];

// Multi-view angle suffixes
const MULTIVIEW_ANGLES = [
  "front-facing portrait view, centered, clean background",
  "45-degree left angle view, showing depth and profile, clean background",
  "top-down flat-lay overhead view, clean background",
];

function buildVariants(prompt: string, mode: "design" | "multiview"): string[] {
  const base = `${JEWELRY_SYSTEM_PREFIX} ${prompt.trim()}`;
  const suffixes = mode === "multiview" ? MULTIVIEW_ANGLES : STYLE_SUFFIXES;
  return suffixes.map((s) => `${base}, ${s}`);
}

/**
 * Reference-image mode: prompts that PRESERVE the sketch design instead of
 * generic jewelry photography language that overrides the reference content.
 */
function buildReferenceVariants(userPrompt: string): string[] {
  const desc = userPrompt.trim() || "enhance to photorealistic";
  const core = [
    `STEP 1 — IDENTIFY: Look at the attached sketch. Identify the EXACT jewelry type`,
    `(e.g. necklace, ring, bracelet, earring, brooch, bangle). You MUST reproduce`,
    `that exact jewelry type — never substitute a different type.`,
    `STEP 2 — RENDER: Create a breathtaking ultra-luxury photorealistic product`,
    `photograph of THIS EXACT piece. User notes: "${desc}".`,
    `CRITICAL RULES:`,
    `1) JEWELRY TYPE LOCK: If the sketch shows a necklace, output a necklace.`,
    `If it shows a ring, output a ring. Never change the jewelry category.`,
    `2) GEOMETRY PRESERVATION: Preserve the EXACT shape, silhouette, structural`,
    `layout, gemstone placement, and metalwork proportions from the sketch.`,
    `Do not simplify, omit, or invent structural elements.`,
    `3) MATERIAL INFERENCE: Upgrade sketch shading to luxury materials`,
    `(green tones → flawless emeralds, grey/silver → polished platinum or white gold,`,
    `yellow → 18k solid gold, white/clear → VVS diamonds).`,
    `4) OUTPUT: No humans, no neck lines, no mannequins, no text. Clean isolated product shot only.`,
  ].join(" ");

  return [
    `${core} Rendered on a soft neutral velvet surface, studio three-point lighting, ultra-sharp macro focus.`,
    `${core} Floating on a clean white gallery gradient background, overhead flat-lay composition, crisp drop shadows.`,
    `${core} Macro lens close-up, warm luxury catalog lighting, photorealistic gemstone caustics and metal reflections.`,
  ];
}

function pollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&private=true&seed=${seed}&enhance=true`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchReferenceImageAsInlineData(
  referenceImageUrl: string,
): Promise<{ mimeType: string; data: string } | null> {
  const url = referenceImageUrl.trim();
  if (!url) return null;

  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mimeType: match[1] ?? "image/png",
      data: match[2] ?? "",
    };
  }

  const response = await fetch(url);
  if (!response.ok) return null;

  const mimeType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType,
    data: buffer.toString("base64"),
  };
}

async function generateWithPixazo(variants: string[], subscriptionKey: string): Promise<string[]> {
  const images: string[] = [];

  for (const variant of variants) {
    const response = await fetch("https://gateway.pixazo.ai/flux-1-schnell/v1/getData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
      body: JSON.stringify({
        prompt: variant,
        num_steps: 4,
        width: 1024,
        height: 1024,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload.message === "string"
        ? payload.message
        : `Pixazo generation failed with ${response.status}`;
      throw new Error(message);
    }

    const imageUrl = typeof payload.output === "string" ? payload.output : "";
    if (!imageUrl.startsWith("http")) {
      throw new Error("Pixazo returned no image URL.");
    }

    images.push(imageUrl);
  }

  return images;
}

function getGeminiImageDataUrl(payload: unknown): string {
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];

  for (const candidate of candidates) {
    const content = typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>).content : null;
    const parts = content && typeof content === "object" && Array.isArray((content as Record<string, unknown>).parts)
      ? ((content as Record<string, unknown>).parts as unknown[])
      : [];

    for (const part of parts) {
      const partRecord = typeof part === "object" && part !== null ? (part as Record<string, unknown>) : {};
      const inlineData = (partRecord.inlineData ?? partRecord.inline_data) as Record<string, unknown> | undefined;
      const data = typeof inlineData?.data === "string" ? inlineData.data : "";
      const mimeType = typeof (inlineData?.mimeType ?? inlineData?.mime_type) === "string"
        ? String(inlineData?.mimeType ?? inlineData?.mime_type)
        : "image/png";

      if (data) {
        return `data:${mimeType};base64,${data}`;
      }
    }
  }

  return "";
}

/**
 * Clean short prompts for ControlNet (SD-based). Long instruction text
 * hurts SD quality — use concise style tags instead.
 */
function buildControlNetVariants(userPrompt: string): string[] {
  const base = userPrompt.trim()
    ? `${userPrompt.trim()}, `
    : "";
  return [
    `${base}ultra photorealistic fine jewelry product photograph, luxury gemstones, polished metal, clean white background, studio lighting, macro detail, 8k`,
    `${base}photorealistic luxury jewelry, flat lay overhead, pure white background, even shadowless studio light, ultra sharp macro focus, professional product shot`,
    `${base}high-end jewelry product render, soft warm studio lighting, neutral background, brilliant gemstone facets, polished gold or platinum, photorealistic 8k`,
  ];
}

/**
 * Resolves relative or data-URI image references to a public absolute URL
 * that external APIs (ModelsLab) can fetch. Returns null for data URIs since
 * those can't be fetched by external services.
 */
function resolveToPublicUrl(imageUrl: string): string | null {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return null; // can't send data URIs to external APIs
  if (trimmed.startsWith("http")) return trimmed;
  // Relative path → absolute using AUTH_URL or localhost fallback
  const base = process.env.AUTH_URL?.trim() || "http://localhost:3000";
  return new URL(trimmed, base).toString();
}

/**
 * Poll a ModelsLab async result URL until the job finishes or times out.
 */
async function pollModelsLabResult(
  fetchUrl: string,
  apiKey: string,
  maxWaitMs = 120000,
): Promise<string[]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(3000);
    const res = await fetch(fetchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey }),
    });
    if (!res.ok) throw new Error(`ModelsLab fetch failed: ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (data.status === "success" && Array.isArray(data.output)) {
      return data.output as string[];
    }
    if (data.status === "error") {
      throw new Error(String(data.message ?? "ModelsLab processing error"));
    }
    // status === "processing" → keep polling
  }
  throw new Error("ModelsLab timed out after 2 minutes");
}

/**
 * ModelsLab ControlNet — uses lineart control to follow the sketch structure
 * EXACTLY while generating a photorealistic jewelry render.
 * Best geometry fidelity of all providers.
 */
async function generateWithModelsLabControlNet(
  variants: string[],
  sketchUrl: string,
  apiKey: string,
): Promise<string[]> {
  const publicUrl = resolveToPublicUrl(sketchUrl);
  if (!publicUrl) throw new Error("ControlNet requires a public image URL (not a data URI).");

  const images: string[] = [];
  for (const variant of variants) {
    const res = await fetch(MODELSLAB_CONTROLNET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: apiKey,
        // boziorealvisxlv4 = photorealistic SDXL model (Meshy-recommended in their docs)
        model_id: "boziorealvisxlv4",
        controlnet_model: "lineart",
        controlnet_type: "lineart",
        // auto_hint extracts clean lines from rough sketches automatically
        auto_hint: "yes",
        prompt: variant,
        negative_prompt:
          "low quality, blurry, deformed, ugly, plastic, cartoon, mannequin, human, body parts, text, watermark",
        init_image: publicUrl,
        width: "1024",
        height: "1024",
        samples: "1",
        num_inference_steps: 31,
        safety_checker: "no",
        guidance_scale: 7.5,
        // 0.9 = strong structural adherence to sketch lines
        controlnet_conditioning_scale: 0.9,
        seed: null,
        webhook: null,
        track_id: null,
      }),
    });

    if (!res.ok) throw new Error(`ModelsLab ControlNet HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (data.status === "error") {
      throw new Error(String(data.message ?? "ModelsLab ControlNet error"));
    }
    if (data.status === "success" && Array.isArray(data.output) && data.output[0]) {
      images.push(String(data.output[0]));
    } else if (data.status === "processing" && typeof data.fetch_result === "string") {
      const polled = await pollModelsLabResult(data.fetch_result, apiKey);
      if (polled[0]) images.push(String(polled[0]));
      else throw new Error("ModelsLab ControlNet returned empty result after polling");
    } else {
      throw new Error("ModelsLab ControlNet returned unexpected response");
    }
  }
  return images;
}

/**
 * ModelsLab nano-banana-2 (gemini-3.1-i2i) — image-to-image editing.
 * Good for refining/enhancing an existing render while keeping structure.
 */
async function generateWithModelsLabI2I(
  variants: string[],
  sourceImageUrl: string,
  apiKey: string,
): Promise<string[]> {
  const publicUrl = resolveToPublicUrl(sourceImageUrl);
  if (!publicUrl) throw new Error("ModelsLab I2I requires a public image URL.");

  const images: string[] = [];
  for (const variant of variants) {
    const res = await fetch(MODELSLAB_I2I_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: apiKey,
        model_id: "gemini-3.1-i2i",
        prompt: variant,
        init_image: [publicUrl],
        aspect_ratio: "1:1",
      }),
    });

    if (!res.ok) throw new Error(`ModelsLab I2I HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (data.status === "error") {
      throw new Error(String(data.message ?? "ModelsLab I2I error"));
    }
    if (data.status === "success" && Array.isArray(data.output) && data.output[0]) {
      images.push(String(data.output[0]));
    } else if (data.status === "processing" && typeof data.fetch_result === "string") {
      const polled = await pollModelsLabResult(data.fetch_result, apiKey);
      if (polled[0]) images.push(String(polled[0]));
      else throw new Error("ModelsLab I2I returned empty result after polling");
    } else {
      throw new Error("ModelsLab I2I returned unexpected response");
    }
  }
  return images;
}

/**
 * Step 1 of sketch-to-photo: ask Gemini (text-only) to produce a precise
 * structural blueprint of the sketch. This description is then injected into
 * every generation prompt so the image model works from a locked structural
 * spec rather than free interpretation.
 */
async function describeSketch(
  imageData: { mimeType: string; data: string },
  apiKey: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data,
                  },
                },
                {
                  text:
                    "You are a master CAD jeweler analyzing a designer's sketch. " +
                    "Describe this jewelry piece with precise technical detail: " +
                    "1) Exact jewelry TYPE (necklace / ring / bracelet / earring / brooch — pick one). " +
                    "2) Overall silhouette and dimensions (e.g. V-shaped necklace, ~40 cm). " +
                    "3) Every structural element: chains, bands, settings, prongs, clasps. " +
                    "4) Gemstone positions, shapes, and approximate counts. " +
                    "5) Metal framework, filigree, or motif details. " +
                    "6) Any symmetry or repeating pattern. " +
                    "Be specific and structural. Max 180 words. No marketing language.",
                },
              ],
            },
          ],
          generationConfig: { responseModalities: ["Text"] },
        }),
      },
    );

    if (!response.ok) return "";
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const candidates = Array.isArray(payload.candidates)
      ? payload.candidates
      : [];
    for (const c of candidates) {
      const parts =
        (c as { content?: { parts?: unknown[] } }).content?.parts ?? [];
      for (const p of parts) {
        const text = (p as { text?: string }).text;
        if (typeof text === "string" && text.trim()) return text.trim();
      }
    }
  } catch {
    // non-fatal — generation will proceed without the description
  }
  return "";
}

async function generateWithGemini(
  variants: string[],
  apiKey: string,
  referenceImageUrl?: string,
): Promise<string[]> {
  const images: string[] = [];
  const inlineReference = referenceImageUrl
    ? await fetchReferenceImageAsInlineData(referenceImageUrl)
    : null;

  // Step 1 — get a structural blueprint of the sketch so the generation prompt
  // is anchored to exact geometry rather than free interpretation.
  let sketchBlueprint = "";
  if (inlineReference?.data) {
    sketchBlueprint = await describeSketch(inlineReference, apiKey);
    if (sketchBlueprint) {
      console.log("[Gemini] Sketch blueprint extracted — injecting into generation prompt.");
    }
  }

  for (const variant of variants) {
    // Inject the structural blueprint at the start of the prompt so the model
    // has a locked spec before it reads stylistic instructions.
    const textPrompt = sketchBlueprint
      ? `STRUCTURAL BLUEPRINT FROM SKETCH:\n${sketchBlueprint}\n\nGENERATION INSTRUCTIONS:\n${variant}`
      : variant;

    // Image MUST come first — Gemini's multimodal attention anchors to the
    // first part, so putting the sketch before the text ensures geometry is
    // read before any stylistic instructions can override it.
    const parts: Array<Record<string, unknown>> = [];
    if (inlineReference?.data) {
      parts.push({
        inlineData: {
          mimeType: inlineReference.mimeType,
          data: inlineReference.data,
        },
      });
    }
    parts.push({ text: textPrompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: {
              aspectRatio: "1:1",
            },
          },
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof (payload as { error?: { message?: string } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : `Gemini image generation failed with ${response.status}`;
      throw new Error(message);
    }

    const imageDataUrl = getGeminiImageDataUrl(payload);
    if (!imageDataUrl) {
      throw new Error("Gemini returned no image data.");
    }

    images.push(imageDataUrl);
  }

  return images;
}

export async function generateImages(
  input: ImageGenerationInput,
): Promise<ImageGenerationOutput> {
  const prompt = input.prompt.trim();
  const mode = input.mode ?? "design";
  const referenceImageUrl = String(input.referenceImageUrl ?? "").trim();
  const variants = buildVariants(prompt, mode);
  const refVariants = referenceImageUrl ? buildReferenceVariants(prompt) : variants;
  const pixazoKey = (process.env.PIXAZO_SUBSCRIPTION_KEY || process.env.PIXARO_SUBSCRIPTION_KEY || process.env.PIXAZO_API_KEY || "")?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
  const modelsLabKey = process.env.MODELSLAB_API_KEY?.trim();

  if (referenceImageUrl) {
    // 1st choice: ModelsLab ControlNet — pixel-level geometry adherence to the sketch.
    // Uses lineart ControlNet so the generated photo follows the sketch lines exactly.
    if (modelsLabKey && !referenceImageUrl.startsWith("data:")) {
      try {
        const cnVariants = buildControlNetVariants(prompt);
        const images = await generateWithModelsLabControlNet(cnVariants, referenceImageUrl, modelsLabKey);
        if (images.length > 0) return { provider: "modelslab-controlnet", images };
      } catch (err) {
        console.warn("[ModelsLab ControlNet] failed, falling back to Gemini:", err instanceof Error ? err.message : err);
      }
    }

    // 2nd choice: Gemini multimodal with sketch blueprint.
    if (geminiKey) {
      try {
        const images = await generateWithGemini(refVariants, geminiKey, referenceImageUrl);
        if (images.length > 0) return { provider: "gemini", images };
      } catch (err) {
        console.warn("[Gemini] reference enhancement failed, falling back", err);
      }
    }
  }

  const errors: string[] = [];

  if (pixazoKey) {
    try {
      const images = await generateWithPixazo(variants, pixazoKey);
      if (images.length > 0) return { provider: "pixazo", images };
    } catch (err) {
      errors.push(`Pixazo Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (hasReplicate) {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const images: string[] = [];
    for (const variant of variants) {
      let done = false; let attempts = 0;
      let targetModel: `${string}/${string}` = "black-forest-labs/flux-1.1-pro";

      while (!done && attempts < 3) {
        attempts += 1;
        try {
          const output = await replicate.run(targetModel, {
            input: { prompt: variant, aspect_ratio: "1:1", output_format: "jpg", output_quality: 90, safety_tolerance: 2 },
          });
          const raw = Array.isArray(output) ? output[0] : output;
          const imageUrl = typeof raw === 'string' ? raw : (typeof (raw as any)?.url === 'function' ? (raw as any).url().href : String(raw));
          if (imageUrl.startsWith("http")) images.push(imageUrl);
          done = true;
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 429) { await sleep(5000); continue; }

          if (status === 402 && targetModel === "black-forest-labs/flux-1.1-pro") {
            // Free accounts cannot run flux-pro models without a credit card. Fallback automatically to flux-schnell for the demo.
            console.warn("Replicate Payment Required. Falling back to flux-schnell");
            targetModel = "black-forest-labs/flux-schnell";
            continue; // Retry immediately with free-tier model
          }

          if (status === 402) errors.push(`Replicate Error: Payment Required (Out of credits)`);
          else errors.push(`Replicate Error: Status ${status}`);
          done = true;
        }
      }
    }
    if (images.length > 0) {
      while (images.length < variants.length) images.push(images[images.length % Math.max(images.length, 1)] ?? images[0]);
      return { provider: "replicate", images };
    }
  }

  if (geminiKey) {
    try {
      const images = await generateWithGemini(variants, geminiKey, referenceImageUrl || undefined);
      if (images.length > 0) return { provider: "gemini", images };
    } catch (err) {
      errors.push(`Gemini Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All generation APIs failed:\n${errors.join('\n') || "No valid API keys found in Railway variables."}`);
}
