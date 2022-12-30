#include "event.hh"
#include "metadata.hh"

JsEvent::JsEvent(swo::CallbackInfo const info) : swo::Class<JsEvent, Event>(info) {}
Napi::Object JsEvent::init(Napi::Env env, Napi::Object exports) {
    return define_class("Event")
        .method<&JsEvent::addInfo>("addInfo")
        .method<&JsEvent::addEdge>("addEdge")
        .method<&JsEvent::addContextOpId>("addContextOpId")
        .method<&JsEvent::addHostname>("addHostName")
        .method<&JsEvent::getMetadata>("getMetadata")
        .method<&JsEvent::metadataString>("metadataString")
        .method<&JsEvent::opIdString>("opIdString")
        .method<&JsEvent::send>("send")
        .method<&JsEvent::sendProfiling>("sendProfiling")
        .method<&JsEvent::addSpanRef>("addSpanRef")
        .method<&JsEvent::addProfileEdge>("addProfileEdge")
        .static_method<startTrace>("startTrace")
        .register_class(env, exports);
}

Napi::Value JsEvent::addInfo(swo::CallbackInfo const info) {
    auto key = info.arg<std::string>(0);
    auto value = info.arg<Napi::Value>(1);
    if (value.IsString()) {
        auto v = swo::from_value<std::string>(value);
        return info.value(base->addInfo(key.data(), v));
    } else if (value.IsNumber()) {
        auto v = swo::from_value<double>(value);
        return info.value(base->addInfo(key.data(), v));
    } else if (value.IsBoolean()) {
        auto v = swo::from_value<bool>(value);
        return info.value(base->addInfo(key.data(), v));
    } else {
        return info.value(base->addInfo(key.data(), nullptr));
    }
}

Napi::Value JsEvent::addEdge(swo::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addEdge(md->base->metadata()));
}
Napi::Value JsEvent::addContextOpId(swo::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addContextOpId(md->base->metadata()));
}

Napi::Value JsEvent::addHostname(swo::CallbackInfo const info) {
    return info.value(base->addHostname());
}

Napi::Value JsEvent::getMetadata(swo::CallbackInfo const info) {
    return JsMetadata::js_new(info, base->getMetadata());
}
Napi::Value JsEvent::metadataString(swo::CallbackInfo const info) {
    return info.value(base->metadataString());
}
Napi::Value JsEvent::opIdString(swo::CallbackInfo const info) {
    return info.value(base->opIdString());
}

Napi::Value JsEvent::send(swo::CallbackInfo const info) {
    auto with_system_timestamp = info.arg_optional<bool>(0).value_or(true);
    return info.value(base->send(with_system_timestamp));
}

Napi::Value JsEvent::sendProfiling(swo::CallbackInfo const info) {
    return info.value(base->sendProfiling());
}

Napi::Value JsEvent::addSpanRef(swo::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addSpanRef(md->base->metadata()));
}
Napi::Value JsEvent::addProfileEdge(swo::CallbackInfo const info) {
    auto id = info.arg<std::string>(0);
    return info.value(base->addProfileEdge(id));
}

Napi::Value JsEvent::startTrace(swo::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return JsEvent::js_new(info, Event::startTrace(md->base->metadata()));
}
