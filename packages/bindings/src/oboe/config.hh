#ifndef _CONFIG_HH_
#define _CONFIG_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsConfig : public sw::Class<JsConfig, Config, sw::ClassType::Static> {
  public:
    JsConfig(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value checkVersion(sw::CallbackInfo const info);

    static Napi::Value getVersionString(sw::CallbackInfo const info);
};

#endif
