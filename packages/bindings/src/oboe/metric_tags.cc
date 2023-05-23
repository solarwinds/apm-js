#include "metric_tags.hh"

JsMetricTags::JsMetricTags(swo::CallbackInfo const info)
    : swo::Class<JsMetricTags, MetricTags>(new MetricTags(info.arg<size_t>(0)), info) {}
Napi::Object JsMetricTags::init(Napi::Env env, Napi::Object exports) {
    return define_class("MetricTags")
        .method<&JsMetricTags::add>("add")
        .register_class(env, exports);
}

Napi::Value JsMetricTags::add(swo::CallbackInfo const info) {
    auto index = info.arg<size_t>(0);
    auto key = info.arg<std::string>(1);
    auto value = info.arg<std::string>(2);
    return info.value(base->add(index, key.data(), value.data()));
}
