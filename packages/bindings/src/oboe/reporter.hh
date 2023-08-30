#ifndef _REPORTER_HH_
#define _REPORTER_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsReporter : public sw::Class<JsReporter, Reporter> {
  public:
    JsReporter(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value get__init_status(sw::CallbackInfo const info);

    Napi::Value sendReport(sw::CallbackInfo const info);
    Napi::Value sendStatus(sw::CallbackInfo const info);
    Napi::Value flush(sw::CallbackInfo const info);
    Napi::Value getType(sw::CallbackInfo const info);
};

#endif
