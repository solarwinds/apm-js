#include <napi.h>

#include "config.hh"
#include "consts.hh"
#include "context.hh"
#include "custom_metrics.hh"
#include "debug.hh"
#include "event.hh"
#include "metadata.hh"
#include "metric_tags.hh"
#include "reporter.hh"
#include "span.hh"

Napi::Object init(Napi::Env env, Napi::Object exports) {
    exports = init_consts(exports);
    exports = init_debug(exports);
    exports = JsMetadata::init(env, exports);
    exports = JsContext::init(env, exports);
    exports = JsEvent::init(env, exports);
    exports = JsSpan::init(env, exports);
    exports = JsMetricTags::init(env, exports);
    exports = JsCustomMetrics::init(env, exports);
    exports = JsReporter::init(env, exports);
    exports = JsConfig::init(env, exports);
    return exports;
}

NODE_API_MODULE(oboe, init)
