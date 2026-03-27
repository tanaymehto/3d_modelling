import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  const deletedAssets = await db.generatedAsset.deleteMany({
    where: { filePath: { startsWith: "/sample/" } },
  });

  const deletedGenerations = await db.generation.deleteMany({
    where: {
      type: "MODEL_3D",
      assets: { none: {} },
    },
  });

  console.log({
    deletedAssets: deletedAssets.count,
    deletedGenerations: deletedGenerations.count,
  });
} finally {
  await db.$disconnect();
}
