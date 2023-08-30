#ifndef _CUSTOM_METRICS_HH_
#define _CUSTOM_METRICS_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsCustomMetrics : public sw::Class<JsCustomMetrics, CustomMetrics, sw::ClassType::Static> {
  public:
    JsCustomMetrics(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value static summary(sw::CallbackInfo const info);

    Napi::Value static increment(sw::CallbackInfo const info);
};

#endif
