#ifndef _CUSTOM_METRICS_HH_
#define _CUSTOM_METRICS_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsCustomMetrics : public swo::Class<JsCustomMetrics, CustomMetrics, swo::ClassType::Static> {
  public:
    JsCustomMetrics(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value static summary(swo::CallbackInfo const info);

    Napi::Value static increment(swo::CallbackInfo const info);
};

#endif
