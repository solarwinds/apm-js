#ifndef _SPAN_HH_
#define _SPAN_HH_

#include <napi.h>
#include <oboe_api.h>

#include "util.hh"

class JsSpan : public swo::Class<JsSpan, Span, swo::ClassType::Static> {
  public:
    JsSpan(swo::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value createSpan(swo::CallbackInfo const info);

    static Napi::Value createHttpSpan(swo::CallbackInfo const info);
};

#endif
