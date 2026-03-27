import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const result = await db.user.updateMany({ data: { imageCredits: 50, modelCredits: 10 } });
console.log("Credits reset for", result.count, "user(s)");
await db.$disconnect();
