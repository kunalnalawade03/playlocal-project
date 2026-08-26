import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq, inArray, lt, ne } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  AnalyzeSkillVideoBody,
  CreateGameBody,
  CreateGroupBody,
  GetPlaceParams,
  JoinGameParams,
  JoinGroupParams,
  UpdateProfileBody,
} from "@workspace/api-zod";
import {
  db,
  gamesTable,
  gameMembershipsTable,
  groupMembershipsTable,
  groupsTable,
  placesTable,
  playersTable,
} from "@workspace/db";

const router: IRouter = Router();

const getUserId = (req: Parameters<Parameters<typeof router.get>[1]>[0]) =>
  getAuth(req).userId;

const requireUser: RequestHandler = (req, res, next) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.locals.userId = userId;
  next();
};

async function getOrCreateProfile(userId: string) {
  const [existing] = await db.select().from(playersTable).where(eq(playersTable.id, userId));
  if (existing) return existing;
  const [created] = await db.insert(playersTable).values({
    id: userId,
    name: "New Player",
    avatar: "NP",
    city: "",
    sports: [],
    level: "Getting started",
    verified: false,
    bio: "Tell your local sports community a little about you.",
    achievements: [],
    videos: [],
    lookingFor: "Friendly games nearby",
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [concurrentProfile] = await db.select().from(playersTable).where(eq(playersTable.id, userId));
  if (!concurrentProfile) throw new Error("Profile creation did not complete.");
  return concurrentProfile;
}

const formatGameDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));

const mapPlace = (place: typeof placesTable.$inferSelect) => ({
  id: place.id,
  name: place.name,
  sports: place.sports,
  distance: place.distance,
  address: place.address,
  latitude: Number(place.latitude),
  longitude: Number(place.longitude),
  accent: place.accent,
});

const mapGame = (game: typeof gamesTable.$inferSelect, joined = false) => ({
  id: game.id,
  placeId: game.placeId,
  placeName: game.placeName,
  sport: game.sport,
  title: game.title,
  host: game.host,
  players: game.players,
  playerLimit: game.playerLimit,
  time: game.time,
  date: formatGameDate(game.gameDate),
  noFixedTime: game.noFixedTime,
  skillLevel: game.skillLevel,
  joined,
});

const mapGroup = (group: typeof groupsTable.$inferSelect, joined = false) => ({
  id: group.id,
  sport: group.sport,
  name: group.name,
  description: group.description,
  members: group.members,
  memberLimit: group.memberLimit,
  location: group.location,
  timing: group.timing,
  joined,
  host: group.host,
});

const mapPlayer = (player: typeof playersTable.$inferSelect) => ({
  id: player.id,
  name: player.name,
  avatar: player.avatar,
  city: player.city,
  sports: player.sports,
  level: player.level,
  verified: player.verified,
  bio: player.bio,
  achievements: player.achievements,
  videos: player.videos,
  lookingFor: player.lookingFor,
});

router.get("/places", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const profile = userId ? await getOrCreateProfile(userId) : null;
    const places = profile?.city
      ? await db.select().from(placesTable).where(eq(placesTable.city, profile.city))
      : await db.select().from(placesTable);
    res.json(places.map(mapPlace));
  } catch (error) {
    next(error);
  }
});

router.get("/places/:placeId", async (req, res, next) => {
  try {
    const { placeId } = GetPlaceParams.parse(req.params);
    const [place] = await db.select().from(placesTable).where(eq(placesTable.id, placeId));
    if (!place) {
      res.status(404).json({ error: "Place not found" });
      return;
    }
    const games = await db.select().from(gamesTable).where(eq(gamesTable.placeId, placeId));
    const userId = getUserId(req);
    const memberships = userId && games.length
      ? await db.select({ gameId: gameMembershipsTable.gameId }).from(gameMembershipsTable)
          .where(and(eq(gameMembershipsTable.playerId, userId), inArray(gameMembershipsTable.gameId, games.map((game) => game.id))))
      : [];
    const joinedIds = new Set(memberships.map((membership) => membership.gameId));
    res.json({ ...mapPlace(place), games: games.map((game) => mapGame(game, joinedIds.has(game.id))) });
  } catch (error) {
    next(error);
  }
});

