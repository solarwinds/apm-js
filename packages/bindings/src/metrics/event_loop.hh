#include <cstdint>

#include <napi.h>
#include <uv.h>

#include "../util.hh"

/*
The Node.js event loop is built on top of libuv and works by registering IO operations and callbacks
for them. Each loop iteration simply polls the IO operations and executes the callback for any that
have completed. This file measures the loop latency, as in the time spent executing callbacks and
other operations between each poll.

The measurement is done by registering prepare and check callbacks with libuv. The prepare step
happens just before polling and the check step happens just after.

The latency is communicated to the JS side using a callback. Since the latency is measured outside
of the JS context where it's not possible to call JS functions, a thread-safe function is used which
will push the call on a queue and schedule it to be executed with all the other callbacks on the
next loop iteration.
*/

namespace {

struct CallbackData {
    uint64_t latency;
};

// This is the native code that is put on a queue to be executed from a JS context, from here we are
// able to create JS values and call the actual JS callback
void call_js_callback(Napi::Env env, Napi::Function cb, std::nullopt_t*, CallbackData* data) {
    if (env != nullptr) {
        cb.Call({Napi::Number::New(env, data->latency)});
    }
    delete data;
}

typedef Napi::TypedThreadSafeFunction<std::nullopt_t, CallbackData, call_js_callback> js_callback;

// This is stored as attached data on the libuv handles
struct EventLoopData {
    // Thread-safe function
    js_callback callback;
    // Number of iterations to sum up before scheduling the callback
    unsigned int granularity;

    // nanos timestamp of the previous check step
    uint64_t prev_check_time;
    // nanos timestamp of the prepare step
    uint64_t prepare_time;
    // millis timeout libuv calculated for the poll
    int poll_timeout;

    // nanos latency sum
    uint64_t latency;
    // iteration count since last callback
    unsigned int count;
};

static uv_prepare_t prepare_handle{};
static uv_check_t check_handle{};
// are we currently measuring
static bool set{false};

void prepare_callback(uv_prepare_t* handle) {
    uint64_t prepare_time = uv_hrtime();

    auto data = static_cast<EventLoopData*>(handle->data);

    // store this for use in the check callback math
    data->prepare_time = prepare_time;
    data->poll_timeout = uv_backend_timeout(uv_default_loop());
}

void check_callback(uv_check_t* handle) {
    uint64_t check_time = uv_hrtime();

    auto data = static_cast<EventLoopData*>(handle->data);
    // we need at least one previous iteration to calculate latency
    if (data->prev_check_time == 0) {
        data->prev_check_time = check_time;
        return;
    }

    uint64_t latency = data->prepare_time - data->prev_check_time;

    // observed polling time between our prepare and check steps
    uint64_t poll_time = check_time - data->prepare_time;
    // convert poll timeout to nanos
    uint64_t timeout = data->poll_timeout * 1000 * 1000;
    // if the observed polling time is greater than the timeout something else blocked and we add
    // the difference
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

    // if currently enabled, stop the callbacks and clean up the data
    if (set) {
        auto data = static_cast<EventLoopData*>(prepare_handle.data);

        uv_prepare_stop(&prepare_handle);
        uv_check_stop(&check_handle);

        // need to release the thread-safe function first to decrease its reference count so it
        // actually gets freed
        data->callback.Release();
        delete data;
    }

    if (!arg.IsNull()) {
        // create the thread-safe function with its reference count set to 1
        auto callback =
            js_callback::New(info, arg.As<Napi::Function>(), "Event Loop Callback", 0, 1);
        auto granularity = info.arg<unsigned int>(1);

        // re.initialise the libuv handles
        uv_prepare_init(uv_default_loop(), &prepare_handle);
        uv_check_init(uv_default_loop(), &check_handle);

        // allocate fresh data to not have skewed measurements if the granularity changed
        auto data = new EventLoopData{
            .callback = std::move(callback),
            .granularity = granularity,
            .prev_check_time = 0,
            .count = 0,
        };
        prepare_handle.data = data;
        check_handle.data = data;

        // actually enable the callbacks
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
