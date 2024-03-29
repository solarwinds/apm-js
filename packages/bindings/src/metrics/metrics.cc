#include <napi.h>

#include "event_loop.hh"

#include "../util.hh"

Napi::Object init(Napi::Env env_, Napi::Object exports_) {
    sw::Env env{env_};
    sw::Object exports{exports_};

    exports.set("eventLoop", event_loop(env.object()));

    return exports;
}

NODE_API_MODULE(metrics, init)