router.get("/places/:placeId/games", async (req, res, next) => {
  try {
    const { placeId } = GetPlaceParams.parse(req.params);
    const games = await db.select().from(gamesTable).where(eq(gamesTable.placeId, placeId));
    const userId = getUserId(req);
    const memberships = userId && games.length
      ? await db.select({ gameId: gameMembershipsTable.gameId }).from(gameMembershipsTable)
          .where(and(eq(gameMembershipsTable.playerId, userId), inArray(gameMembershipsTable.gameId, games.map((game) => game.id))))
      : [];
    const joinedIds = new Set(memberships.map((membership) => membership.gameId));
    res.json(games.map((game) => mapGame(game, joinedIds.has(game.id))));
  } catch (error) {
    next(error);
  }
});

router.post("/games", requireUser, async (req, res, next) => {
  try {
    const input = CreateGameBody.parse(req.body);
    const userId = res.locals.userId as string;
    const profile = await getOrCreateProfile(userId);

    const [game] = await db
      .insert(gamesTable)
      .values({
        id: `game-${crypto.randomUUID()}`,
        placeId: input.placeId,
        placeName: input.placeName,
        sport: input.sport,
        title: input.title,
        host: profile.name,
        players: 1,
        playerLimit: input.playerLimit,
        time: input.time || "No fixed time",
        gameDate: input.date,
        noFixedTime: input.noFixedTime,
        skillLevel: input.skillLevel,
        joined: true,
      })
      .returning();
    await db.insert(gameMembershipsTable).values({ gameId: game.id, playerId: userId });
    res.status(201).json(mapGame(game, true));
  } catch (error) {
    next(error);
  }
});

router.post("/games/:gameId/join", requireUser, async (req, res, next) => {
  try {
    const { gameId } = JoinGameParams.parse(req.params);
    const [existing] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    const userId = res.locals.userId as string;
    await getOrCreateProfile(userId);
    const [membership] = await db.select().from(gameMembershipsTable)
      .where(and(eq(gameMembershipsTable.gameId, gameId), eq(gameMembershipsTable.playerId, userId)));
    if (membership) {
      res.json(mapGame(existing, true));
      return;
    }
    const [game] = await db
      .update(gamesTable)
      .set({ players: existing.players + 1, updatedAt: new Date() })
      .where(and(eq(gamesTable.id, gameId), lt(gamesTable.players, gamesTable.playerLimit)))
      .returning();
    if (!game) {
      res.status(409).json({ error: "This game is full" });
      return;
    }
    await db.insert(gameMembershipsTable).values({ gameId, playerId: userId });
    res.json(mapGame(game, true));
  } catch (error) {
    next(error);
  }
});

router.get("/groups", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const profile = userId ? await getOrCreateProfile(userId) : null;
    const groups = profile?.city
      ? await db.select().from(groupsTable).where(eq(groupsTable.city, profile.city))
      : await db.select().from(groupsTable);
    const memberships = userId && groups.length
      ? await db.select({ groupId: groupMembershipsTable.groupId }).from(groupMembershipsTable)
          .where(and(eq(groupMembershipsTable.playerId, userId), inArray(groupMembershipsTable.groupId, groups.map((group) => group.id))))
      : [];
    const joinedIds = new Set(memberships.map((membership) => membership.groupId));
    res.json(groups.map((group) => mapGroup(group, joinedIds.has(group.id))));
  } catch (error) {
    next(error);
  }
});

router.post("/groups", requireUser, async (req, res, next) => {
  try {
    const input = CreateGroupBody.parse(req.body);
    const userId = res.locals.userId as string;
    const profile = await getOrCreateProfile(userId);
    const [group] = await db
      .insert(groupsTable)
      .values({
        id: `group-${crypto.randomUUID()}`,
        sport: input.sport,
        name: input.name,
        description: input.description,
        members: 1,
        memberLimit: input.memberLimit,
        city: profile.city || "Bengaluru",
        location: input.location || "Location to decide together",
        timing: input.timing || "Flexible",
        joined: true,
        host: profile.name,
      })
      .returning();
    await db.insert(groupMembershipsTable).values({ groupId: group.id, playerId: userId });
    res.status(201).json(mapGroup(group, true));
  } catch (error) {
    next(error);
  }
});

