import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "schema.prisma"),
  migrate: {
    adapter: async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      const { Pool } = await import("pg");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const pool = new Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
});
