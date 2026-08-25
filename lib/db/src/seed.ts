import { count, eq } from "drizzle-orm";
import { db } from "./index";
import { gamesTable, groupsTable, placesTable, playersTable } from "./schema";

const places = [
  { id: "starlight-turf", name: "Starlight Turf", sports: ["Football", "Cricket"], distance: "1.2 km", address: "12 Orion Avenue, Indiranagar", latitude: "12.9716", longitude: "77.6412", accent: "violet" },
  { id: "aether-courts", name: "Aether Courts", sports: ["Basketball", "Tennis"], distance: "2.5 km", address: "44 100 Feet Road, Koramangala", latitude: "12.9352", longitude: "77.6245", accent: "yellow" },
  { id: "nebula-grounds", name: "Nebula Grounds", sports: ["Hockey", "Football"], distance: "3.8 km", address: "8 Lakeview Cross, HSR Layout", latitude: "12.9116", longitude: "77.6389", accent: "blue" },
  { id: "copper-field", name: "Copper Field", sports: ["Cricket", "Football"], distance: "4.4 km", address: "27 Richmond Town, Bengaluru", latitude: "12.9621", longitude: "77.6014", accent: "orange" },
];

const games = [
  { id: "game-starlight-friday", placeId: "starlight-turf", placeName: "Starlight Turf", sport: "Football", title: "Friday night 5-a-side", host: "Arjun Mehta", players: 8, playerLimit: 10, time: "7:30 PM", gameDate: "2026-08-28", noFixedTime: false, skillLevel: "Intermediate", joined: false },
  { id: "game-starlight-sunday", placeId: "starlight-turf", placeName: "Starlight Turf", sport: "Cricket", title: "Weekend box cricket", host: "Nisha Rao", players: 9, playerLimit: 14, time: "No fixed time", gameDate: "2026-08-30", noFixedTime: true, skillLevel: "Casual", joined: false },
  { id: "game-aether-hoops", placeId: "aether-courts", placeName: "Aether Courts", sport: "Basketball", title: "Pickup hoops after work", host: "Karan Shah", players: 7, playerLimit: 10, time: "6:00 PM", gameDate: "2026-08-25", noFixedTime: false, skillLevel: "Intermediate", joined: false },
  { id: "game-aether-tennis", placeId: "aether-courts", placeName: "Aether Courts", sport: "Tennis", title: "Doubles rotation", host: "Ishita Jain", players: 3, playerLimit: 4, time: "8:00 AM", gameDate: "2026-08-29", noFixedTime: false, skillLevel: "Beginner friendly", joined: false },
  { id: "game-nebula-hockey", placeId: "nebula-grounds", placeName: "Nebula Grounds", sport: "Hockey", title: "Hockey drills + scrimmage", host: "Dev Malhotra", players: 11, playerLimit: 16, time: "6:30 AM", gameDate: "2026-08-29", noFixedTime: false, skillLevel: "Advanced", joined: false },
];

const groups = [
  { id: "group-kabaddi", sport: "Kabaddi", name: "Bengaluru Kabaddi Circle", description: "Looking for raiders and defenders who want to train weekly.", members: 9, memberLimit: 14, location: "Location to decide together", timing: "Evenings, flexible", joined: false, host: "Ravi Kumar" },
  { id: "group-kho-kho", sport: "Kho-Kho", name: "Kho-Kho after work", description: "A friendly group for quick games and learning the ropes.", members: 6, memberLimit: 12, location: "North Bengaluru", timing: "Weekends", joined: true, host: "Sneha Iyer" },
  { id: "group-volleyball", sport: "Volleyball", name: "Volleyball, no pressure", description: "New to the city and looking for a consistent volleyball crew.", members: 7, memberLimit: 10, location: "Location to decide together", timing: "Flexible", joined: false, host: "Aman Kapoor" },
];

const players = [
  { id: "player-tara", name: "Tara Singh", avatar: "TS", city: "Bengaluru", sports: ["Football", "Running"], level: "Advanced", verified: true, bio: "Centre-back who loves a structured session and a good post-game chai.", achievements: ["State league finalist", "Captain, Eastside FC"], videos: ["Defensive positioning · 00:42"], lookingFor: "Strong football teams & practice partners" },
  { id: "player-rahul", name: "Rahul Menon", avatar: "RM", city: "Bengaluru", sports: ["Basketball"], level: "Advanced", verified: true, bio: "Point guard looking for high-intensity runs and a team to train with.", achievements: ["University league MVP", "District 3x3 bronze"], videos: ["Pick-and-roll reads · 01:18"], lookingFor: "Practice partners & serious teams" },
  { id: "player-meera", name: "Meera Joshi", avatar: "MJ", city: "Bengaluru", sports: ["Tennis", "Badminton"], level: "Intermediate", verified: false, bio: "Singles player building consistency and looking for regular match partners.", achievements: ["Club ladder top 10"], videos: ["Forehand footwork · 00:36"], lookingFor: "Tennis practice partners" },
  { id: "me", name: "Aarav Sharma", avatar: "AS", city: "Bengaluru", sports: ["Football", "Cricket"], level: "Intermediate", verified: false, bio: "New in town, always up for a good game and meeting people who play.", achievements: [], videos: [], lookingFor: "Friendly games nearby" },
];

export async function seedDatabase() {
  const [{ value: placeCount }] = await db.select({ value: count() }).from(placesTable);
  if (placeCount === 0) {
    await db.insert(placesTable).values(places);
    await db.insert(gamesTable).values(games);
    await db.insert(groupsTable).values(groups);
    await db.insert(playersTable).values(players);
  } else {
    const [{ value: profileCount }] = await db.select({ value: count() }).from(playersTable).where(eq(playersTable.id, "me"));
    if (profileCount === 0) await db.insert(playersTable).values(players.find((player) => player.id === "me")!);
  }
}