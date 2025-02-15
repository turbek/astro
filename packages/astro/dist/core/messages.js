import {
  bgCyan,
  bgGreen,
  bgRed,
  bgWhite,
  bgYellow,
  black,
  bold,
  cyan,
  dim,
  green,
  red,
  underline,
  yellow
} from "kleur/colors";
import { getDocsForError, renderErrorMarkdown } from "./errors/dev/utils.js";
import {
  AstroError,
  AstroUserError,
  CompilerError
} from "./errors/index.js";
import { emoji, padMultilineString } from "./util.js";
const PREFIX_PADDING = 6;
function req({
  url,
  statusCode,
  reqTime
}) {
  let color = dim;
  if (statusCode >= 500)
    color = red;
  else if (statusCode >= 400)
    color = yellow;
  else if (statusCode >= 300)
    color = dim;
  else if (statusCode >= 200)
    color = green;
  return `${bold(color(`${statusCode}`.padStart(PREFIX_PADDING)))} ${url.padStart(40)} ${reqTime ? dim(Math.round(reqTime) + "ms") : ""}`.trim();
}
function reload({ file }) {
  return `${green("reload".padStart(PREFIX_PADDING))} ${file}`;
}
function hmr({ file, style = false }) {
  return `${green("update".padStart(PREFIX_PADDING))} ${file}${style ? ` ${dim("style")}` : ""}`;
}
function serverStart({
  startupTime,
  resolvedUrls,
  host,
  base,
  isRestart = false
}) {
  const version = "3.1.4";
  const localPrefix = `${dim("\u2503")} Local    `;
  const networkPrefix = `${dim("\u2503")} Network  `;
  const emptyPrefix = " ".repeat(11);
  const localUrlMessages = resolvedUrls.local.map((url, i) => {
    return `${i === 0 ? localPrefix : emptyPrefix}${bold(cyan(new URL(url).origin + base))}`;
  });
  const networkUrlMessages = resolvedUrls.network.map((url, i) => {
    return `${i === 0 ? networkPrefix : emptyPrefix}${bold(cyan(new URL(url).origin + base))}`;
  });
  if (networkUrlMessages.length === 0) {
    const networkLogging = getNetworkLogging(host);
    if (networkLogging === "host-to-expose") {
      networkUrlMessages.push(`${networkPrefix}${dim("use --host to expose")}`);
    } else if (networkLogging === "visible") {
      networkUrlMessages.push(`${networkPrefix}${dim("unable to find network to expose")}`);
    }
  }
  const messages = [
    `${emoji("\u{1F680} ", "")}${bgGreen(black(` astro `))} ${green(`v${version}`)} ${dim(
      `${isRestart ? "re" : ""}started in ${Math.round(startupTime)}ms`
    )}`,
    "",
    ...localUrlMessages,
    ...networkUrlMessages,
    ""
  ];
  return messages.filter((msg) => typeof msg === "string").map((msg) => `  ${msg}`).join("\n");
}
function telemetryNotice(packageManager = "npm") {
  const headline = `${cyan("\u25C6")} Astro collects completely anonymous usage data.`;
  const why = dim("  This optional program helps shape our roadmap.");
  const disable = dim(`  Run \`${packageManager} run astro telemetry disable\` to opt-out.`);
  const details = `  Details: ${underline("https://astro.build/telemetry")}`;
  return [headline, why, disable, details].map((v) => "  " + v).join("\n");
}
function telemetryEnabled() {
  return `${green("\u25C9")} Anonymous telemetry is now ${bgGreen(black(" enabled "))}
  ${dim(
    "Thank you for improving Astro!"
  )}
`;
}
function telemetryDisabled() {
  return `${yellow("\u25EF")} Anonymous telemetry is now ${bgYellow(black(" disabled "))}
  ${dim(
    "We won't ever record your usage data."
  )}
`;
}
function telemetryReset() {
  return `${cyan("\u25C6")} Anonymous telemetry has been ${bgCyan(black(" reset "))}
  ${dim(
    "You may be prompted again."
  )}
`;
}
function fsStrictWarning() {
  return yellow(
    "\u26A0\uFE0F Serving with vite.server.fs.strict: false. Note that all files on your machine will be accessible to anyone on your network!"
  );
}
function prerelease({ currentVersion }) {
  const tag = currentVersion.split("-").slice(1).join("-").replace(/\..*$/, "");
  const badge = bgYellow(black(` ${tag} `));
  const headline = yellow(`\u25B6 This is a ${badge} prerelease build`);
  const warning = `  Feedback? ${underline("https://astro.build/issues")}`;
  return [headline, warning, ""].map((msg) => `  ${msg}`).join("\n");
}
function success(message, tip) {
  const badge = bgGreen(black(` success `));
  const headline = green(message);
  const footer = tip ? `
  \u25B6 ${tip}` : void 0;
  return ["", `${badge} ${headline}`, footer].filter((v) => v !== void 0).map((msg) => `  ${msg}`).join("\n");
}
function failure(message, tip) {
  const badge = bgRed(black(` error `));
  const headline = red(message);
  const footer = tip ? `
  \u25B6 ${tip}` : void 0;
  return ["", `${badge} ${headline}`, footer].filter((v) => v !== void 0).map((msg) => `  ${msg}`).join("\n");
}
function cancelled(message, tip) {
  const badge = bgYellow(black(` cancelled `));
  const headline = yellow(message);
  const footer = tip ? `
  \u25B6 ${tip}` : void 0;
  return ["", `${badge} ${headline}`, footer].filter((v) => v !== void 0).map((msg) => `  ${msg}`).join("\n");
}
const LOCAL_IP_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1"]);
function getNetworkLogging(host) {
  if (host === false) {
    return "host-to-expose";
  } else if (typeof host === "string" && LOCAL_IP_HOSTS.has(host)) {
    return "none";
  } else {
    return "visible";
  }
}
function formatConfigErrorMessage(err) {
  const errorList = err.issues.map(
    (issue) => `  ! ${bold(issue.path.join("."))}  ${red(issue.message + ".")}`
  );
  return `${red("[config]")} Astro found issue(s) with your configuration:
${errorList.join(
    "\n"
  )}`;
}
function formatErrorMessage(err, args = []) {
  const isOurError = AstroError.is(err) || CompilerError.is(err) || AstroUserError.is(err);
  args.push(
    `${bgRed(black(` error `))}${red(
      padMultilineString(isOurError ? renderErrorMarkdown(err.message, "cli") : err.message)
    )}`
  );
  if (err.hint) {
    args.push(`  ${bold("Hint:")}`);
    args.push(
      yellow(padMultilineString(isOurError ? renderErrorMarkdown(err.hint, "cli") : err.hint, 4))
    );
  }
  const docsLink = getDocsForError(err);
  if (docsLink) {
    args.push(`  ${bold("Error reference:")}`);
    args.push(`    ${underline(docsLink)}`);
  }
  if (err.id || err.loc?.file) {
    args.push(`  ${bold("File:")}`);
    args.push(
      red(
        `    ${err.id ?? err.loc?.file}${err.loc?.line && err.loc.column ? `:${err.loc.line}:${err.loc.column}` : ""}`
      )
    );
  }
  if (err.frame) {
    args.push(`  ${bold("Code:")}`);
    args.push(red(padMultilineString(err.frame.trim(), 4)));
  }
  if (args.length === 1 && err.stack) {
    args.push(dim(err.stack));
  } else if (err.stack) {
    args.push(`  ${bold("Stacktrace:")}`);
    args.push(dim(err.stack));
    args.push(``);
  }
  if (err.cause) {
    args.push(`  ${bold("Cause:")}`);
    if (err.cause instanceof Error) {
      args.push(dim(err.cause.stack ?? err.cause.toString()));
    } else {
      args.push(JSON.stringify(err.cause));
    }
    args.push(``);
  }
  return args.join("\n");
}
function printHelp({
  commandName,
  headline,
  usage,
  tables,
  description
}) {
  const linebreak = () => "";
  const title = (label) => `  ${bgWhite(black(` ${label} `))}`;
  const table = (rows, { padding }) => {
    const split = process.stdout.columns < 60;
    let raw = "";
    for (const row of rows) {
      if (split) {
        raw += `    ${row[0]}
    `;
      } else {
        raw += `${`${row[0]}`.padStart(padding)}`;
      }
      raw += "  " + dim(row[1]) + "\n";
    }
    return raw.slice(0, -1);
  };
  let message = [];
  if (headline) {
    message.push(
      linebreak(),
      `  ${bgGreen(black(` ${commandName} `))} ${green(
        `v${"3.1.4"}`
      )} ${headline}`
    );
  }
  if (usage) {
    message.push(linebreak(), `  ${green(commandName)} ${bold(usage)}`);
  }
  if (tables) {
    let calculateTablePadding2 = function(rows) {
      return rows.reduce((val, [first]) => Math.max(val, first.length), 0) + 2;
    };
    var calculateTablePadding = calculateTablePadding2;
    const tableEntries = Object.entries(tables);
    const padding = Math.max(...tableEntries.map(([, rows]) => calculateTablePadding2(rows)));
    for (const [tableTitle, tableRows] of tableEntries) {
      message.push(linebreak(), title(tableTitle), table(tableRows, { padding }));
    }
  }
  if (description) {
    message.push(linebreak(), `${description}`);
  }
  console.log(message.join("\n") + "\n");
}
export {
  cancelled,
  failure,
  formatConfigErrorMessage,
  formatErrorMessage,
  fsStrictWarning,
  getNetworkLogging,
  hmr,
  prerelease,
  printHelp,
  reload,
  req,
  serverStart,
  success,
  telemetryDisabled,
  telemetryEnabled,
  telemetryNotice,
  telemetryReset
};
