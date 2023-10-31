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

The overall process goes something like
- JS calls `setCallback`
  - The first argument is the JS callback function which receives the latency as its argument
  - The second argument is the granularity
- The `set_callback` C++ implementation of `setCallback` runs
  - First it cleans up any previous state, and returns early if the first argument is null
  - Otherwise it stores the callback passed to it as first argument in a thread-safe function
  - It then initialises the libuv handles and `EventLoopData` and registers the libuv callbacks
    `on_prepare` and `on_check` to run every loop iteration on their respective steps
  - Every `granularity` iterations `on_check` will use the thread-safe function to schedule
    the JS callback passed to `setCallback` earlier to be called with the latency

For instance the following would log the latency every 10 iterations
setCallback((latency) => console.log(latency), 10)
*/

namespace {

struct JsData {
    uint64_t latency;
};

// This is the native code that is put on a queue to be executed from a JS context, from here we are
// able to create JS values and call the actual JS callback
inline void
call_js_callback(Napi::Env env, Napi::Function js_callback, std::nullopt_t*, JsData* data) {
    if (env != nullptr) {
        js_callback.Call({Napi::Number::New(env, data->latency)});
    }
    delete data;
}

typedef Napi::TypedThreadSafeFunction<std::nullopt_t, JsData, call_js_callback> ThreadSafeFunction;

// This is stored as attached data on the libuv handles
struct EventLoopData {
    // Thread-safe function
    ThreadSafeFunction js_callback_scheduler;
    // Number of iterations to sum up before scheduling the callback
    unsigned int granularity;

    // nanos timestamp of the previous check step
    uint64_t prev_check_time;
    // nanos timestamp of the prepare step
    uint64_t prepare_time;
    // millis timeout libuv calculated for the poll
    int poll_timeout;

    // nanos latency sum
    uint64_t latency_sum;
    // iteration count since last callback
    unsigned int iteration_count;
};

inline static uv_prepare_t prepare_handle{};
inline static uv_check_t check_handle{};
// are we currently measuring
inline static bool set{false};

inline void on_prepare(uv_prepare_t* handle) {
    uint64_t prepare_time = uv_hrtime();

    auto data = static_cast<EventLoopData*>(handle->data);

    // store this for use in the check callback math
    data->prepare_time = prepare_time;
    data->poll_timeout = uv_backend_timeout(uv_default_loop());
}

inline void on_check(uv_check_t* handle) {
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
    data->latency_sum += latency;
    if (data->iteration_count++ < data->granularity) {
        return;
    }

    // by calling this we are scheduling `call_js_callback` to be run within a JS context with the
    // provided `JsData`. `call_js_callback` will in turn call the actual JS callback passed to
    // `setCallback` which we can't do here outside of the JS context
    data->js_callback_scheduler.BlockingCall(new JsData{data->latency_sum});

    data->latency_sum = 0;
    data->iteration_count = 0;
}

inline Napi::Value set_callback(sw::CallbackInfo const info) {
    auto arg = info.arg<Napi::Value>(0);

    // if currently enabled, stop the callbacks and clean up the data
    if (set) {
        auto data = static_cast<EventLoopData*>(prepare_handle.data);

        uv_prepare_stop(&prepare_handle);
        uv_check_stop(&check_handle);

        // need to release the thread-safe function first to decrease its reference count so it
        // actually gets freed
        data->js_callback_scheduler.Release();
        delete data;
    }

    if (!arg.IsNull()) {
        // create the thread-safe function with its reference count set to 1
        auto js_callback_scheduler =
            ThreadSafeFunction::New(info, arg.As<Napi::Function>(), "Event Loop Callback", 0, 1);
        // don't prevent node from exiting because of this callback
        js_callback_scheduler.Unref(info);

        auto granularity = info.arg<unsigned int>(1);

        // re.initialise the libuv handles
        uv_prepare_init(uv_default_loop(), &prepare_handle);
        uv_check_init(uv_default_loop(), &check_handle);

        // allocate fresh data to not have skewed measurements if the granularity changed
        auto data = new EventLoopData{
            .js_callback_scheduler = std::move(js_callback_scheduler),
            .granularity = granularity,
            .prev_check_time = 0,
            .iteration_count = 0,
        };
        prepare_handle.data = data;
        check_handle.data = data;

        // actually enable the libuv callbacks
        uv_prepare_start(&prepare_handle, on_prepare);
        uv_check_start(&check_handle, on_check);

        set = true;
    } else {
        set = false;
    }

    return info.undefined();
}

} // namespace

// module initialisation, defines the `setCallback` function
inline sw::Object event_loop(sw::Object exports) {
    exports.set("setCallback", set_callback);
    return exports;
}
