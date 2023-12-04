#include "oboe_api.hh"
#include "oboe_api.h"

OboeAPI* from_options(sw::Object const& options) {
    OboeAPIOptions o{};

    auto logging_options = options.get<sw::Object>("logging_options");
    o.logging_options.level = logging_options.get<int>("level");
    o.logging_options.type = logging_options.get<int>("type");

    return new OboeAPI(o);
}

JsOboeAPI::JsOboeAPI(sw::CallbackInfo const info)
    : sw::Class<JsOboeAPI, OboeAPI>(from_options(info.arg<sw::Object>(0)), info) {}
Napi::Object JsOboeAPI::init(Napi::Env env, Napi::Object exports) {
    return define_class("OboeAPI")
        .method<&JsOboeAPI::getTracingDecision>("getTracingDecision")
        .method<&JsOboeAPI::consumeRequestCount>("consumeRequestCount")
        .method<&JsOboeAPI::consumeTokenBucketExhaustionCount>("consumeTokenBucketExhaustionCount")
        .method<&JsOboeAPI::consumeTraceCount>("consumeTraceCount")
        .method<&JsOboeAPI::consumeSampleCount>("consumeSampleCount")
        .method<&JsOboeAPI::consumeThroughTraceCount>("consumeThroughTraceCount")
        .method<&JsOboeAPI::consumeTriggeredTraceCount>("consumeTriggeredTraceCount")
        .method<&JsOboeAPI::getLastUsedSampleRate>("getLastUsedSampleRate")
        .method<&JsOboeAPI::getLastUsedSampleSource>("getLastUsedSampleSource")
        .register_class(env, exports);
}

Napi::Value JsOboeAPI::getTracingDecision(const sw::CallbackInfo info) {
    auto options = info.arg<sw::Object>(0);

    int do_metrics;
    int do_sample;
    int sample_rate;
    int sample_source;
    double bucket_rate;
    double bucket_cap;
    int type;
    int auth;
    std::string status_msg;
    std::string auth_msg;
    int status;

    base->getTracingDecision(
        &do_metrics, &do_sample, &sample_rate, &sample_source, &bucket_rate, &bucket_cap, &type,
        &auth, &status_msg, &auth_msg, &status,

        options.get_optional<sw::NullableString>("in_xtrace").value_or(std::nullopt).data(),
        options.get_optional<sw::NullableString>("tracestate").value_or(std::nullopt).data(),
        options.get_optional<int>("custom_tracing_mode").value_or(OBOE_SETTINGS_UNSET),
        options.get_optional<int>("custom_sample_rate").value_or(OBOE_SETTINGS_UNSET),
        options.get_optional<int>("request_type").value_or(0),
        options.get_optional<int>("custom_trigger_mode").value_or(0),
        options.get_optional<sw::NullableString>("header_options").value_or(std::nullopt).data(),
        options.get_optional<sw::NullableString>("header_signature").value_or(std::nullopt).data(),
        options.get_optional<long>("header_timestamp").value_or(0)
    );

    return info.object()
        .set("do_metrics", do_metrics)
        .set("do_sample", do_sample)
        .set("sample_rate", sample_rate)
        .set("sample_source", sample_source)
        .set("bucket_rate", bucket_rate)
        .set("bucket_cap", bucket_cap)
        .set("type", type)
        .set("auth", auth)
        .set("status_msg", status_msg)
        .set("auth_msg", auth_msg)
        .set("status", status);
}

Napi::Value
counter(sw::CallbackInfo const info, OboeAPI* const api, bool (OboeAPI::*method)(unsigned int&)) {
    unsigned int counter;
    auto valid = (api->*method)(counter);
    if (valid) {
        return info.value(counter);
    } else {
        return info.value(false);
    }
}

Napi::Value JsOboeAPI::consumeRequestCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeRequestCount);
}
Napi::Value JsOboeAPI::consumeTokenBucketExhaustionCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeTokenBucketExhaustionCount);
}
Napi::Value JsOboeAPI::consumeTraceCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeTraceCount);
}
Napi::Value JsOboeAPI::consumeSampleCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeSampleCount);
}
Napi::Value JsOboeAPI::consumeThroughTraceCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeThroughTraceCount);
}
Napi::Value JsOboeAPI::consumeTriggeredTraceCount(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::consumeTriggeredTraceCount);
}

Napi::Value JsOboeAPI::getLastUsedSampleRate(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::getLastUsedSampleRate);
}
Napi::Value JsOboeAPI::getLastUsedSampleSource(sw::CallbackInfo const info) {
    return counter(info, base, &OboeAPI::getLastUsedSampleSource);
}
