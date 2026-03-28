import Replicate from "replicate";

export type ImageGenerationInput = {
  prompt: string;
  mode?: "design" | "multiview";
  referenceImageUrl?: string;
};

export type ImageGenerationOutput = {
  images: string[];
  provider: "pixazo" | "gemini" | "pollinations" | "replicate" | "mock";
};

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
  const desc = userPrompt.trim();
  const core = [
    `Study the attached jewelry sketch/reference image very carefully.`,
    `Create a photorealistic product photograph of this EXACT same jewelry piece described as: "${desc}".`,
    `CRITICAL RULES:`,
    `1) Preserve the exact jewelry TYPE — if it is a necklace output a necklace, if a ring output a ring, if earrings output earrings.`,
    `2) Preserve the exact shape, silhouette, design elements, gemstone placement, metalwork details, and proportions from the reference.`,
    `3) Only improve visual quality to photorealistic while keeping the design identical.`,
    `4) No humans, no body parts, no hands, no mannequins — isolated product shot only.`,
  ].join(" ");

  return [
    `${core} Soft neutral velvet surface, studio three-point lighting, ultra-sharp focus.`,
    `${core} Clean white gradient background, overhead flat-lay composition, crisp shadows.`,
    `${core} Macro lens close-up, soft bokeh background, warm luxury catalog lighting, photorealistic detail.`,
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

async function generateWithGemini(
  variants: string[],
  apiKey: string,
  referenceImageUrl?: string,
): Promise<string[]> {
  const images: string[] = [];
  const inlineReference = referenceImageUrl
    ? await fetchReferenceImageAsInlineData(referenceImageUrl)
    : null;

  for (const variant of variants) {
    // When a reference image is attached the variant already contains
    // preservation-focused instructions — no need to append extra text.
    const textPrompt = variant;

    const parts: Array<Record<string, unknown>> = [{ text: textPrompt }];
    if (inlineReference?.data) {
      parts.push({
        inlineData: {
          mimeType: inlineReference.mimeType,
          data: inlineReference.data,
        },
      });
    }

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
  const pixazoKey = process.env.PIXAZO_SUBSCRIPTION_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());

  // For sketch-to-image enhancement, Gemini multimodal is the most reliable path.
  if (referenceImageUrl && geminiKey) {
    try {
      const images = await generateWithGemini(refVariants, geminiKey, referenceImageUrl);
      if (images.length > 0) {
        return { provider: "gemini", images };
      }
    } catch (err) {
      console.warn("[Gemini] reference enhancement failed, falling back", err);
    }
  }

  if (pixazoKey) {
    try {
      const images = await generateWithPixazo(variants, pixazoKey);
      if (images.length > 0) {
        return { provider: "pixazo", images };
      }
    } catch (err) {
      console.warn("[Pixazo] image generation failed, falling back", err);
    }
  }

  if (hasReplicate) {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const images: string[] = [];

    for (const variant of variants) {
      let done = false;
      let attempts = 0;

      while (!done && attempts < 3) {
        attempts += 1;
        try {
          const output = await replicate.run("black-forest-labs/flux-1.1-pro", {
            input: {
              prompt: variant,
              aspect_ratio: "1:1",
              output_format: "jpg",
              output_quality: 90,
              safety_tolerance: 2,
            },
          });

          const raw = Array.isArray(output) ? output[0] : output;
          let imageUrl = "";
          if (raw != null) {
            if (typeof (raw as { url?: () => URL }).url === "function") {
              imageUrl = (raw as { url: () => URL }).url().href;
            } else {
              imageUrl = String(raw);
            }
          }

          console.log("[Replicate] url:", imageUrl);
          if (imageUrl.startsWith("http")) {
            images.push(imageUrl);
          }

          done = true;
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          const retryAfterRaw = (err as { response?: { headers?: { get?: (k: string) => string | null } } })?.response?.headers?.get?.("retry-after");
          const retryAfterSec = Number(retryAfterRaw ?? "0");

          if (status === 429) {
            const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 + 250 : 5500;
            console.warn("[Replicate] rate-limited; waiting", waitMs, "ms before retry");
            await sleep(waitMs);
            continue;
          }

          console.warn("[Replicate] call failed (status", status ?? "unknown", "), skipping variant");
          done = true;
        }
      }
    }

    if (images.length > 0) {
      while (images.length < variants.length) {
        const base = images[images.length % Math.max(images.length, 1)] ?? images[0];
        images.push(base);
      }
      return { provider: "replicate", images };
    }
  }

  if (geminiKey) {
    try {
      const images = await generateWithGemini(variants, geminiKey, referenceImageUrl || undefined);
      if (images.length > 0) {
        return { provider: "gemini", images };
      }
    } catch (err) {
      console.warn("[Gemini] image generation failed, falling back", err);
    }
  }

  if (prompt) {
    const seeds = [101, 202, 303];
    return {
      provider: "pollinations",
      images: variants.map((variant, index) => pollinationsUrl(variant, seeds[index] ?? 999)),
    };
  }

  return {
    provider: "mock",
    images: [
      "https://picsum.photos/seed/jewelry-a/1024/1024",
      "https://picsum.photos/seed/jewelry-b/1024/1024",
      "https://picsum.photos/seed/jewelry-c/1024/1024",
    ],
  };
}
