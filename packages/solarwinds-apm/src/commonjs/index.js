/* eslint-disable */
"use strict";

if (require("./version")) {
  var init = Symbol.for("solarwinds-apm / init");
  if (init in global) {
    module.exports = require("./api");
  } else {
    // this will not trigger if customers use the --import flag then use require,
    // it will only trigger if they only ever use require
    console.warn(
      "This library (solarwinds-apm) no longer supports loading via require. " +
        "The application may not be instrumented."
    );
  }
}
