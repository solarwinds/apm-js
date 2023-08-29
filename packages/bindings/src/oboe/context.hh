#ifndef _CONTEXT_HH_
#define _CONTEXT_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsContext : public sw::Class<JsContext, Context, sw::ClassType::Static> {
  public:
    JsContext(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value setTracingMode(sw::CallbackInfo const info);

    static Napi::Value setTriggerMode(sw::CallbackInfo const info);

    static Napi::Value setDefaultSampleRate(sw::CallbackInfo const info);

    static Napi::Value getDecisions(sw::CallbackInfo const info);

    static Napi::Value get(sw::CallbackInfo const info);

    static Napi::Value toString(sw::CallbackInfo const info);

    static Napi::Value set(sw::CallbackInfo const info);

    static Napi::Value fromString(sw::CallbackInfo const info);

    static Napi::Value copy(sw::CallbackInfo const info);

    static Napi::Value setSampledFlag(sw::CallbackInfo const info);

    static Napi::Value clear(sw::CallbackInfo const info);

    static Napi::Value isValid(sw::CallbackInfo const info);

    static Napi::Value isSampled(sw::CallbackInfo const info);

    static Napi::Value validateTransformServiceName(sw::CallbackInfo const info);

    static Napi::Value shutdown(sw::CallbackInfo const info);

    static Napi::Value isReady(sw::CallbackInfo const info);

    static Napi::Value isLambda(sw::CallbackInfo const info);

    static Napi::Value createEvent(sw::CallbackInfo const info);
    static Napi::Value startTrace(sw::CallbackInfo const info);

    static Napi::Value createEntry(sw::CallbackInfo const info);
    static Napi::Value createExit(sw::CallbackInfo const info);
};

#endif
