#include "event.hh"
#include "metadata.hh"

JsEvent::JsEvent(sw::CallbackInfo const info) : sw::Class<JsEvent, Event>(info) {}
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

Napi::Value JsEvent::addInfo(sw::CallbackInfo const info) {
    auto key = info.arg<std::string>(0);
    auto value = info.arg<Napi::Value>(1);
    if (value.IsString()) {
        auto v = sw::from_value<std::string>(value);
        return info.value(base->addInfo(key.data(), v));
    } else if (value.IsNumber()) {
        auto d = sw::from_value<double>(value);
        if (sw::is_integer(d)) {
            auto i = sw::from_value<long>(value);
            return info.value(base->addInfo(key.data(), i));
        } else {
            return info.value(base->addInfo(key.data(), d));
        }
    } else if (value.IsBoolean()) {
        auto v = sw::from_value<bool>(value);
        return info.value(base->addInfo(key.data(), v));
    } else {
        return info.value(base->addInfo(key.data(), nullptr));
    }
}

Napi::Value JsEvent::addEdge(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addEdge(md->base->metadata()));
}
Napi::Value JsEvent::addContextOpId(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addContextOpId(md->base->metadata()));
}

Napi::Value JsEvent::addHostname(sw::CallbackInfo const info) {
    return info.value(base->addHostname());
}

Napi::Value JsEvent::getMetadata(sw::CallbackInfo const info) {
    return JsMetadata::js_new(info, base->getMetadata());
}
Napi::Value JsEvent::metadataString(sw::CallbackInfo const info) {
    return info.value(base->metadataString());
}
Napi::Value JsEvent::opIdString(sw::CallbackInfo const info) {
    return info.value(base->opIdString());
}

Napi::Value JsEvent::send(sw::CallbackInfo const info) {
    auto with_system_timestamp = info.arg_optional<bool>(0).value_or(true);
    return info.value(base->send(with_system_timestamp));
}

Napi::Value JsEvent::sendProfiling(sw::CallbackInfo const info) {
    return info.value(base->sendProfiling());
}

Napi::Value JsEvent::addSpanRef(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return info.value(base->addSpanRef(md->base->metadata()));
}
Napi::Value JsEvent::addProfileEdge(sw::CallbackInfo const info) {
    auto id = info.arg<std::string>(0);
    return info.value(base->addProfileEdge(id));
}

Napi::Value JsEvent::startTrace(sw::CallbackInfo const info) {
    auto md = JsMetadata::Unwrap(info.arg<Napi::Object>(0));
    return JsEvent::js_new(info, Event::startTrace(md->base->metadata()));
}
