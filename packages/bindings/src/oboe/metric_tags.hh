#ifndef _METRIC_TAGS_HH_
#define _METRIC_TAGS_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsMetricTags : public swo::Class<JsMetricTags, MetricTags> {
  public:
    JsMetricTags(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value add(swo::CallbackInfo const info);
};

#endif
