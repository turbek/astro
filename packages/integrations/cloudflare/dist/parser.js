import TOML from "@iarna/toml";
import dotenv from "dotenv";
import { findUpSync } from "find-up";
import * as fs from "node:fs";
import { dirname, resolve } from "node:path";
function findWranglerToml(referencePath = process.cwd(), preferJson = false) {
  if (preferJson) {
    return findUpSync(`wrangler.json`, { cwd: referencePath }) ?? findUpSync(`wrangler.toml`, { cwd: referencePath });
  }
  return findUpSync(`wrangler.toml`, { cwd: referencePath });
}
class ParseError extends Error {
  text;
  notes;
  location;
  kind;
  constructor({ text, notes, location, kind }) {
    super(text);
    this.name = this.constructor.name;
    this.text = text;
    this.notes = notes ?? [];
    this.location = location;
    this.kind = kind ?? "error";
  }
}
const TOML_ERROR_NAME = "TomlError";
const TOML_ERROR_SUFFIX = " at row ";
function parseTOML(input, file) {
  try {
    const normalizedInput = input.replace(/\r\n/g, "\n");
    return TOML.parse(normalizedInput);
  } catch (err) {
    const { name, message, line, col } = err;
    if (name !== TOML_ERROR_NAME) {
      throw err;
    }
    const text = message.substring(0, message.lastIndexOf(TOML_ERROR_SUFFIX));
    const lineText = input.split("\n")[line];
    const location = {
      lineText,
      line: line + 1,
      column: col - 1,
      file,
      fileText: input
    };
    throw new ParseError({ text, location });
  }
}
function tryLoadDotEnv(path) {
  try {
    const parsed = dotenv.parse(fs.readFileSync(path));
    return { path, parsed };
  } catch (e) {
  }
}
function loadDotEnv(path) {
  return tryLoadDotEnv(path);
}
function getVarsForDev(config, configPath) {
  const configDir = resolve(dirname(configPath ?? "."));
  const devVarsPath = resolve(configDir, ".dev.vars");
  const loaded = loadDotEnv(devVarsPath);
  if (loaded !== void 0) {
    return {
      ...config.vars,
      ...loaded.parsed
    };
  } else {
    return config.vars;
  }
}
async function getEnvVars() {
  let rawConfig;
  const configPath = findWranglerToml(process.cwd(), false);
  if (!configPath) {
    throw new Error("Could not find wrangler.toml");
  }
  if (configPath?.endsWith("toml")) {
    rawConfig = parseTOML(fs.readFileSync(configPath).toString(), configPath);
  }
  const vars = getVarsForDev(rawConfig, configPath);
  return vars;
}
export {
  getEnvVars,
  loadDotEnv
};
