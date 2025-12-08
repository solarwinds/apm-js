/* eslint-disable */
"use strict";

var fs = require("fs");
var path = require("path");
var process = require("process");
var log = require("./log");

var RELEASED = require("./timestamp");
var NOW = Date.now();
var YEAR = 1000 * 60 * 60 * 24 * 365;

try {
  if (
    typeof process.version !== "string" ||
    process.version.substring(0, 2) === "v0"
  ) {
    throw "UPDATE YOUR NODE.JS VERSION IMMEDIATELY.";
  }

  // By default assume the Node version is too recent to be in the releases list
  module.exports = true;

  var file =
    require.resolve("node-releases/data/release-schedule/release-schedule.json");
  var versions = JSON.parse(fs.readFileSync(file, { encoding: "utf8" }));
  for (var major in versions) {
    if (process.version.substring(0, major.length) !== major) {
      continue;
    }

    var lts = "lts" in versions[major];
    var eol = new Date(versions[major].end);

    var maintained = NOW - eol <= 0;
    var supported = RELEASED - eol <= (lts ? YEAR : 0);

    if (!maintained) {
      log(
        "The detected Node.js version (" +
          process.version +
          ") has reached End Of Life (" +
          versions[major].end +
          ")."
      );
      log(
        "SolarWinds STRONGLY recommends customers use a non-EOL Node.js version receiving security updates."
      );
    }
    if (!supported) {
      log(
        "The application will not be instrumented to avoid potential compatibility issues."
      );
    }

    module.exports = supported;
    break;
  }
} catch (error) {
  log(error);
  module.exports = false;
}

try {
  var node = process.versions.node;
  log("Node.js " + node);

  var solarwinds = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../package.json"), {
      encoding: "utf8"
    })
  ).version;
  log("solarwinds-apm " + solarwinds);

  function logVersion(module) {
    var dir = require.resolve(module);
    while (!dir.endsWith(module)) {
      dir = path.dirname(dir);
    }
    var version = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), {
        encoding: "utf8"
      })
    ).version;
    log(module + " " + version);
  }

  logVersion("@opentelemetry/api");
  logVersion("@opentelemetry/core");
  logVersion("@opentelemetry/instrumentation");
} catch (_error) {}
