#ifndef _UTIL_HH_
#define _UTIL_HH_

#include <cmath>
#include <cstdint>
#include <optional>
#include <typeindex>
#include <typeinfo>
#include <unordered_map>

#include <napi.h>

#define UNUSED(X) static_cast<void>(X)

namespace sw {

namespace {
    // constexpr pow function
    // anonymous namespace since it shouldn't be exposed
    constexpr int64_t cpow(int64_t base, int64_t exp) {
        return exp == 0 ? 1 : base * cpow(base, exp - 1);
    }
} // namespace

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
constexpr int64_t MAX_SAFE_INTEGER = cpow(2, 53) - 1;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MIN_SAFE_INTEGER
constexpr int64_t MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER;

inline bool is_integer(double value) { return std::fmod(value, 1) == 0; }

// declare each class so they can be referenced before their definition
// since they are also defined in this header
class Object;
class Env;
class CallbackInfo;
enum class ClassType;
template <typename T, typename B, ClassType ty> class Class;
template <typename T, ClassType ty> class ClassDefinition;
class NullableString;

// Napi::Object wrapper
class Object {
  public:
    inline Object(Napi::Object const object) : object(object) {}
    inline operator Napi::Object() const { return object; }
    inline operator Napi::Value() const { return object; }

    // depends on conversion utilities
    template <typename T> T get(std::string_view name) const;
    template <typename T> Object const& set(std::string_view name, T value) const;
    template <typename T> std::optional<T> get_optional(std::string_view name) const;

  private:
    Napi::Object const object;
};

// Napi::Env wrapper
class Env {
  public:
    inline Env(Napi::Env const env) : env(env) {}
    inline constexpr operator Napi::Env const&() const { return env; }
    inline constexpr operator napi_env() const { return env; }

    inline Napi::Value undefined() const { return env.Undefined(); }
    inline Object object() const { return Object(Napi::Object::New(env)); }

    // Constructors are stored as a map of class types to function references
    // in instance data. Previously they were stored as class statics but this causes
    // issues when the library is initialised in multiple threads (which creates multiple instances)
    // since the statics point to function references belonging to the first initialised instance
    // which won't be valid in other instances.
    template <typename T> Napi::FunctionReference* ctor() const {
        auto map = env.GetInstanceData<CtorMap>();
        auto ctor = map->at(std::type_index(typeid(T)));
        return ctor;
    }
    template <typename T> void set_ctor(Napi::FunctionReference&& ctor) const {
        auto map = env.GetInstanceData<CtorMap>();
        if (map == nullptr) {
            map = new CtorMap();
            env.SetInstanceData(map);
        }

        auto ptr = new Napi::FunctionReference(std::move(ctor));
        map->insert({std::type_index(typeid(T)), ptr});
    }

    // depends on conversion utilities
    template <typename T> Napi::Value value(T value) const;

  private:
    Napi::Env const env;
    // Stores native class constructors
    using CtorMap = std::unordered_map<std::type_index, Napi::FunctionReference*>;
};

// Napi::CallbackInfo wrapper
// inherit from Env for convenience
class CallbackInfo : public Env {
  public:
    inline CallbackInfo(Napi::CallbackInfo const& info) : Env(info.Env()), info(info) {}
    inline constexpr operator Napi::CallbackInfo const&() const { return info; }

    inline size_t length() const { return info.Length(); }

    // depends on conversion utilities
    template <typename T> T arg(size_t index) const;
    template <typename T> std::optional<T> arg_optional(size_t index) const;

