import { blob } from "drizzle-orm/sqlite-core";
import { int } from "drizzle-orm/sqlite-core";
import { text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const httpCacheStatuses = ["dead", "alive"] as const;
export type HttpCacheStatus = (typeof httpCacheStatuses)[number];

export const httpCacheTable = sqliteTable("http_cache", {
  key: text().primaryKey(),
  url: text().notNull(),

  status: text().notNull().default("alive"),
  expiresAt: int({ mode: "timestamp" }).notNull(),
  expirationTtl: int().notNull(),

  lastFetchedAt: int({ mode: "timestamp" }).notNull(),
  lastFetchError: text(),
  lastFetchErrorStreak: int().default(0),

  lastHttpHeaders: text({ mode: "json" }).notNull(),
  lastHttpStatus: int().notNull(),
  lastHttpEtag: text(),

  content: blob({ mode: "buffer" }),
  contentType: text(),
  contentLength: int(),
});

export const feedTable = sqliteTable("feed", {});
