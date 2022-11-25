#ifndef _EVENT_HH_
#define _EVENT_HH_

#include <napi.h>
#include <oboe_api.h>

#include "util.hh"

class JsEvent : public swo::Class<JsEvent, Event> {
  public:
    JsEvent(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value addInfo(swo::CallbackInfo const info);

    Napi::Value addEdge(swo::CallbackInfo const info);
    Napi::Value addContextOpId(swo::CallbackInfo const info);

    Napi::Value addHostname(swo::CallbackInfo const info);

    Napi::Value getMetadata(swo::CallbackInfo const info);
    Napi::Value metadataString(swo::CallbackInfo const info);
    Napi::Value opIdString(swo::CallbackInfo const info);

    Napi::Value send(swo::CallbackInfo const info);

    Napi::Value sendProfiling(swo::CallbackInfo const info);

    Napi::Value addSpanRef(swo::CallbackInfo const info);
    Napi::Value addProfileEdge(swo::CallbackInfo const info);

    static Napi::Value startTrace(swo::CallbackInfo const info);
};

#endif
