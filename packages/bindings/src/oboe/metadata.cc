#include "metadata.hh"
#include "event.hh"

JsMetadata::JsMetadata(swo::CallbackInfo const info) : swo::Class<JsMetadata, Metadata>(info) {}
Napi::Object JsMetadata::init(Napi::Env env, Napi::Object exports) {
    return define_class("Metadata")
        .method<&JsMetadata::createEvent>("createEvent")
        .method<&JsMetadata::copy>("copy")
        .method<&JsMetadata::isValid>("isValid")
        .method<&JsMetadata::isSampled>("isSampled")
        .static_method<makeRandom>("makeRandom")
        .static_method<fromString>("fromString")
        .method<&JsMetadata::toString>("toString")
        .register_class(env, exports);
}

Napi::Value JsMetadata::createEvent(swo::CallbackInfo const info) {
    return JsEvent::js_new(info, base->createEvent());
}

Napi::Value JsMetadata::copy(swo::CallbackInfo const info) {
    return JsMetadata::js_new(info, base->copy());
}
Napi::Value JsMetadata::isValid(swo::CallbackInfo const info) {
    return info.value(base->isValid());
}
Napi::Value JsMetadata::isSampled(swo::CallbackInfo const info) {
    return info.value(base->isSampled());
}

Napi::Value JsMetadata::makeRandom(swo::CallbackInfo const info) {
    auto sampled = info.arg_optional<bool>(0).value_or(true);
    return JsMetadata::js_new(info, Metadata::makeRandom(sampled));
}
Napi::Value JsMetadata::fromString(swo::CallbackInfo const info) {
    auto s = info.arg<std::string>(0);
    return JsMetadata::js_new(info, Metadata::fromString(s));
}

Napi::Value JsMetadata::toString(swo::CallbackInfo const info) {
    return info.value(base->toString());
}