  private:
    // Napi::CallbackInfo is always passed by reference so we store the reference
    Napi::CallbackInfo const& info;
};

// JS function callback type definition that uses our wrappers
using Callback = Napi::Value (*)(CallbackInfo const);

// Whether a class is an instance class or a static one
// Neither C++ nor JS have a concept of static class, but oboe_api.h
// defines some classes with no instance methods so the distinction is useful
enum class ClassType {
    Instance,
    Static,
};

// Utility class to wrap a C++ class into a JS class
// T is the wrapper class inheriting from this one, B is the wrapped class
// We expect B to follow the patterns of oboe_api.h
// ty is the class type (static or not)
// Inherits from ObjectWrap<T>
// https://github.com/nodejs/node-addon-api/blob/main/doc/object_wrap.md
template <typename T, typename B, ClassType ty = ClassType::Instance>
class Class : public Napi::ObjectWrap<T> {
  public:
    // Base constructor which accepts a pointer to the wrapped class and the JS callback info
    Class(B* const base, CallbackInfo const info) : Napi::ObjectWrap<T>(info), base(base) {}
    // JS constructor which extracts the wrapped class pointer from the first argument
    Class(CallbackInfo const info) : Class(static_cast<B*>(info.arg<void*>(0)), info) {}
    // oboe_api.h expects us to delete the pointers we get from it
    ~Class() { delete base; }

    // Returns a utility C++ class that lets us define the JS class
    static constexpr ClassDefinition<T, ty> define_class(std::string_view name) {
        return ClassDefinition<T, ty>(name);
    }

    // Returns an instantiation of the JS class from a wrapped class pointer
    // This is done by calling the JS function reference to our constructor
    // that we store when defining the class.
    // This function reference internally calls the second C++ constructor
    // which extracts the wrapped class pointer from the first argument.
    // So we simply pass the provided pointer to the function.
    static Napi::Object js_new(Env const env, B* const base) {
        static_assert(ty != ClassType::Static, "cannot instantiate a static class");
        return env.ctor<T>()->New({env.value(static_cast<void*>(base))});
    }

    // Stored pointer to the base class
    B* const base;

  private:
    // Function signature for JS methods using our wrappers
    using MethodCallback = Napi::Value (T::*)(CallbackInfo const);
    // Function signature for JS static method callbacks
    using StaticMethodCallback = Napi::Value (*)(CallbackInfo const);

    // Since we use wrapper types, the signatures of methods we want to wrap
    // are not the same as what node-addon-api expects.
    // So we need to have a method with the right signature to wrap them.
    // We can't just pass our custom method callbacks as an argument to this wrapper
    // as its signature would no longer match what node-addon-api expects.
    // So we use a template and pass the provided method pointer as a template argument.
    template <MethodCallback cb>
    Napi::Value method_callback_wrapper(Napi::CallbackInfo const& info) {
        // Since T is the wrapper class inheriting from the current one
        // casting the this pointer to T* is a noop and perfectly safe.
        return (static_cast<T*>(this)->*cb)(info);
    }
    template <StaticMethodCallback cb>
    static Napi::Value static_method_callback_wrapper(Napi::CallbackInfo const& info) {
        return cb(info);
    }

