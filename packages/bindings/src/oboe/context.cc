#include "context.hh"
#include "event.hh"
#include "metadata.hh"

JsContext::JsContext(sw::CallbackInfo const info)
    : sw::Class<JsContext, Context, sw::ClassType::Static>(info) {}
Napi::Object JsContext::init(Napi::Env env, Napi::Object exports) {
    return define_class("Context")
        .static_method<setTracingMode>("setTracingMode")
        .static_method<setTriggerMode>("setTriggerMode")
        .static_method<setDefaultSampleRate>("setDefaultSampleRate")
        .static_method<getDecisions>("getDecisions")
        .static_method<get>("get")
        .static_method<toString>("toString")
        .static_method<set>("set")
        .static_method<fromString>("fromString")
        .static_method<copy>("copy")
        .static_method<setSampledFlag>("setSampledFlag")
        .static_method<clear>("clear")
        .static_method<isValid>("isValid")
        .static_method<isSampled>("isSampled")
        .static_method<validateTransformServiceName>("validateTransformServiceName")
        .static_method<shutdown>("shutdown")
        .static_method<isReady>("isReady")
        .static_method<isLambda>("isLambda")
        .static_method<createEvent>("createEvent")
        .static_method<startTrace>("startTrace")
        .static_method<createEntry>("createEntry")
        .static_method<createExit>("createExit")
        .register_class(env, exports);
}

Napi::Value JsContext::setTracingMode(sw::CallbackInfo const info) {
    auto newMode = info.arg<int>(0);
    Context::setTracingMode(newMode);
    return info.undefined();
}

Napi::Value JsContext::setTriggerMode(sw::CallbackInfo const info) {
    auto newMode = info.arg<int>(0);
    Context::setTriggerMode(newMode);
    return info.undefined();
}

Napi::Value JsContext::setDefaultSampleRate(sw::CallbackInfo const info) {
    auto newRate = info.arg<int>(0);
    Context::setDefaultSampleRate(newRate);
    return info.undefined();
}

Napi::Value JsContext::getDecisions(sw::CallbackInfo const info) {
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

    Context::getDecisions(
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

Napi::Value JsContext::get(sw::CallbackInfo const info) {
    return JsMetadata::js_new(info, new Metadata(Context::get()));
}

Napi::Value JsContext::toString(sw::CallbackInfo const info) {
    return info.value(Context::toString());
}

Napi::Value JsContext::set(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    Context::set(md->base->metadata());
    return info.undefined();
}

Napi::Value JsContext::fromString(sw::CallbackInfo const info) {
    auto s = info.arg<std::string>(0);
    Context::fromString(s);
    return info.undefined();
}

Napi::Value JsContext::copy(sw::CallbackInfo const info) {
    return JsMetadata::js_new(info, Context::copy());
}

Napi::Value JsContext::setSampledFlag(sw::CallbackInfo const info) {
    Context::setSampledFlag();
    return info.undefined();
}

Napi::Value JsContext::clear(sw::CallbackInfo const info) {
    Context::clear();
    return info.undefined();
}

Napi::Value JsContext::isValid(sw::CallbackInfo const info) {
    return info.value(Context::isValid());
}

Napi::Value JsContext::isSampled(sw::CallbackInfo const info) {
    return info.value(Context::isSampled());
}

Napi::Value JsContext::validateTransformServiceName(sw::CallbackInfo const info) {
    auto service_key = info.arg<std::string>(0);
    return info.value(Context::validateTransformServiceName(service_key));
}

Napi::Value JsContext::shutdown(sw::CallbackInfo const info) {
    Context::shutdown();
    return info.undefined();
}

Napi::Value JsContext::isReady(sw::CallbackInfo const info) {
    auto timeout = info.arg<unsigned int>(0);
    return info.value(Context::isReady(timeout));
}

Napi::Value JsContext::isLambda(sw::CallbackInfo const info) {
    return info.value(Context::isLambda());
}

Napi::Value JsContext::createEvent(sw::CallbackInfo const info) {
    auto timestamp = info.arg_optional<int64_t>(0);
    if (timestamp) {
        return JsEvent::js_new(info, Context::createEvent(*timestamp));
    } else {
        return JsEvent::js_new(info, Context::createEvent());
    }
}
Napi::Value JsContext::startTrace(sw::CallbackInfo const info) {
    return JsEvent::js_new(info, Context::startTrace());
}

Napi::Value JsContext::createEntry(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    auto timestamp = info.arg<int64_t>(1);
    auto parent_md_opt = info.arg_optional<Napi::Object>(2);
    if (parent_md_opt) {
        auto parent_md = JsMetadata::Unwrap(*parent_md_opt);
        return JsEvent::js_new(
            info, Context::createEntry(md->base->metadata(), timestamp, parent_md->base->metadata())
        );
    } else {
        return JsEvent::js_new(info, Context::createEntry(md->base->metadata(), timestamp));
    }
}
Napi::Value JsContext::createExit(sw::CallbackInfo const info) {
    auto timestamp = info.arg<int64_t>(0);
    return JsEvent::js_new(info, Context::createExit(timestamp));
}
