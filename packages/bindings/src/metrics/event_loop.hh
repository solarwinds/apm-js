#include <cstdint>

#include <napi.h>
#include <uv.h>

#include "../util.hh"

namespace {

struct CallbackData {
    uint64_t latency;
};
void call_js_callback(Napi::Env env, Napi::Function cb, std::nullopt_t*, CallbackData* data) {
    if (env != nullptr) {
        cb.Call({Napi::Number::New(env, data->latency)});
    }
    delete data;
}
typedef Napi::TypedThreadSafeFunction<std::nullopt_t, CallbackData, call_js_callback> js_callback;

struct EventLoopData {
    js_callback callback;
    unsigned int granularity;

    uint64_t prev_check_time;
    uint64_t prepare_time;
    int poll_timeout;

    uint64_t latency;
    unsigned int count;
};

static uv_prepare_t prepare_handle{};
static uv_check_t check_handle{};
static bool set{false};

void prepare_callback(uv_prepare_t* handle) {
    uint64_t prepare_time = uv_hrtime();

    auto data = static_cast<EventLoopData*>(handle->data);

    data->prepare_time = prepare_time;
    data->poll_timeout = uv_backend_timeout(uv_default_loop());
}

void check_callback(uv_check_t* handle) {
    uint64_t check_time = uv_hrtime();

    auto data = static_cast<EventLoopData*>(handle->data);
    if (data->prev_check_time == 0) {
        data->prev_check_time = check_time;
        return;
    }

    uint64_t latency = data->prepare_time - data->prev_check_time;

    uint64_t poll_time = check_time - data->prepare_time;
    uint64_t timeout = data->poll_timeout * 1000 * 1000;
    if (poll_time > timeout) {
        latency += poll_time - timeout;
    }

    data->prev_check_time = check_time;
    data->latency += latency;
    if (data->count++ < data->granularity) {
        return;
    }

    data->callback.BlockingCall(new CallbackData{data->latency});
    data->latency = 0;
    data->count = 0;
}

Napi::Value set_callback(swo::CallbackInfo const info) {
    auto arg = info.arg<Napi::Value>(0);

    if (set) {
        auto data = static_cast<EventLoopData*>(prepare_handle.data);

        uv_prepare_stop(&prepare_handle);
        uv_check_stop(&check_handle);

        data->callback.Release();
        delete data;
    }

    if (!arg.IsNull()) {
        auto callback =
            js_callback::New(info, arg.As<Napi::Function>(), "Event Loop Callback", 0, 1);
        auto granularity = info.arg<unsigned int>(1);

        uv_prepare_init(uv_default_loop(), &prepare_handle);
        uv_check_init(uv_default_loop(), &check_handle);

        auto data = new EventLoopData{
            .callback = std::move(callback),
            .granularity = granularity,
            .prev_check_time = 0,
            .count = 0,
        };
        prepare_handle.data = data;
        check_handle.data = data;

        uv_prepare_start(&prepare_handle, prepare_callback);
        uv_check_start(&check_handle, check_callback);

        set = true;
    } else {
        set = false;
    }

    return info.undefined();
}

} // namespace

swo::Object event_loop(swo::Object exports) {
    exports.set("setCallback", set_callback);
    return exports;
}
