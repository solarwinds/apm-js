#ifndef _CONFIG_HH_
#define _CONFIG_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsConfig : public swo::Class<JsConfig, Config, swo::ClassType::Static> {
  public:
    JsConfig(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value checkVersion(swo::CallbackInfo const info);

    static Napi::Value getVersionString(swo::CallbackInfo const info);
};

#endif
