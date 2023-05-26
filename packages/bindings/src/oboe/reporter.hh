#ifndef _REPORTER_HH_
#define _REPORTER_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsReporter : public swo::Class<JsReporter, Reporter> {
  public:
    JsReporter(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    Napi::Value get__init_status(swo::CallbackInfo const info);

    Napi::Value sendReport(swo::CallbackInfo const info);
    Napi::Value sendStatus(swo::CallbackInfo const info);
    Napi::Value flush(swo::CallbackInfo const info);
    Napi::Value getType(swo::CallbackInfo const info);
};

#endif
