#include "config.hh"

JsConfig::JsConfig(sw::CallbackInfo const info)
    : sw::Class<JsConfig, Config, sw::ClassType::Static>(info) {}
Napi::Object JsConfig::init(Napi::Env env, Napi::Object exports) {
    return define_class("Config")
        .static_method<checkVersion>("checkVersion")
        .static_method<getVersionString>("getVersionString")
        .register_class(env, exports);
}

Napi::Value JsConfig::checkVersion(sw::CallbackInfo const info) {
    auto version = info.arg<int>(0);
    auto revision = info.arg<int>(1);
    return info.value(Config::checkVersion(version, revision));
}

Napi::Value JsConfig::getVersionString(sw::CallbackInfo const info) {
    return info.value(Config::getVersionString());
}
