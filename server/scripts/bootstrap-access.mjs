import bcrypt from "bcryptjs";
import { PrismaClient, RoleCode, UserStatus } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

const DEFAULT_ADMIN_EMAIL = "admin@outlethub.local";
const DEFAULT_ADMIN_PASSWORD = "Admin12345!";
const DEFAULT_ADMIN_NAME = "Demo Admin";

async function ensureRoles() {
  const roles = [
    {
      code: RoleCode.SUPER_ADMIN,
      name: "Super Admin",
      description: "Full platform access.",
    },
    {
      code: RoleCode.ADMIN,
      name: "Admin",
      description: "Operational admin access.",
    },
    {
      code: RoleCode.CUSTOMER,
      name: "Customer",
      description: "Marketplace customer access.",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }
}

async function ensureDefaultAdmin() {
  const superAdminRole = await prisma.role.findUnique({
    where: { code: RoleCode.SUPER_ADMIN },
  });

  if (!superAdminRole) {
    throw new Error("Super admin role is missing after bootstrap role creation.");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      fullName: DEFAULT_ADMIN_NAME,
      passwordHash,
      roleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL,
      fullName: DEFAULT_ADMIN_NAME,
      passwordHash,
      roleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.info(`Default admin ready: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

async function main() {
  await ensureRoles();
  await ensureDefaultAdmin();
}

await main()
  .catch((error) => {
    console.error("Access bootstrap failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
