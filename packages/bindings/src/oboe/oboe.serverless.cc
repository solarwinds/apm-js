#include <napi.h>

#include "consts.hh"
#include "debug.hh"
#include "oboe_api.hh"

Napi::Object init(Napi::Env env, Napi::Object exports) {
    exports = init_consts(exports);
    exports = init_debug(exports);
    exports = JsOboeAPI::init(env, exports);
    return exports;
}

NODE_API_MODULE(oboe, init)
