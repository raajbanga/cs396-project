import path from "node:path";

export function resolveDatabaseUrl(rawUrl: string) {
  if (!rawUrl.startsWith("file:")) return rawUrl;
  const filePath = rawUrl.slice(5);
  return `file:${
    path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  }`;
}
