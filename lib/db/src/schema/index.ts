import { boolean, date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const placesTable = pgTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull().default("Bengaluru"),
  sports: text("sports").array().notNull(),
  distance: text("distance").notNull(),
  address: text("address").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accent: text("accent").notNull(),
  ...timestamps,
});

export const gamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  placeId: text("place_id").references(() => placesTable.id),
  placeName: text("place_name").notNull(),
  sport: text("sport").notNull(),
  title: text("title").notNull(),
  host: text("host").notNull(),
  players: integer("players").notNull().default(1),
  playerLimit: integer("player_limit").notNull(),
  time: text("time").notNull(),
  gameDate: date("game_date", { mode: "string" }).notNull(),
  noFixedTime: boolean("no_fixed_time").notNull().default(false),
  skillLevel: text("skill_level").notNull(),
  joined: boolean("joined").notNull().default(false),
  ...timestamps,
});

export const groupsTable = pgTable("interest_groups", {
  id: text("id").primaryKey(),
  sport: text("sport").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  members: integer("members").notNull().default(1),
  memberLimit: integer("member_limit").notNull(),
  city: text("city").notNull().default("Bengaluru"),
  location: text("location").notNull(),
  timing: text("timing").notNull(),
  joined: boolean("joined").notNull().default(false),
  host: text("host").notNull(),
  ...timestamps,
});

export const playersTable = pgTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  city: text("city").notNull(),
  sports: text("sports").array().notNull(),
  level: text("level").notNull(),
  verified: boolean("verified").notNull().default(false),
  bio: text("bio").notNull(),
  achievements: text("achievements").array().notNull(),
  videos: text("videos").array().notNull(),
  lookingFor: text("looking_for").notNull(),
  ...timestamps,
});

export const gameMembershipsTable = pgTable("game_memberships", {
  gameId: text("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.gameId, table.playerId] })]);

export const groupMembershipsTable = pgTable("group_memberships", {
  groupId: text("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.groupId, table.playerId] })]);

export const insertPlaceSchema = createInsertSchema(placesTable).omit({ createdAt: true, updatedAt: true });
export const insertGameSchema = createInsertSchema(gamesTable).omit({ createdAt: true, updatedAt: true });
export const insertGroupSchema = createInsertSchema(groupsTable).omit({ createdAt: true, updatedAt: true });
export const insertPlayerSchema = createInsertSchema(playersTable).omit({ createdAt: true, updatedAt: true });

export type Place = typeof placesTable.$inferSelect;
export type Game = typeof gamesTable.$inferSelect;
export type InterestGroup = typeof groupsTable.$inferSelect;
export type Player = typeof playersTable.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;