    template <typename CT, ClassType cty> friend class ClassDefinition;
};

template <typename T, ClassType ty> class ClassDefinition {
  public:
    // Function signature for JS instance method callbacks
    using MethodCallback = Napi::Value (T::*)(CallbackInfo const);
    // Function signature for JS static method callbacks
    using StaticMethodCallback = Napi::Value (*)(CallbackInfo const);
    // Function signature for JS instance getter callbacks
    // We don't use setters anywhere at the moment so not provided
    using GetterCallback = Napi::Value (T::*)(CallbackInfo const);

    constexpr ClassDefinition(std::string_view const name) : name(name), members() {}

    Napi::Object register_class(Napi::Env env, Napi::Object exports) {
        // constexpr means only one of the two branches will be compiled
        if constexpr (ty != ClassType::Static) {
            // If the class isn't static we define an actual JS class
            // First define the constructor using the method provided by Napi::ObjectWrap<T>
            // Then store the constructor in the environment for later use
            // Finally expose the class to JS in the exports object
            auto f = T::DefineClass(env, name.data(), members);
            Env(env).set_ctor<T>(Napi::Persistent(f));
            exports.Set(name.data(), f);
            return exports;
        } else {
            // Otherwise the class is static and we just define it as a plain JS object
            auto o = Napi::Object::New(env);
            for (auto& member : members) {
                o.DefineProperty(napi_property_descriptor(member));
            }
            exports.Set(name.data(), o);
            return exports;
        }
    }

    // Define a JS method with the callback provided as a template argument
    template <MethodCallback cb> ClassDefinition<T, ty>& method(std::string_view name) {
        static_assert(ty != ClassType::Static, "cannot define instance method on static class");
        members.push_back(T::InstanceMethod(name.data(), &T::template method_callback_wrapper<cb>));
        return *this;
    }

    // Define a JS field with the getter and setter callbacks provided as template arguments
    template <GetterCallback get, typename T::InstanceSetterCallback set = nullptr>
    ClassDefinition<T, ty>& field(std::string_view name) {
        static_assert(ty != ClassType::Static, "cannot define instance field on static class");
        members.push_back(
            T::InstanceAccessor(name.data(), &T::template method_callback_wrapper<get>, set)
        );
        return *this;
    }

    // Define a JS static method with the callback provided as a template argument
    template <StaticMethodCallback cb>
    ClassDefinition<T, ty>& static_method(std::string_view name) {
        members.push_back(
            T::StaticMethod(name.data(), &T::template static_method_callback_wrapper<cb>)
        );
        return *this;
    }

  private:
    std::string_view const name;
    // Property descriptors of the class to be defined
    std::vector<typename T::PropertyDescriptor> members;
};

// Nullable string wrapper
// Useful as a way to represent a const char* which owns its contents
class NullableString {
  public:
    constexpr inline NullableString() noexcept : value() {}
    constexpr inline NullableString(std::nullopt_t) noexcept : value() {}
    constexpr inline NullableString(std::string&& value) noexcept : value(value) {}
    inline NullableString(const char* value) : value(value ? std::optional{value} : std::nullopt) {}

    constexpr inline char const* data() const noexcept { return value ? value->data() : nullptr; }

