// server/routes.ts
import type { Express } from "express";
import { type Server } from "http";
import { registerMiscRoutes } from "./routes/misc";
import { registerReviewRoutes } from "./routes/reviews";
import { registerListingRoutes } from "./routes/listings";
import { registerCoachRoutes } from "./routes/coaches";
import { registerClaimRoutes } from "./routes/claims";
import { registerClubRoutes } from "./routes/clubs";
import { registerEventRoutes } from "./routes/events";
import { registerSponsorRoutes } from "./routes/sponsors";
import { registerAdminRoutes } from "./routes/admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerMiscRoutes(app);
  registerReviewRoutes(app);
  registerListingRoutes(app);
  registerCoachRoutes(app);
  registerClaimRoutes(app);
  registerClubRoutes(app);
  registerEventRoutes(app);
  registerSponsorRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
