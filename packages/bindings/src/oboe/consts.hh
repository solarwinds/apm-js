#include <napi.h>
#include <oboe.h>

#include "../util.hh"

inline sw::Object init_consts(sw::Object const exports) {
    exports.set("SETTINGS_VERSION", OBOE_SETTINGS_VERSION);
    exports.set("SETTINGS_MAGIC_NUMBER", OBOE_SETTINGS_MAGIC_NUMBER);
    exports.set("SETTINGS_TYPE_DEFAULT_SAMPLE_RATE", OBOE_SETTINGS_TYPE_DEFAULT_SAMPLE_RATE);
    exports.set("SETTINGS_TYPE_LAYER_SAMPLE_RATE", OBOE_SETTINGS_TYPE_LAYER_SAMPLE_RATE);
    exports.set("SETTINGS_TYPE_LAYER_APP_SAMPLE_RATE", OBOE_SETTINGS_TYPE_LAYER_APP_SAMPLE_RATE);
    exports.set(
        "SETTINGS_TYPE_LAYER_HTTPHOST_SAMPLE_RATE", OBOE_SETTINGS_TYPE_LAYER_HTTPHOST_SAMPLE_RATE
    );
    exports.set("SETTINGS_TYPE_CONFIG_STRING", OBOE_SETTINGS_TYPE_CONFIG_STRING);
    exports.set("SETTINGS_TYPE_CONFIG_INT", OBOE_SETTINGS_TYPE_CONFIG_INT);
    exports.set("SETTINGS_FLAG_OK", OBOE_SETTINGS_FLAG_OK);
    exports.set("SETTINGS_FLAG_INVALID", OBOE_SETTINGS_FLAG_INVALID);
    exports.set("SETTINGS_FLAG_OVERRIDE", OBOE_SETTINGS_FLAG_OVERRIDE);
    exports.set("SETTINGS_FLAG_SAMPLE_START", OBOE_SETTINGS_FLAG_SAMPLE_START);
    exports.set("SETTINGS_FLAG_SAMPLE_THROUGH", OBOE_SETTINGS_FLAG_SAMPLE_THROUGH);
    exports.set("SETTINGS_FLAG_SAMPLE_THROUGH_ALWAYS", OBOE_SETTINGS_FLAG_SAMPLE_THROUGH_ALWAYS);
    exports.set("SETTINGS_FLAG_TRIGGERED_TRACE", OBOE_SETTINGS_FLAG_TRIGGERED_TRACE);
    exports.set("SETTINGS_MAX_STRLEN", OBOE_SETTINGS_MAX_STRLEN);

    exports.set("SETTINGS_UNSET", OBOE_SETTINGS_UNSET);

    exports.set("SAMPLE_RATE_SOURCE_FILE", OBOE_SAMPLE_RATE_SOURCE_FILE);
    exports.set("SAMPLE_RATE_SOURCE_DEFAULT", OBOE_SAMPLE_RATE_SOURCE_DEFAULT);
    exports.set("SAMPLE_RATE_SOURCE_OBOE", OBOE_SAMPLE_RATE_SOURCE_OBOE);
    exports.set("SAMPLE_RATE_SOURCE_LAST_OBOE", OBOE_SAMPLE_RATE_SOURCE_LAST_OBOE);
    exports.set(
        "SAMPLE_RATE_SOURCE_DEFAULT_MISCONFIGURED", OBOE_SAMPLE_RATE_SOURCE_DEFAULT_MISCONFIGURED
    );
    exports.set("SAMPLE_RATE_SOURCE_OBOE_DEFAULT", OBOE_SAMPLE_RATE_SOURCE_OBOE_DEFAULT);
    exports.set("SAMPLE_RATE_SOURCE_CUSTOM", OBOE_SAMPLE_RATE_SOURCE_CUSTOM);

    exports.set("SAMPLE_RESOLUTION", OBOE_SAMPLE_RESOLUTION);

    exports.set("TRACE_DISABLED", OBOE_TRACE_DISABLED);
    exports.set("TRACE_ENABLED", OBOE_TRACE_ENABLED);
    exports.set("TRIGGER_DISABLED", OBOE_TRIGGER_DISABLED);
    exports.set("TRIGGER_ENABLED", OBOE_TRIGGER_ENABLED);

    exports.set("SEND_EVENT", OBOE_SEND_EVENT);
    exports.set("SEND_STATUS", OBOE_SEND_STATUS);
    exports.set("SEND_PROFILING", OBOE_SEND_PROFILING);

    exports.set("SERVER_RESPONSE_UNKNOWN", OBOE_SERVER_RESPONSE_UNKNOWN);
    exports.set("SERVER_RESPONSE_OK", OBOE_SERVER_RESPONSE_OK);
    exports.set("SERVER_RESPONSE_TRY_LATER", OBOE_SERVER_RESPONSE_TRY_LATER);
    exports.set("SERVER_RESPONSE_LIMIT_EXCEEDED", OBOE_SERVER_RESPONSE_LIMIT_EXCEEDED);
    exports.set("SERVER_RESPONSE_CONNECT_ERROR", OBOE_SERVER_RESPONSE_CONNECT_ERROR);

    exports.set("SPAN_NULL_PARAMS", OBOE_SPAN_NULL_PARAMS);
    exports.set("SPAN_NULL_BUFFER", OBOE_SPAN_NULL_BUFFER);
    exports.set("SPAN_INVALID_VERSION", OBOE_SPAN_INVALID_VERSION);
    exports.set("SPAN_NO_REPORTER", OBOE_SPAN_NO_REPORTER);
    exports.set("SPAN_NOT_READY", OBOE_SPAN_NOT_READY);

    exports.set("TRACING_DECISIONS_FAILED_AUTH", OBOE_TRACING_DECISIONS_FAILED_AUTH);
    exports.set(
        "TRACING_DECISIONS_TRIGGERED_TRACE_EXHAUSTED",
        OBOE_TRACING_DECISIONS_TRIGGERED_TRACE_EXHAUSTED
    );
    exports.set(
        "TRACING_DECISIONS_TRIGGERED_TRACE_DISABLED",
        OBOE_TRACING_DECISIONS_TRIGGERED_TRACE_DISABLED
    );
    exports.set("TRACING_DECISIONS_TRACING_DISABLED", OBOE_TRACING_DECISIONS_TRACING_DISABLED);
    exports.set("TRACING_DECISIONS_XTRACE_NOT_SAMPLED", OBOE_TRACING_DECISIONS_XTRACE_NOT_SAMPLED);
    exports.set("TRACING_DECISIONS_OK", OBOE_TRACING_DECISIONS_OK);
    exports.set("TRACING_DECISIONS_NULL_OUT", OBOE_TRACING_DECISIONS_NULL_OUT);
    exports.set("TRACING_DECISIONS_NO_CONFIG", OBOE_TRACING_DECISIONS_NO_CONFIG);
    exports.set("TRACING_DECISIONS_REPORTER_NOT_READY", OBOE_TRACING_DECISIONS_REPORTER_NOT_READY);
    exports.set("TRACING_DECISIONS_NO_VALID_SETTINGS", OBOE_TRACING_DECISIONS_NO_VALID_SETTINGS);
    exports.set("TRACING_DECISIONS_QUEUE_FULL", OBOE_TRACING_DECISIONS_QUEUE_FULL);
    exports.set("TRACING_DECISIONS_BAD_ARG", OBOE_TRACING_DECISIONS_BAD_ARG);

    exports.set("TRACING_DECISIONS_AUTH_NOT_CHECKED", OBOE_TRACING_DECISIONS_AUTH_NOT_CHECKED);
    exports.set("TRACING_DECISIONS_AUTH_NOT_PRESENT", OBOE_TRACING_DECISIONS_AUTH_NOT_PRESENT);
    exports.set("TRACING_DECISIONS_AUTH_OK", OBOE_TRACING_DECISIONS_AUTH_OK);
    exports.set("TRACING_DECISIONS_AUTH_NO_SIG_KEY", OBOE_TRACING_DECISIONS_AUTH_NO_SIG_KEY);
    exports.set("TRACING_DECISIONS_AUTH_INVALID_SIG", OBOE_TRACING_DECISIONS_AUTH_INVALID_SIG);
    exports.set("TRACING_DECISIONS_AUTH_BAD_TIMESTAMP", OBOE_TRACING_DECISIONS_AUTH_BAD_TIMESTAMP);

    exports.set("REQUEST_TYPE_NONE", OBOE_REQUEST_TYPE_NONE);
    exports.set("REQUEST_TYPE_REGULAR", OBOE_REQUEST_TYPE_REGULAR);
    exports.set("REQUEST_TYPE_TRIGGER", OBOE_REQUEST_TYPE_TRIGGER);

    exports.set("INIT_OPTIONS_SET_DEFAULTS_OK", OBOE_INIT_OPTIONS_SET_DEFAULTS_OK);
    exports.set(
        "INIT_OPTIONS_SET_DEFAULTS_WRONG_VERSION", OBOE_INIT_OPTIONS_SET_DEFAULTS_WRONG_VERSION
    );

    exports.set("INIT_ALREADY_INIT", OBOE_INIT_ALREADY_INIT);
    exports.set("INIT_OK", OBOE_INIT_OK);
    exports.set("INIT_WRONG_VERSION", OBOE_INIT_WRONG_VERSION);
    exports.set("INIT_INVALID_PROTOCOL", OBOE_INIT_INVALID_PROTOCOL);
    exports.set("INIT_NULL_REPORTER", OBOE_INIT_NULL_REPORTER);
    exports.set("INIT_DESC_ALLOC", OBOE_INIT_DESC_ALLOC);
    exports.set("INIT_FILE_OPEN_LOG", OBOE_INIT_FILE_OPEN_LOG);
    exports.set("INIT_UDP_NO_SUPPORT", OBOE_INIT_UDP_NO_SUPPORT);
    exports.set("INIT_UDP_OPEN", OBOE_INIT_UDP_OPEN);
    exports.set("INIT_SSL_CONFIG_AUTH", OBOE_INIT_SSL_CONFIG_AUTH);
    exports.set("INIT_SSL_LOAD_CERT", OBOE_INIT_SSL_LOAD_CERT);
    exports.set("INIT_SSL_REPORTER_CREATE", OBOE_INIT_SSL_REPORTER_CREATE);
    exports.set("INIT_SSL_MISSING_KEY", OBOE_INIT_SSL_MISSING_KEY);

    exports.set("CUSTOM_METRICS_OK", OBOE_CUSTOM_METRICS_OK);
    exports.set("CUSTOM_METRICS_INVALID_COUNT", OBOE_CUSTOM_METRICS_INVALID_COUNT);
    exports.set("CUSTOM_METRICS_INVALID_REPORTER", OBOE_CUSTOM_METRICS_INVALID_REPORTER);
    exports.set("CUSTOM_METRICS_TAG_LIMIT_EXCEEDED", OBOE_CUSTOM_METRICS_TAG_LIMIT_EXCEEDED);
    exports.set("CUSTOM_METRICS_STOPPING", OBOE_CUSTOM_METRICS_STOPPING);
    exports.set("CUSTOM_METRICS_QUEUE_LIMIT_EXCEEDED", OBOE_CUSTOM_METRICS_QUEUE_LIMIT_EXCEEDED);

    exports.set("REPORTER_FLUSH_OK", OBOE_REPORTER_FLUSH_OK);
    exports.set("REPORTER_FLUSH_METRIC_ERROR", OBOE_REPORTER_FLUSH_METRIC_ERROR);
    exports.set("REPORTER_FLUSH_BAD_UTF8", OBOE_REPORTER_FLUSH_BAD_UTF8);
    exports.set("REPORTER_FLUSH_NO_REPORTER", OBOE_REPORTER_FLUSH_NO_REPORTER);
    exports.set("REPORTER_FLUSH_REPORTER_NOT_READY", OBOE_REPORTER_FLUSH_REPORTER_NOT_READY);

    exports.set("INIT_LOG_LEVEL_FATAL", OBOE_INIT_LOG_LEVEL_FATAL);
    exports.set("INIT_LOG_LEVEL_ERROR", OBOE_INIT_LOG_LEVEL_ERROR);
    exports.set("INIT_LOG_LEVEL_WARNING", OBOE_INIT_LOG_LEVEL_WARNING);
    exports.set("INIT_LOG_LEVEL_INFO", OBOE_INIT_LOG_LEVEL_INFO);
    exports.set("INIT_LOG_LEVEL_DEBUG", OBOE_INIT_LOG_LEVEL_DEBUG);
    exports.set("INIT_LOG_LEVEL_PREVIOUS_MEDIUM", OBOE_INIT_LOG_LEVEL_PREVIOUS_MEDIUM);
    exports.set("INIT_LOG_LEVEL_TRACE", OBOE_INIT_LOG_LEVEL_TRACE);

    exports.set("INIT_LOG_TYPE_STDERR", OBOE_INIT_LOG_TYPE_STDERR);
    exports.set("INIT_LOG_TYPE_STDOUT", OBOE_INIT_LOG_TYPE_STDOUT);
    exports.set("INIT_LOG_TYPE_FILE", OBOE_INIT_LOG_TYPE_FILE);
    exports.set("INIT_LOG_TYPE_NULL", OBOE_INIT_LOG_TYPE_NULL);
    exports.set("INIT_LOG_TYPE_DISABLE", OBOE_INIT_LOG_TYPE_DISABLE);

    return exports;
}