router.post("/groups/:groupId/join", requireUser, async (req, res, next) => {
  try {
    const { groupId } = JoinGroupParams.parse(req.params);
    const [existing] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
    if (!existing) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    const userId = res.locals.userId as string;
    await getOrCreateProfile(userId);
    const [membership] = await db.select().from(groupMembershipsTable)
      .where(and(eq(groupMembershipsTable.groupId, groupId), eq(groupMembershipsTable.playerId, userId)));
    if (membership) {
      res.json(mapGroup(existing, true));
      return;
    }
    const [group] = await db
      .update(groupsTable)
      .set({ members: existing.members + 1, updatedAt: new Date() })
      .where(and(eq(groupsTable.id, groupId), lt(groupsTable.members, groupsTable.memberLimit)))
      .returning();
    if (!group) {
      res.status(409).json({ error: "This group is full" });
      return;
    }
    await db.insert(groupMembershipsTable).values({ groupId, playerId: userId });
    res.json(mapGroup(group, true));
  } catch (error) {
    next(error);
  }
});

router.get("/players", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const profile = userId ? await getOrCreateProfile(userId) : null;
    const players = profile?.city
      ? await db.select().from(playersTable).where(and(ne(playersTable.id, userId!), eq(playersTable.city, profile.city)))
      : userId
        ? await db.select().from(playersTable).where(ne(playersTable.id, userId))
        : await db.select().from(playersTable).where(ne(playersTable.id, "me"));
    res.json(players.map(mapPlayer));
  } catch (error) {
    next(error);
  }
});

router.get("/profile", requireUser, async (req, res, next) => {
  try {
    const profile = await getOrCreateProfile(res.locals.userId as string);
    res.json(mapPlayer(profile));
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", requireUser, async (req, res, next) => {
  try {
    const input = UpdateProfileBody.parse(req.body);
    const [profile] = await db
      .update(playersTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(playersTable.id, res.locals.userId as string))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(mapPlayer(profile));
  } catch (error) {
    next(error);
  }
});

router.post("/profile/analyze", requireUser, async (req, res) => {
  const input = AnalyzeSkillVideoBody.parse(req.body);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Video analysis is not configured yet." });
    return;
  }

  if (!input.contentType.startsWith("video/")) {
    res.status(400).json({ error: "Please upload a video file." });
    return;
  }

  const videoBase64 = input.videoBase64.replace(/^data:[^;]+;base64,/, "");
  const padding = videoBase64.endsWith("==") ? 2 : videoBase64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.max(0, Math.floor((videoBase64.length * 3) / 4) - padding);
  if (decodedBytes > 8 * 1024 * 1024) {
    res.status(413).json({ error: "Please upload a video under 8 MB." });
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: "Analyze this short sports skill clip. Return only valid JSON with keys summary (string), strengths (array of 2-4 short strings), focus (array of 1-3 short strings), and confidence (one of High, Medium, Low). Be encouraging but specific. Do not infer identity or sensitive traits." },
            { inline_data: { mime_type: input.contentType, data: videoBase64 } },
          ] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
        }),
      },
    );

    if (!response.ok) {
      const providerError = await response.text();
      req.log.error(
        { status: response.status, providerError: providerError.slice(0, 500) },
        "Gemini skill analysis failed",
      );
      res.status(502).json({ error: "The video could not be analyzed right now." });
      return;
    }
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "The analysis returned no summary." });
      return;
    }
    res.json(JSON.parse(text));
  } catch (error) {
    req.log.error({ err: error }, "Skill analysis request failed");
    res.status(502).json({ error: "The video could not be analyzed right now." });
  }
});

export default router;