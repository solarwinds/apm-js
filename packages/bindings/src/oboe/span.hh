#ifndef _SPAN_HH_
#define _SPAN_HH_

#include <napi.h>
#include <oboe_api.h>

#include "../util.hh"

class JsSpan : public sw::Class<JsSpan, Span, sw::ClassType::Static> {
  public:
    JsSpan(sw::CallbackInfo const info);
    static Napi::Object init(Napi::Env env, Napi::Object exports);

    static Napi::Value createSpan(sw::CallbackInfo const info);

    static Napi::Value createHttpSpan(sw::CallbackInfo const info);
};

#endif
