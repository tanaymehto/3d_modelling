import fs from "fs";
import Replicate from "replicate";

const env = fs.readFileSync(".env", "utf8");
const tokenLine = env
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("REPLICATE_API_TOKEN="));

const token = tokenLine
  ? tokenLine.split("=").slice(1).join("=").replace(/^['\"]|['\"]$/g, "").trim()
  : "";

if (!token) {
  console.error("NO_TOKEN");
  process.exit(1);
}

const replicate = new Replicate({ auth: token });

const models = [
  "adirik/triposr",
  "stability-ai/triposr",
  "camenduru/triposr",
  "fofr/triposr",
  "wzq000/triposr",
  "ashawkey/triposr",
  "cjwbw/triposr",
  "nateraw/triposr",
  "pollinations/triposr",
];

for (const model of models) {
  const [owner, name] = model.split("/");
  try {
    await replicate.models.get(owner, name);
    console.log(model, "OK");
  } catch (error) {
    const status = error?.response?.status ?? "ERR";
    console.log(model, "FAIL", status);
  }
}
