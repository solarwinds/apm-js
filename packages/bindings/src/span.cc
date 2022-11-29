#include "span.hh"

JsSpan::JsSpan(swo::CallbackInfo const info)
    : swo::Class<JsSpan, Span, swo::ClassType::Static>(info) {}
Napi::Object JsSpan::init(Napi::Env env, Napi::Object object) {
    return define_class("Span")
        .static_method<createSpan>("createSpan")
        .static_method<createHttpSpan>("createHttpSpan")
        .register_class(env, object);
}

Napi::Value JsSpan::createSpan(swo::CallbackInfo const info) {
    auto options = info.arg<swo::Object>(0);

    auto transaction = options.get<swo::NullableString>("transaction");
    auto domain = options.get<swo::NullableString>("domain");
    auto duration = options.get<int64_t>("duration");
    auto has_error = options.get<int>("has_error");
    auto service_name =
        options.get_optional<swo::NullableString>("service_name").value_or(std::nullopt);

    return info.value(Span::createSpan(
        transaction.data(), domain.data(), duration, has_error, service_name.data()
    ));
}

Napi::Value JsSpan::createHttpSpan(swo::CallbackInfo const info) {
    auto options = info.arg<swo::Object>(0);

    auto transaction = options.get<swo::NullableString>("transaction");
    auto url = options.get<swo::NullableString>("url");
    auto domain = options.get<swo::NullableString>("domain");
    auto duration = options.get<int64_t>("duration");
    auto status = options.get<int>("status");
    auto method = options.get<swo::NullableString>("method");
    auto has_error = options.get<int>("has_error");
    auto service_name =
        options.get_optional<swo::NullableString>("service_name").value_or(std::nullopt);

    return info.value(Span::createHttpSpan(
        transaction.data(), url.data(), domain.data(), duration, status, method.data(), has_error,
        service_name.data()
    ));
}
