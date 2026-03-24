import { db } from "../db/index.js";
import { clearBuckets } from "../middleware/rate-limit.js";
import {
  gridPlacements,
  events,
  tasks,
  plantings,
  catalogEntries,
  spaces,
  seasons,
  gardens,
  harvests,
  photos,
  apiKeys,
  users,
} from "../db/schema.js";
import { app } from "../app.js";

/**
 * Delete all data from all tables in the correct FK order.
 */
export async function cleanDb() {
  clearBuckets();
  await db.delete(photos);
  await db.delete(gridPlacements);
  await db.delete(harvests);
  await db.delete(events);
  await db.delete(tasks);
  await db.delete(plantings);
  await db.delete(catalogEntries);
  await db.delete(spaces);
  await db.delete(seasons);
  await db.delete(gardens);
  await db.delete(apiKeys);
  await db.delete(users);
}

/**
 * Register a user and return the JWT token.
 */
export async function registerUser(
  email = "test@test.com",
  password = "password123",
  name = "Test User",
): Promise<string> {
  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

/**
 * Return Authorization + Content-Type headers for an authenticated request.
 */
export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create a garden and return its id.
 */
export async function createGarden(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request("/api/v1/gardens", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: "Test Garden",
      location: "Backyard",
      hardinessZone: "7b",
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Create a season and return its id.
 */
export async function createSeason(
  token: string,
  gardenId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request(`/api/v1/gardens/${gardenId}/seasons`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      year: 2026,
      name: "Spring",
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Create a space and return its id.
 */
export async function createSpace(
  token: string,
  seasonId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request(`/api/v1/seasons/${seasonId}/spaces`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: "Bed A",
      type: "RaisedBed",
      width: 4,
      length: 8,
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Create a planting and return its id.
 */
export async function createPlanting(
  token: string,
  seasonId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request(`/api/v1/seasons/${seasonId}/plantings`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      crop: "Tomato",
      variety: "Cherokee Purple",
      sourceType: "seed",
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Record a harvest and return its id.
 */
export async function createHarvest(
  token: string,
  seasonId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      crop: "Tomato",
      quantity: 5,
      quantityUnit: "fruits",
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Attach a photo by URL and return its id.
 */
export async function attachPhoto(
  token: string,
  url: string,
  targets: Record<string, string> = {},
): Promise<string> {
  const res = await app.request("/api/v1/photos", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ url, ...targets }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Create a catalog entry and return its id.
 */
export async function createCatalogEntry(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.request("/api/v1/catalog", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      crop: "Tomato",
      variety: "Cherokee Purple",
      ...overrides,
    }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}
