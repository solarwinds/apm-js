#ifndef _METRIC_TAGS_HH_
#define _METRIC_TAGS_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsMetricTags : public sw::Class<JsMetricTags, MetricTags> {
  public:
    JsMetricTags(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value add(sw::CallbackInfo const info);
};

#endif
