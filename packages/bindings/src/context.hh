#ifndef _CONTEXT_HH_
#define _CONTEXT_HH_

#include <napi.h>
#include <oboe_api.h>

#include "util.hh"

class JsContext : public swo::Class<JsContext, Context, swo::ClassType::Static> {
  public:
    JsContext(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value setTracingMode(swo::CallbackInfo const info);

    static Napi::Value setTriggerMode(swo::CallbackInfo const info);

    static Napi::Value setDefaultSampleRate(swo::CallbackInfo const info);

    static Napi::Value getDecisions(swo::CallbackInfo const info);

    static Napi::Value get(swo::CallbackInfo const info);

    static Napi::Value toString(swo::CallbackInfo const info);

    static Napi::Value set(swo::CallbackInfo const info);

    static Napi::Value fromString(swo::CallbackInfo const info);

    static Napi::Value copy(swo::CallbackInfo const info);

    static Napi::Value setSampledFlag(swo::CallbackInfo const info);

    static Napi::Value clear(swo::CallbackInfo const info);

    static Napi::Value isValid(swo::CallbackInfo const info);

    static Napi::Value isSampled(swo::CallbackInfo const info);

    static Napi::Value validateTransformServiceName(swo::CallbackInfo const info);

    static Napi::Value shutdown(swo::CallbackInfo const info);

    static Napi::Value isReady(swo::CallbackInfo const info);

    static Napi::Value isLambda(swo::CallbackInfo const info);

    static Napi::Value createEvent(swo::CallbackInfo const info);
    static Napi::Value startTrace(swo::CallbackInfo const info);

    static Napi::Value createEntry(swo::CallbackInfo const info);
    static Napi::Value createExit(swo::CallbackInfo const info);
};

#endif
