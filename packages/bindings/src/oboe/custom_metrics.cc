#include "custom_metrics.hh"
#include "metric_tags.hh"

JsCustomMetrics::JsCustomMetrics(sw::CallbackInfo const info)
    : sw::Class<JsCustomMetrics, CustomMetrics, sw::ClassType::Static>(info) {}
Napi::Object JsCustomMetrics::init(Napi::Env env, Napi::Object exports) {
    return define_class("CustomMetrics")
        .static_method<summary>("summary")
        .static_method<increment>("increment")
        .register_class(env, exports);
}

Napi::Value JsCustomMetrics::summary(sw::CallbackInfo const info) {
    auto options = info.arg<sw::Object>(0);

    auto name = options.get<std::string>("name");
    auto value = options.get<double>("value");
    auto count = options.get<int>("count");
    auto host_tag = options.get<int>("host_tag");
    auto service_name = options.get<sw::NullableString>("service_name");
    auto tags = JsMetricTags::Unwrap(options.get<Napi::Object>("tags"));
    auto tags_count = options.get<size_t>("tags_count");

    return info.value(CustomMetrics::summary(
        name.data(), value, count, host_tag, service_name.data(), tags->base, tags_count
    ));
}

Napi::Value JsCustomMetrics::increment(sw::CallbackInfo const info) {
    auto options = info.arg<sw::Object>(0);

    auto name = options.get<std::string>("name");
    auto count = options.get<int>("count");
    auto host_tag = options.get<int>("host_tag");
    auto service_name = options.get<sw::NullableString>("service_name");
    auto tags = JsMetricTags::Unwrap(options.get<Napi::Object>("tags"));
    auto tags_count = options.get<size_t>("tags_count");

    return info.value(CustomMetrics::increment(
        name.data(), count, host_tag, service_name.data(), tags->base, tags_count
    ));
}
