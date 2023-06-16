#include "config.hh"

JsConfig::JsConfig(swo::CallbackInfo const info)
    : swo::Class<JsConfig, Config, swo::ClassType::Static>(info) {}
Napi::Object JsConfig::init(Napi::Env env, Napi::Object exports) {
    return define_class("Config")
        .static_method<checkVersion>("checkVersion")
        .static_method<getVersionString>("getVersionString")
        .register_class(env, exports);
}

Napi::Value JsConfig::checkVersion(swo::CallbackInfo const info) {
    auto version = info.arg<int>(0);
    auto revision = info.arg<int>(1);
    return info.value(Config::checkVersion(version, revision));
}

Napi::Value JsConfig::getVersionString(swo::CallbackInfo const info) {
    return info.value(Config::getVersionString());
}
