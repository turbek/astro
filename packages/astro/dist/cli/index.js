import * as colors from "kleur/colors";
import yargs from "yargs-parser";
import { ASTRO_VERSION } from "../core/constants.js";
async function printAstroHelp() {
  const { printHelp } = await import("../core/messages.js");
  printHelp({
    commandName: "astro",
    usage: "[command] [...flags]",
    headline: "Build faster websites.",
    tables: {
      Commands: [
        ["add", "Add an integration."],
        ["build", "Build your project and write it to disk."],
        ["check", "Check your project for errors."],
        ["dev", "Start the development server."],
        ["docs", "Open documentation in your web browser."],
        ["info", "List info about your current Astro setup."],
        ["preview", "Preview your build locally."],
        ["sync", "Generate content collection types."],
        ["telemetry", "Configure telemetry settings."]
      ],
      "Global Flags": [
        ["--config <path>", "Specify your config file."],
        ["--root <path>", "Specify your project root folder."],
        ["--site <url>", "Specify your project site."],
        ["--base <pathname>", "Specify your project base."],
        ["--verbose", "Enable verbose logging."],
        ["--silent", "Disable all logging."],
        ["--version", "Show the version number and exit."],
        ["--help", "Show this help message."]
      ]
    }
  });
}
function printVersion() {
  console.log();
  console.log(`  ${colors.bgGreen(colors.black(` astro `))} ${colors.green(`v${ASTRO_VERSION}`)}`);
}
function resolveCommand(flags) {
  const cmd = flags._[2];
  if (flags.version)
    return "version";
  const supportedCommands = /* @__PURE__ */ new Set([
    "add",
    "sync",
    "telemetry",
    "dev",
    "build",
    "preview",
    "check",
    "docs",
    "info"
  ]);
  if (supportedCommands.has(cmd)) {
    return cmd;
  }
  return "help";
}
async function runCommand(cmd, flags) {
  switch (cmd) {
    case "help":
      await printAstroHelp();
      return;
    case "version":
      printVersion();
      return;
    case "info": {
      const { printInfo } = await import("./info/index.js");
      await printInfo({ flags });
      return;
    }
    case "docs": {
      const { docs } = await import("./docs/index.js");
      await docs({ flags });
      return;
    }
    case "telemetry": {
      const { update } = await import("./telemetry/index.js");
      const subcommand = flags._[3]?.toString();
      await update(subcommand, { flags });
      return;
    }
    case "sync": {
      const { sync } = await import("./sync/index.js");
      const exitCode = await sync({ flags });
      return process.exit(exitCode);
    }
  }
  if (flags.verbose) {
    const { enableVerboseLogging } = await import("../core/logger/node.js");
    enableVerboseLogging();
  }
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = cmd === "dev" ? "development" : "production";
  }
  const { notify } = await import("./telemetry/index.js");
  await notify();
  switch (cmd) {
    case "add": {
      const { add } = await import("./add/index.js");
      const packages = flags._.slice(3);
      await add(packages, { flags });
      return;
    }
    case "dev": {
      const { dev } = await import("./dev/index.js");
      const server = await dev({ flags });
      if (server) {
        return await new Promise(() => {
        });
      }
      return;
    }
    case "build": {
      const { build } = await import("./build/index.js");
      await build({ flags });
      return;
    }
    case "preview": {
      const { preview } = await import("./preview/index.js");
      const server = await preview({ flags });
      if (server) {
        return await server.closed();
      }
      return;
    }
    case "check": {
      const { check } = await import("./check/index.js");
      const checkServer = await check(flags);
      if (flags.watch) {
        return await new Promise(() => {
        });
      } else {
        return process.exit(checkServer ? 1 : 0);
      }
    }
  }
  throw new Error(`Error running ${cmd} -- no command found.`);
}
async function cli(args) {
  const flags = yargs(args);
  const cmd = resolveCommand(flags);
  try {
    await runCommand(cmd, flags);
  } catch (err) {
    const { throwAndExit } = await import("./throw-and-exit.js");
    await throwAndExit(cmd, err);
  }
}
export {
  cli
};
