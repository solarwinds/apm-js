#include "span.hh"

JsSpan::JsSpan(sw::CallbackInfo const info)
    : sw::Class<JsSpan, Span, sw::ClassType::Static>(info) {}
Napi::Object JsSpan::init(Napi::Env env, Napi::Object object) {
    return define_class("Span")
        .static_method<createSpan>("createSpan")
        .static_method<createHttpSpan>("createHttpSpan")
        .register_class(env, object);
}

Napi::Value JsSpan::createSpan(sw::CallbackInfo const info) {
    auto options = info.arg<sw::Object>(0);

    auto transaction = options.get<sw::NullableString>("transaction");
    auto domain = options.get<sw::NullableString>("domain");
    auto duration = options.get<int64_t>("duration");
    auto has_error = options.get<int>("has_error");
    auto service_name =
        options.get_optional<sw::NullableString>("service_name").value_or(std::nullopt);

    return info.value(Span::createSpan(
        transaction.data(), domain.data(), duration, has_error, service_name.data()
    ));
}

Napi::Value JsSpan::createHttpSpan(sw::CallbackInfo const info) {
    auto options = info.arg<sw::Object>(0);

    auto transaction = options.get<sw::NullableString>("transaction");
    auto url = options.get<sw::NullableString>("url");
    auto domain = options.get<sw::NullableString>("domain");
    auto duration = options.get<int64_t>("duration");
    auto status = options.get<int>("status");
    auto method = options.get<sw::NullableString>("method");
    auto has_error = options.get<int>("has_error");
    auto service_name =
        options.get_optional<sw::NullableString>("service_name").value_or(std::nullopt);

    return info.value(Span::createHttpSpan(
        transaction.data(), url.data(), domain.data(), duration, status, method.data(), has_error,
        service_name.data()
    ));
}
