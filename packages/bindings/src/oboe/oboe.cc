#include <napi.h>

#include "context.hh"
#include "custom_metrics.hh"
#include "event.hh"
#include "metadata.hh"
#include "metric_tags.hh"
#include "misc.hh"
#include "reporter.hh"
#include "span.hh"

Napi::Object init(Napi::Env env, Napi::Object exports) {
    exports = init_consts(exports);
    exports = JsMetadata::init(env, exports);
    exports = JsContext::init(env, exports);
    exports = JsEvent::init(env, exports);
    exports = JsSpan::init(env, exports);
    exports = JsMetricTags::init(env, exports);
    exports = JsCustomMetrics::init(env, exports);
    exports = JsReporter::init(env, exports);
    return exports;
}

NODE_API_MODULE(oboe, init)
