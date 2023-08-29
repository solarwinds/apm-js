#ifndef _EVENT_HH_
#define _EVENT_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsEvent : public sw::Class<JsEvent, Event> {
  public:
    JsEvent(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value addInfo(sw::CallbackInfo const info);

    Napi::Value addEdge(sw::CallbackInfo const info);
    Napi::Value addContextOpId(sw::CallbackInfo const info);

    Napi::Value addHostname(sw::CallbackInfo const info);

    Napi::Value getMetadata(sw::CallbackInfo const info);
    Napi::Value metadataString(sw::CallbackInfo const info);
    Napi::Value opIdString(sw::CallbackInfo const info);

    Napi::Value send(sw::CallbackInfo const info);

    Napi::Value sendProfiling(sw::CallbackInfo const info);

    Napi::Value addSpanRef(sw::CallbackInfo const info);
    Napi::Value addProfileEdge(sw::CallbackInfo const info);

    static Napi::Value startTrace(sw::CallbackInfo const info);
};

#endif
