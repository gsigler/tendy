import { db } from "../db/index.js";
import {
  conversationMessages,
  conversationSessions,
  gridPlacements,
  events,
  tasks,
  plantings,
  catalogReviews,
  catalogEntries,
  spaces,
  seasons,
  gardens,
  users,
} from "../db/schema.js";

/**
 * Delete all data from all tables in the correct FK order.
 */
export async function cleanDb() {
  await db.delete(conversationMessages);
  await db.delete(conversationSessions);
  await db.delete(gridPlacements);
  await db.delete(catalogReviews);
  await db.delete(events);
  await db.delete(tasks);
  await db.delete(plantings);
  await db.delete(catalogEntries);
  await db.delete(spaces);
  await db.delete(seasons);
  await db.delete(gardens);
  await db.delete(users);
}
