#ifndef _OBOE_API_HH_
#define _OBOE_API_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsOboeAPI : public sw::Class<JsOboeAPI, OboeAPI> {
  public:
    JsOboeAPI(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value getTracingDecision(sw::CallbackInfo const info);

    Napi::Value consumeRequestCount(sw::CallbackInfo const info);
    Napi::Value consumeTokenBucketExhaustionCount(sw::CallbackInfo const info);
    Napi::Value consumeTraceCount(sw::CallbackInfo const info);
    Napi::Value consumeSampleCount(sw::CallbackInfo const info);
    Napi::Value consumeThroughIgnoredCount(sw::CallbackInfo const info);
    Napi::Value consumeThroughTraceCount(sw::CallbackInfo const info);
    Napi::Value consumeTriggeredTraceCount(sw::CallbackInfo const info);

    Napi::Value getLastUsedSampleRate(sw::CallbackInfo const info);
    Napi::Value getLastUsedSampleSource(sw::CallbackInfo const info);
};

#endif