  private:
    std::optional<std::string> const value;
};

// The next sections contains a bunch of conversion routines
// that go between Napi::Value and various C and C++ types
// node-addon-api exposes a bunch of conversions but they end up being very verbose
// especially for optional values and wrapper types
// It ends up being much nicer to use C++ template specialisations and overloads
// to define all those conversions in a single place and have one liners everywhere else
template <typename T> T from_value(Napi::Value const& value) { return value; }
inline Napi::Value to_value(Napi::Env env, Napi::Value const& self) {
    UNUSED(env);
    return self;
}

// float
template <> inline float from_value(Napi::Value const& value) {
    return value.As<Napi::Number>().FloatValue();
}
inline Napi::Value to_value(Napi::Env env, float self) { return Napi::Number::New(env, self); }

// double
template <> inline double from_value(Napi::Value const& value) {
    return value.As<Napi::Number>().DoubleValue();
}
inline Napi::Value to_value(Napi::Env env, double self) { return Napi::Number::New(env, self); }

// i32
template <> inline int32_t from_value(Napi::Value const& value) {
    return value.As<Napi::Number>().Int32Value();
}
inline Napi::Value to_value(Napi::Env env, int32_t self) { return Napi::Number::New(env, self); }

// u32
template <> inline uint32_t from_value(Napi::Value const& value) {
    return value.As<Napi::Number>().Uint32Value();
}
inline Napi::Value to_value(Napi::Env env, uint32_t self) { return Napi::Number::New(env, self); }

// i64
template <> inline int64_t from_value(Napi::Value const& value) {
    if (value.IsBigInt()) {
        auto lossless = true;
        return value.As<Napi::BigInt>().Int64Value(&lossless);
    } else {
        return value.As<Napi::Number>().Int64Value();
    }
}
inline Napi::Value to_value(Napi::Env env, int64_t self) {
    if (self > MAX_SAFE_INTEGER || self < MIN_SAFE_INTEGER) {
        return Napi::BigInt::New(env, self);
    } else {
        return Napi::Number::New(env, self);
    }
}

// u64
template <> inline uint64_t from_value(Napi::Value const& value) {
    if (value.IsBigInt()) {
        auto lossless = true;
        return value.As<Napi::BigInt>().Uint64Value(&lossless);
    } else {
        return value.As<Napi::Number>().Int64Value();
    }
}
inline Napi::Value to_value(Napi::Env env, uint64_t self) {
    if (self > MAX_SAFE_INTEGER) {
        return Napi::BigInt::New(env, self);
    } else {
        return Napi::Number::New(env, self);
    }
}

// bool
template <> inline bool from_value(Napi::Value const& value) {
    return value.As<Napi::Boolean>().Value();
}
inline Napi::Value to_value(Napi::Env env, bool self) { return Napi::Boolean::New(env, self); }

// void*
template <> inline void* from_value(Napi::Value const& value) {
    return value.IsNull() ? nullptr : value.As<Napi::External<void>>().Data();
}
inline Napi::Value to_value(Napi::Env env, void* self) {
    return self == nullptr ? env.Null() : Napi::External<void>::New(env, self);
}

// char const*
inline Napi::Value to_value(Napi::Env env, char const* self) {
    return self == nullptr ? env.Null() : Napi::String::New(env, self);
}

// std::string
template <> inline std::string from_value(Napi::Value const& value) {
    return value.As<Napi::String>().Utf8Value();
}

// std::string_view
inline Napi::Value to_value(Napi::Env env, std::string_view self) {
    return Napi::String::New(env, self.data());
}

// Napi::Object
template <> inline Napi::Object from_value(Napi::Value const& value) {
    return value.As<Napi::Object>();
}

// Napi::Function
template <> inline Napi::Function from_value(Napi::Value const& value) {
    return value.As<Napi::Function>();
}

// Object
template <> inline Object from_value(Napi::Value const& value) {
    return Object(from_value<Napi::Object>(value));
}

// Callback
inline Napi::Value to_value(Napi::Env env, Callback self) {
    return Napi::Function::New(env, [self](Napi::CallbackInfo const& info) {
        return self(CallbackInfo(info));
    });
}

// NullableString
template <> inline NullableString from_value(Napi::Value const& value) {
    if (value.IsNull()) {
        return NullableString(std::nullopt);
    } else {
        return NullableString(value.As<Napi::String>().Utf8Value());
    }
}
inline Napi::Value to_value(Napi::Env env, NullableString self) {
    auto data = self.data();
    if (data) {
        return Napi::String::New(env, data);
    } else {
        return env.Null();
    }
}

// Object methods depending on conversion utilities being defined
template <typename T> T Object::get(std::string_view name) const {
    return from_value<T>(object.Get(name.data()));
}
template <typename T> Object const& Object::set(std::string_view name, T value) const {
    object.Set(name.data(), to_value(object.Env(), value));
    return *this;
}
template <typename T> std::optional<T> Object::get_optional(std::string_view name) const {
    if (!object.Has(name.data())) {
        return std::nullopt;
    }

    auto value = object.Get(name.data());
    if (value.IsUndefined()) {
        return std::nullopt;
    }

    return from_value<T>(value);
}

// Env methods depending on conversion utilities being defined
template <typename T> Napi::Value Env::value(T value) const { return to_value(env, value); }

// CallbackInfo methods depending on conversion utilities being defined
template <typename T> T CallbackInfo::arg(size_t index) const { return from_value<T>(info[index]); }
template <typename T> std::optional<T> CallbackInfo::arg_optional(size_t index) const {
    if (index >= info.Length()) {
        return std::nullopt;
    }

    auto arg = info[index];
    if (arg.IsUndefined()) {
        return std::nullopt;
    }

    return from_value<T>(arg);
}

} // namespace sw

#endif
