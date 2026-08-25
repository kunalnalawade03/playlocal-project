import { Router, type IRouter } from "express";
import { and, eq, lt, ne } from "drizzle-orm";
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
  groupsTable,
  placesTable,
  playersTable,
} from "@workspace/db";

const router: IRouter = Router();

const getUserId = (req: Parameters<Parameters<typeof router.get>[1]>[0]) =>
  getAuth(req).userId || "me";

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
  }).returning();
  return created;
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

const mapGame = (game: typeof gamesTable.$inferSelect) => ({
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
  joined: game.joined,
});

const mapGroup = (group: typeof groupsTable.$inferSelect) => ({
  id: group.id,
  sport: group.sport,
  name: group.name,
  description: group.description,
  members: group.members,
  memberLimit: group.memberLimit,
  location: group.location,
  timing: group.timing,
  joined: group.joined,
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
    const profile = await getOrCreateProfile(getUserId(req));
    const places = profile.city
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
    res.json({ ...mapPlace(place), games: games.map(mapGame) });
  } catch (error) {
    next(error);
  }
});

router.get("/places/:placeId/games", async (req, res, next) => {
  try {
    const { placeId } = GetPlaceParams.parse(req.params);
    const games = await db.select().from(gamesTable).where(eq(gamesTable.placeId, placeId));
    res.json(games.map(mapGame));
  } catch (error) {
    next(error);
  }
});

router.post("/games", async (req, res, next) => {
  try {
    const input = CreateGameBody.parse(req.body);
    const profile = await getOrCreateProfile(getUserId(req));
    if (!profile) {
      res.status(503).json({ error: "Profile setup is not ready yet." });
      return;
    }

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
    res.status(201).json(mapGame(game));
  } catch (error) {
    next(error);
  }
});

router.post("/games/:gameId/join", async (req, res, next) => {
  try {
    const { gameId } = JoinGameParams.parse(req.params);
    const [existing] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (existing.joined) {
      res.json(mapGame(existing));
      return;
    }
    const [game] = await db
      .update(gamesTable)
      .set({ players: existing.players + 1, joined: true, updatedAt: new Date() })
      .where(and(eq(gamesTable.id, gameId), lt(gamesTable.players, gamesTable.playerLimit)))
      .returning();
    if (!game) {
      res.status(409).json({ error: "This game is full" });
      return;
    }
    res.json(mapGame(game));
  } catch (error) {
    next(error);
  }
});

router.get("/groups", async (req, res, next) => {
  try {
    const profile = await getOrCreateProfile(getUserId(req));
    const groups = profile.city
      ? (await db.select().from(groupsTable)).filter((group) =>
          !group.location || group.location.toLowerCase().includes(profile.city.toLowerCase()),
        )
      : await db.select().from(groupsTable);
    res.json(groups.map(mapGroup));
  } catch (error) {
    next(error);
  }
});

router.post("/groups", async (req, res, next) => {
  try {
    const input = CreateGroupBody.parse(req.body);
    const profile = await getOrCreateProfile(getUserId(req));
    const [group] = await db
      .insert(groupsTable)
      .values({
        id: `group-${crypto.randomUUID()}`,
        sport: input.sport,
        name: input.name,
        description: input.description,
        members: 1,
        memberLimit: input.memberLimit,
        location: input.location || "Location to decide together",
        timing: input.timing || "Flexible",
        joined: true,
        host: profile.name,
      })
      .returning();
    res.status(201).json(mapGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/groups/:groupId/join", async (req, res, next) => {
  try {
    const { groupId } = JoinGroupParams.parse(req.params);
    const [existing] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
    if (!existing) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (existing.joined) {
      res.json(mapGroup(existing));
      return;
    }
    const [group] = await db
      .update(groupsTable)
      .set({ members: existing.members + 1, joined: true, updatedAt: new Date() })
      .where(and(eq(groupsTable.id, groupId), lt(groupsTable.members, groupsTable.memberLimit)))
      .returning();
    if (!group) {
      res.status(409).json({ error: "This group is full" });
      return;
    }
    res.json(mapGroup(group));
  } catch (error) {
    next(error);
  }
});

router.get("/players", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const profile = await getOrCreateProfile(userId);
    const players = profile.city
      ? await db.select().from(playersTable).where(and(ne(playersTable.id, userId), eq(playersTable.city, profile.city)))
      : await db.select().from(playersTable).where(ne(playersTable.id, userId));
    res.json(players.map(mapPlayer));
  } catch (error) {
    next(error);
  }
});

router.get("/profile", async (req, res, next) => {
  try {
    const profile = await getOrCreateProfile(getUserId(req));
    res.json(mapPlayer(profile));
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", async (req, res, next) => {
  try {
    const input = UpdateProfileBody.parse(req.body);
    const [profile] = await db
      .update(playersTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(playersTable.id, getUserId(req)))
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

router.post("/profile/analyze", async (req, res) => {
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