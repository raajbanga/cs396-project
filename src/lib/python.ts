import { existsSync } from "node:fs";
import path from "node:path";

/** Node-only. The repo's `.venv` interpreter (has openpyxl) when present, else `python3` on PATH. */
const VENV_PYTHON = path.join(process.cwd(), ".venv", "bin", "python3");
export const PYTHON = existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3";
