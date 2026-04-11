import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  // Nếu là production (trong container deploy), trỏ vào folder dist
  // Nếu là dev, trỏ vào folder src
  schema: process.env.NODE_ENV === 'production' 
    ? "./dist/database/schema.js"  // Đường dẫn sau khi NestJS build xong
    : "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});