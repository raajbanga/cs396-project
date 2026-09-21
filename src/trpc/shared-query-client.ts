import { cache } from "react";

import { createQueryClient } from "./query-client";

/** One React Query client per RSC request (shared by tRPC server helpers and SSR). */
export const getRequestQueryClient = cache(createQueryClient);
