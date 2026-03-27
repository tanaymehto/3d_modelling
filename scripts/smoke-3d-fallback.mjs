import { generate3DModel } from "../src/lib/ai/model-3d-generator";

const testImage = "https://replicate.delivery/xezq/EO1FUOMLV04dOBmSca1t2OVpkQ3BtFnLYYHtfIW0WzenE5UWA/tmptife3llo.jpg";

try {
  const result = await generate3DModel({ imageUrl: testImage });
  console.log("OK", result.provider, result.modelUrl.slice(0, 120));
} catch (error) {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
}
