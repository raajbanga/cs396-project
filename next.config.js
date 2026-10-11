/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // The committed database ships with every server route, so a hosted read-only build has data.
  outputFileTracingIncludes: { "/*": ["./db.sqlite"] },
};

export default config;
