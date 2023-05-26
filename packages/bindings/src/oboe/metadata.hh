#ifndef _METADATA_HH_
#define _METADATA_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsMetadata : public swo::Class<JsMetadata, Metadata> {
  public:
    JsMetadata(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value createEvent(swo::CallbackInfo const info);

    Napi::Value copy(swo::CallbackInfo const info);
    Napi::Value isValid(swo::CallbackInfo const info);
    Napi::Value isSampled(swo::CallbackInfo const info);

    static Napi::Value makeRandom(swo::CallbackInfo const info);
    static Napi::Value fromString(swo::CallbackInfo const info);

    Napi::Value toString(swo::CallbackInfo const info);
};

#endif
