import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();

async function checkJob() {
  const job = await prisma.importJob.findUnique({
    where: { id: "cmqta85ui001uuotc5ngu70qj" },
    include: {
      scraperRun: true
    }
  });
  
  if (job?.scraperRunId) {
    const artifacts = await prisma.scraperArtifact.findMany({
      where: { scraperRunId: job.scraperRunId }
    });
    
    const normalizedArtifact = artifacts.find(a => a.filePath.includes("normalized-products.json"));
    if (normalizedArtifact) {
      try {
        const data = JSON.parse(fs.readFileSync(normalizedArtifact.filePath, 'utf8'));
        console.log(`Found ${data.length} products in artifact`);
        const badProducts = data.filter((p: any) => p.name.includes("Nike Victory") || p.name.includes("Jordan Brooklyn Fleece"));
        console.log("Bad Products:", JSON.stringify(badProducts, null, 2));
      } catch (e) {
        console.log("Could not read artifact file:", normalizedArtifact.filePath, e);
      }
    }
  }
}

checkJob().finally(() => prisma.$disconnect());