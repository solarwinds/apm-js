"use strict";

/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

module.exports.setTransactionName = function setTransactionName(name) {
  if (api) {
    return api.setTransactionName(name);
  } else {
    return false;
  }
};

module.exports.waitUntilReady = function waitUntilReady(timeout) {
  return imported.then((api) => api.waitUntilReady(timeout));
};

module.exports.forceFlush = function forceFlush() {
  return imported.then((api) => api.forceFlush());
};

/** @type{import("../api")} */
let api = undefined;
const imported = import("../api.js").then((imported) => {
  module.exports.VERSION = imported.VERSION;
  api = imported;
  return imported;
});
