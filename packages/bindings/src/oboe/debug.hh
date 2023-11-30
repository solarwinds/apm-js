#include <optional>

#include <napi.h>
#include <oboe_debug.h>

#include "../util.hh"

/*
See ../metrics/event_loop.hh for a detailed explanation of some of the concepts used here.
*/

namespace {

struct JsData {
    int level;
    sw::NullableString source_name;
    int source_lineno;
    std::string msg;
};

inline void
call_js_callback(Napi::Env env, Napi::Function js_callback, std::nullopt_t*, JsData* data) {
    if (env != nullptr) {
        auto level = sw::to_value(env, data->level);
        auto source_name = sw::to_value(env, data->source_name);
        auto source_lineno = sw::to_value(env, data->source_lineno);
        auto msg = sw::to_value(env, data->msg);

        js_callback.Call({level, source_name, source_lineno, msg});
    }
    delete data;
}

typedef Napi::TypedThreadSafeFunction<std::nullopt_t, JsData, call_js_callback> ThreadSafeFunction;

struct LoggerContext {
    ThreadSafeFunction js_logger_scheduler;
};

inline void
on_log(void* context, int level, const char* source_name, int source_lineno, const char* msg) {
    auto ctx = static_cast<LoggerContext*>(context);
    auto data = new JsData{level, source_name, source_lineno, msg};
    ctx->js_logger_scheduler.BlockingCall(data);
}

inline Napi::Value debug_log_add(sw::CallbackInfo const info) {
    auto logger = info.arg<Napi::Function>(0);

    auto ctx = new LoggerContext();
    ctx->js_logger_scheduler = ThreadSafeFunction::New(info, logger, "oboe logger", 0, 1);
    ctx->js_logger_scheduler.Unref(info);

    auto status = oboe_debug_log_add(on_log, static_cast<void*>(ctx));
    if (status != 0) {
        // note that if we don't enter this branch the context is leaked
        // this is voluntary. this function should be called a small and constant number of time
        delete ctx;
    }

    return info.value(status);
}

} // namespace

inline sw::Object init_debug(sw::Object exports) {
    exports.set("debug_log_add", debug_log_add);
    return exports;
}
