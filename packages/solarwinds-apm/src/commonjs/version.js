/* eslint-disable */
"use strict";

var fs = require("fs");
var path = require("path");
var process = require("process");

try {
  if (
    typeof process.version !== "string" ||
    process.version.substring(0, 2) === "v0"
  ) {
    throw "UPDATE YOUR NODE.JS VERSION IMMEDIATELY.";
  }

  var file = require.resolve(
    "node-releases/data/release-schedule/release-schedule.json"
  );
  var versions = JSON.parse(fs.readFileSync(file, { encoding: "utf8" }));
  for (var major in versions) {
    if (process.version.substring(0, major.length) !== major) {
      continue;
    }

    var eol = new Date(versions[major].end);

    var elapsed = Date.now() - eol.getTime();
    if (elapsed > 1000 * 60 * 60 * 24 * 365) {
      var message =
        "The detected Node.js version (" +
        process.version +
        ") has reached End Of Life over one year ago (" +
        versions[major].end +
        "). It is no longer supported by this library (solarwinds-apm) and the application will not be instrumented. " +
        "SolarWinds STRONGLY recommends customers use a non-EOL Node.js version receiving security updates.";

      throw message;
    } else if (elapsed > 0) {
      var message =
        "The detected Node.js version (" +
        process.version +
        ") has reached End Of Life (" +
        versions[major].end +
        "). It is still supported by this library (solarwinds-apm) for one year following this date. " +
        "SolarWinds STRONGLY recommends customers use a non-EOL Node.js version receiving security updates.";

      throw message;
    }
  }

  module.exports = true;
} catch (error) {
  console.warn(error);
  module.exports = false;
}

try {
  var node = process.versions.node;
  console.log("Node.js " + node);

  var solarwinds = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../package.json"), {
      encoding: "utf8"
    })
  ).version;
  console.log("solarwinds-apm " + solarwinds);

  var otel = require("@opentelemetry/core").VERSION;
  console.log("@opentelemetry/core " + otel);
} catch (_error) {}
