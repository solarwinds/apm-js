#include <optional>

#include <napi.h>
#include <oboe_debug.h>

#include "../util.hh"

/*
See ../metrics/event_loop.hh for a detailed explanation of some of the concepts used here.
*/

namespace {

struct JsData {
    int module;
    int level;
    swo::NullableString source_name;
    int source_lineno;
    std::string msg;
};

void call_js_callback(Napi::Env env, Napi::Function js_callback, std::nullopt_t*, JsData* data) {
    if (env != nullptr) {
        auto module = swo::to_value(env, oboe_debug_module_name(data->module));
        auto level = swo::to_value(env, data->level);
        auto source_name = swo::to_value(env, data->source_name);
        auto source_lineno = swo::to_value(env, data->source_lineno);
        auto msg = swo::to_value(env, data->msg);

        js_callback.Call({module, level, source_name, source_lineno, msg});
    }
    delete data;
}

typedef Napi::TypedThreadSafeFunction<std::nullopt_t, JsData, call_js_callback> ThreadSafeFunction;

struct LoggerContext {
    ThreadSafeFunction js_logger_scheduler;
};

void on_log(
    void* context, int module, int level, const char* source_name, int source_lineno,
    const char* msg
) {
    auto ctx = static_cast<LoggerContext*>(context);
    auto data = new JsData{module, level, source_name, source_lineno, msg};
    ctx->js_logger_scheduler.BlockingCall(data);
}

Napi::Value debug_log_add(swo::CallbackInfo const info) {
    auto logger = info.arg<Napi::Function>(0);
    auto level = info.arg<int>(1);

    oboe_debug_log_to_stream(nullptr);

    auto ctx = new LoggerContext();
    ctx->js_logger_scheduler = ThreadSafeFunction::New(info, logger, "oboe logger", 0, 1);
    ctx->js_logger_scheduler.Unref(info);

    auto status = oboe_debug_log_add(on_log, static_cast<void*>(ctx), level);
    if (status != 0) {
        // note that if we don't enter this branch the context is leaked
        // this is voluntary. this function should be called a small and constant number of time
        delete ctx;
    }

    return info.value(status);
}

} // namespace

swo::Object init_debug(swo::Object exports) {
    exports.set("DEBUG_DISABLED", OBOE_DEBUG_DISABLED);
    exports.set("DEBUG_FATAL", OBOE_DEBUG_FATAL);
    exports.set("DEBUG_ERROR", OBOE_DEBUG_ERROR);
    exports.set("DEBUG_WARNING", OBOE_DEBUG_WARNING);
    exports.set("DEBUG_INFO", OBOE_DEBUG_INFO);
    exports.set("DEBUG_LOW", OBOE_DEBUG_LOW);
    exports.set("DEBUG_MEDIUM", OBOE_DEBUG_MEDIUM);
    exports.set("DEBUG_HIGH", OBOE_DEBUG_HIGH);

    exports.set("debug_log_add", debug_log_add);

    return exports;
}
