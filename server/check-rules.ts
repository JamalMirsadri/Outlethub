import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRules() {
  const rules = await prisma.importRule.findMany({
    where: { isActive: true }
  });
  console.log("Active Rules:", JSON.stringify(rules, null, 2));
  
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log("Latest Job:", JSON.stringify(jobs, null, 2));
  
  if (jobs.length > 0) {
    const logs = await prisma.importLog.findMany({
      where: { jobId: jobs[0].id }
    });
    console.log("Latest Job Logs:", JSON.stringify(logs, null, 2));
  }
}

checkRules().finally(() => prisma.$disconnect());