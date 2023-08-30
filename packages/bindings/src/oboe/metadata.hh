#ifndef _METADATA_HH_
#define _METADATA_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsMetadata : public sw::Class<JsMetadata, Metadata> {
  public:
    JsMetadata(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value createEvent(sw::CallbackInfo const info);

    Napi::Value copy(sw::CallbackInfo const info);
    Napi::Value isValid(sw::CallbackInfo const info);
    Napi::Value isSampled(sw::CallbackInfo const info);

    static Napi::Value makeRandom(sw::CallbackInfo const info);
    static Napi::Value fromString(sw::CallbackInfo const info);

    Napi::Value toString(sw::CallbackInfo const info);
};

#endif
