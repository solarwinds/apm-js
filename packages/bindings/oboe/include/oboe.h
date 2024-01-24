/**
 * @file oboe.h
 *
 * API header for liboboe application tracing library.
 *
 * @package             Oboe
 * @author              liboboe
 * @copyright           Copyright (c) 2022, SolarWinds inc
 * @license
 * @link
 **/

#ifndef LIBOBOE_H
#define LIBOBOE_H


#ifdef __cplusplus
extern "C" {
#endif

#include <stdio.h>
#include <stdbool.h>
#include <sys/types.h>
#include <sys/time.h>
#include <inttypes.h>
#if defined _WIN32
    #include <unistd.h> // On Windows ssize_t definition was put in this header.
#endif
#include "bson/bson.h"

/**
 * Default configuration settings update interval in seconds.
 *
 * Borrowed from the Tracelyzer's oboe.h.
 */
#define OBOE_DEFAULT_SETTINGS_INTERVAL 30

/**
 * Default interval to check for timed out settings records in seconds
 */
#define OBOE_DEFAULT_TIMEOUT_CHECK_INTERVAL 10

/**
 * Default metrics flush interval in seconds
 */
#define OBOE_DEFAULT_METRICS_FLUSH_INTERVAL 60

/**
 * Default maximum number of transaction names to track when aggregating metric and histogram data by individual service transaction
 */
#define OBOE_DEFAULT_MAX_TRANSACTIONS 200

/**
 * Default maximum number of custom metrics per flash interval
 */
#define OBOE_DEFAULT_MAX_CUSTOM_METRICS 500

/**
 * Default keepalive interval in seconds.
 *
 * A keepalive message will be sent after communications are idle for this interval.
 */
#define OBOE_DEFAULT_KEEPALIVE_INTERVAL 20

/**
 * Time to wait for all remaining data to be sent off
 */
#define DEFAULT_FLUSH_MAX_WAIT_TIME 5000

/**
 * Default events flush timeout in seconds.
 */
#define OBOE_DEFAULT_EVENTS_FLUSH_INTERVAL 2
/**
 * Default max request size in bytes.
 */
#define OBOE_DEFAULT_MAX_REQUEST_SIZE_BYTES 3000000
/**
 * Default EC2 metadata timeout in milliseconds
 */
#define OBOE_DEFAULT_EC2_METADATA_TIMEOUT 50

#define OBOE_SAMPLE_RESOLUTION 1000000

#define OBOE_TASK_ID_TRACEPARENT_LEN 16
#define OBOE_MAX_TASK_ID_LEN 20
#define OBOE_MAX_OP_ID_LEN 8
#define OBOE_MAX_METADATA_PACK_LEN 512

#define TRACEPARENT_CURRENT_VERSION 0

#define XTR_CURRENT_VERSION 2

#define XTR_FLAGS_NOT_SAMPLED 0x0
#define XTR_FLAGS_SAMPLED 0x1

#define XTR_UDP_PORT 7831

#define OBOE_REPORTER_PROTOCOL_FILE "file"
#define OBOE_REPORTER_PROTOCOL_UDP "udp"
#define OBOE_REPORTER_PROTOCOL_SSL "ssl"
#define OBOE_REPORTER_PROTOCOL_NULL "null"

/** Maximum reasonable length of an arguments string for configuring a reporter. */
#define OBOE_REPORTER_ARGS_SIZE 4000

#ifdef _WIN32
/// SRv1 bitwise value mask for the RUM_ENABLE flag.
#define SETTINGS_RUM_ENABLE_MASK 0x00000001
#endif

#ifndef HOST_NAME_MAX
#define HOST_NAME_MAX 256
#endif

#if !defined(AO_GETPID)
     #if defined(_WIN32)
        #define AO_GETPID GetCurrentProcessId
     #else
        #define AO_GETPID getpid
     #endif
#endif

#if !defined(PID_T_DEF)
#define PID_T_DEF
typedef int pid_t;
#endif //PID_T_DEF

// structs

typedef struct oboe_ids {
    uint8_t task_id[OBOE_MAX_TASK_ID_LEN];
    uint8_t op_id[OBOE_MAX_OP_ID_LEN];
} oboe_ids_t;

typedef struct oboe_metadata {
    uint8_t     version;
    oboe_ids_t  ids;
    size_t      task_len;
    size_t      op_len;
    uint8_t     flags;
#ifdef _FUTURE_PLANS_
    /* Can't add this without breaking the ABI, but someday... */
    int         auto_delete;
#endif /* _FUTURE_PLANS_ */
} oboe_metadata_t;

typedef struct oboe_event {
    oboe_metadata_t metadata;
    oboe_bson_buffer     bbuf;
    char *          bb_str;
#ifdef _FUTURE_PLANS_
    /* Can't add this without breaking the ABI, but someday... */
    int             auto_delete;
#endif /* _FUTURE_PLANS_ */
} oboe_event_t;

typedef struct oboe_metric_tag {
    char *key;
    char *value;
} oboe_metric_tag_t;

typedef struct oboe_init_options {
    int version;                            // the version of this structure (currently on version 16)
    const char *hostname_alias;             // optional hostname alias
    int log_level;                          // level at which log messages will be written to log file (0-6)
                                            // use OBOE_INIT_LOG_LEVEL_INFO(3) for default log level
    const char *log_file_path;              // file name including path for log file
    int max_transactions;                   // maximum number of transaction names to track
    int max_flush_wait_time;                // maximum wait time for flushing data before terminating in milli seconds
    int events_flush_interval;              // events flush timeout in seconds (threshold for batching messages before sending off)
    int max_request_size_bytes;             // limit max RPC request size

    const char *reporter;                   // the reporter to be used (ssl, upd, file, null, lambda)
    const char *host;                       // collector endpoint (reporter=ssl), udp address (reporter=udp), or file path (reporter=file)
    const char *service_key;                // the service key
    const char *certificates;               // content of SSL certificates, passed to gRPC::SslCredentialsOptions() for collector connection verification
    int buffer_size;                        // size of the message buffer
    int trace_metrics;                      // flag indicating if trace metrics reporting should be enabled (default) or disabled
    int histogram_precision;                // the histogram precision (only for ssl)
    double token_bucket_capacity;           // custom token bucket capacity
    double token_bucket_rate;               // custom token bucket rate
    int file_single;                        // use single files in file reporter for each event

    int ec2_metadata_timeout;               // EC2 metadata timeout in milliseconds
    const char *proxy;                      // HTTP proxy address and port to be used for the gRPC connection
    int stdout_clear_nonblocking;           // flag indicating if the O_NONBLOCK flag on stdout should be cleared,
                                            // only used in lambda reporter (off=0, on=1, default off)
    int metric_format;                      // flag indicating the format of metric (0 = Both; 1 = TransactionResponseTime only; 2 = ResponseTime only; default = 0)
    int log_type;                           // log type (0 = stderr; 1 = stdout; 2 = file; 3 = null; 4 = disabled; default = 0)
} oboe_init_options_t;

typedef struct oboe_span_params {
    int version;                    // the version of this structure
    const char *service;            // custom service name (will be NULL or empty if default service name should be used)
    const char *transaction;        // transaction name (will be NULL or empty if url given)
    const char *url;                // the raw url which will be processed and used as transaction name
                                    // (if transaction is NULL or empty)
    const char *domain;             // a domain to be prepended to the transaction name (can be NULL)
    int64_t duration;               // the duration of the span in micro seconds (usec)
    int status;                     // HTTP status code (e.g. 200, 500, ...)
    const char *method;             // HTTP method (e.g. GET, POST, ...)
    int has_error;                  // boolean flag whether this transaction contains an error (1) or not (0)
    int do_metrics;                 // boolean flag whether a (HTTP) span should be sent (1) or not (0)
} oboe_span_params_t;

//
// oboe_get_tracing_decisions input and output structures
//
typedef struct oboe_tracing_decisions_in {
    int version;                    // the version of this structure
    const char *service_name;       // custom service name
    const char *in_xtrace;          // existing X-Trace from passed in HTTP header
    int custom_sample_rate;         // custom sample rate
    int custom_tracing_mode;        // custom tracing mode

    // v2
    int custom_trigger_mode;        // custom trigger mode
    int request_type;               // the request type: OBOE_REQUEST_TYPE_REGULAR, OBOE_REQUEST_TYPE_TRIGGER
    const char *header_options;     // X-Trace-Options HTTP header value
    const char *header_signature;   // X-Trace-Options-Signature HTTP header value
    time_t header_timestamp;        // timestamp from X-Trace-Options header, converted to UNIX timestamp format

    // v3
    const char *tracestate;         // value part of the parsed `sw` entry in the tracestate header, if any
} oboe_tracing_decisions_in_t;

typedef struct oboe_tracing_decisions_out {
    int version;
    int sample_rate;
    int sample_source;
    int do_sample;
    int do_metrics;

    // v2
    int request_provisioned;
    int auth_status;
    const char *auth_message;
    const char *status_message;

    // v3
    double token_bucket_rate;
    double token_bucket_capacity;
} oboe_tracing_decisions_out_t;

typedef struct oboe_internal_stats {
    int version;
    int reporters_initialized;
    int event_queue_free;
    int collector_response_ok;
    int collector_response_try_later;
    int collector_response_limit_exceeded;
} oboe_internal_stats_t;

#define OBOE_SPAN_PARAMS_VERSION 2              // version of oboe_span_params_t
#define OBOE_TRANSACTION_NAME_MAX_LENGTH 255    // max allowed length for transaction name

#ifndef MIN
#define MIN(a,b) (((a) < (b)) ? (a) : (b))
#endif
#ifndef MAX
#define MAX(a,b) (((a) > (b)) ? (a) : (b))
#endif

// oboe_metadata

#ifdef _FUTURE_PLANS_
oboe_metadata_t *oboe_metadata_new();
#endif /* _FUTURE_PLANS_ */
int oboe_metadata_init      (oboe_metadata_t *);
int oboe_metadata_destroy   (oboe_metadata_t *);

int oboe_metadata_is_valid   (const oboe_metadata_t *);

int oboe_metadata_copy     (oboe_metadata_t *, const oboe_metadata_t *);

int oboe_metadata_random   (oboe_metadata_t *);

int oboe_metadata_create_event  (const oboe_metadata_t *, oboe_event_t *);

int oboe_metadata_tostr     (const oboe_metadata_t *, char *, size_t);
int oboe_metadata_tostr_traceparent2xtrace     (const oboe_metadata_t *, char *, size_t);
int oboe_metadata_fromstr   (oboe_metadata_t *, const char *, size_t);

int oboe_metadata_is_sampled(oboe_metadata_t *md);

// oboe_event

#ifdef _FUTURE_PLANS_
oboe_event_t *oboe_event_new(const oboe_metadata_t *);
#endif /* _FUTURE_PLANS_ */
int oboe_event_init     (oboe_event_t *, const oboe_metadata_t *, const uint8_t* event_op_id);
int oboe_event_destroy  (oboe_event_t *);

int oboe_event_add_info (oboe_event_t *, const char *, const char *);
int oboe_event_add_info_int64 (oboe_event_t *, const char *, const int64_t);
int oboe_event_add_info_double (oboe_event_t *, const char *, const double);
int oboe_event_add_info_bool (oboe_event_t *, const char *, const int);
int oboe_event_add_info_bson (oboe_event_t *, const char *key, const oboe_bson *val);
int oboe_event_add_edge (oboe_event_t *, const oboe_metadata_t *);
int oboe_event_add_edge_fromstr(oboe_event_t *, const char *, size_t);

int oboe_event_add_timestamp(oboe_event_t *evt);
int oboe_event_add_tid(oboe_event_t* evt);
int oboe_event_add_hostname(oboe_event_t *evt);

/**
 * Send event message using the default reporter.
 *
 * @param channel the channel to send out this message (OBOE_SEND_EVENT or OBOE_SEND_STATUS)
 * @param evt The event message.
 * @param md The X-Trace metadata.
 * @return Length of message sent in bytes on success; otherwise -1.
 */
int oboe_event_send(int channel, oboe_event_t *evt, oboe_metadata_t *md);

/**
 * Send event message using the default reporter. (Only for python otel exporter)
 * This function won't add Timestamp_u by default
 * @param channel the channel to send out this message (OBOE_SEND_EVENT or OBOE_SEND_STATUS)
 * @param evt The event message.
 * @param md The X-Trace metadata.
 * @return Length of message sent in bytes on success; otherwise -1.
 */
int oboe_event_send_without_timestamp(int channel, oboe_event_t *evt, oboe_metadata_t *md);

// oboe_context

oboe_metadata_t *oboe_context_get();
int oboe_context_set(oboe_metadata_t *);
int oboe_context_set_fromstr(const char *, size_t);

int oboe_context_clear();

int oboe_context_is_valid();

int oboe_context_is_sampled();

// oboe_reporter

struct oboe_reporter;

/* TODO: Move struct oboe_reporter to private header. */
typedef int (*reporter_ready)(void *);
typedef int (*reporter_is_within_limit)(void *, const char *, const char *);
typedef ssize_t (*reporter_send)(void *, int, const char *, size_t);
typedef int (*reporter_send_span)(void *, const char *, const char *, const int64_t, const int);
typedef int (*reporter_send_http_span)(void *, const char *, const char *, const int64_t, const int, const char *, const int);
typedef int (*reporter_add_custom_metric)(void *, const char *, const double, const int, const int, const char *, const int, const oboe_metric_tag_t*, const size_t);
typedef int (*reporter_destroy)(void *);
typedef int (*reporter_server_response)(void *);
typedef const char* (*reporter_server_warning)(void *);
typedef int (*reporter_profiling_interval)(void *);
typedef int (*reporter_flush)(void *);
typedef struct oboe_reporter {
    void *              descriptor;     /*!< Reporter's context. */
    reporter_ready      eventReady;     /*!< Check if the reporter is ready for another trace. */
    reporter_ready      profilingReady; /*!< Check if the reporter is ready for another profiling snapshot. */
    reporter_ready      statusReady;    /*!< Check if the reporter is ready for another status. */
    reporter_ready      spanReady;      /*!< Check if the reporter is ready for another span. */
    reporter_is_within_limit isWithinLimit;
    reporter_ready      customMetricsReady;     /*!< Check if the reporter is ready for another custom metric. */
    reporter_send       send;           /*!< Send a trace event message. */
    reporter_send_span  sendSpan;
    reporter_send_http_span  sendHttpSpan;
    reporter_add_custom_metric addCustomMetric;
    reporter_destroy    destroy;        /*!< Destroy the reporter - release all resources. */
    reporter_server_response getServerResponse;
    reporter_profiling_interval profilingInterval;
    reporter_server_warning getServerWarning;
    reporter_flush flush;
} oboe_reporter_t;

/**
 * Check if the reporter is ready to send.
 *
 * The concept of 'ready' is depends on the specific reporter being used.
 *
 * @param rep The reporter context (optional).
 * @return Non-zero if the reporter is ready to send.
 */
int oboe_reporter_is_ready(oboe_reporter_t *rep);   /* DEPRECATE: Use oboe_is_ready() */

/**
 * Release any resources held by the reporter context.
 *
 * @param rep Pointer to a reporter context structure.
 * @return Zero on success; otherwise non-zero to indicate an error.
 */
int oboe_reporter_destroy(oboe_reporter_t *rep);    /* DEPRECATE: Use oboe_shutdown() */

ssize_t oboe_reporter_udp_send(void *desc, const char *data, size_t len);   /* DEPRECATE - Use oboe_event_send() */

/* Oboe initialization and reporter management */

/**
 * Initialize the Oboe subsystems.
 *
 * Should be called before any other oboe_* functions.
 * However, in order to make the library easier to work with, checks
 * are in place so that it will be called by any of the other functions
 * that depend on it.
 *
 * Besides initializing the oboe library, this will also initialize a
 * reporter based on the values of environment variables, configuration
 * file options, and whether a tracelyzer is installed.
 *
 * @param options init options
 * @return One of the OBOE_INIT_* macros
 */
int oboe_init(oboe_init_options_t* options);

/**
 * Initialize the Oboe subsytems using a specific reporter configuration.
 *
 * This should be called before any other oboe_* functions butm may also be
 * used to change or re-initialize the current reporter.  To reconnect the
 * reporter use oboe_disconnect() and oboe_reconnect() instead.
 *
 * @param protocol One of  OBOE_REPORTER_PROTOCOL_FILE, OBOE_REPORTER_PROTOCOL_UDP,
 *      or OBOE_REPORTER_PROTOCOL_SSL.
 * @param args A configuration string for the specified protocol (protocol dependent syntax).
 * @return One of the OBOE_INIT_* macros
 */
int oboe_init_reporter(const char *protocol, oboe_init_options_t *options);

/**
 * returns one of these:
 * - OBOE_INIT_OPTIONS_SET_DEFAULTS_OK
 * - OBOE_INIT_OPTIONS_SET_DEFAULTS_WRONG_VERSION
 */
int oboe_init_options_set_defaults(oboe_init_options_t *options);

/**
 * tell reporter to flush all messages that are currently buffered
 */
int oboe_reporter_flush();

/**
 * get the reporter type used
 */
const char* oboe_get_reporter_type();

/**
 * Get reporter default_endpoint
 * It returns static information from each reporter class and doesn't require oboe_init before calling it
 * @param reporter_type const char* e.g. SSL, UDP, FILE, ...
 * @param default_endpoint const char* <empty> means no default endpoint
 */
const char* oboe_get_reporter_default_endpoint(const char* reporter_type);

/**
 * Check if system is AWS Lambda
 */
int oboe_is_lambda();

/**
 * Check if oboe is ready
 *
 * Ready means reporters are ready and settings have been received
 *
 * @param timeout a timeout value (in milli seconds) to wait until ready, zero means don't wait
 * @return server response code (e.g. OBOE_SERVER_RESPONSE_OK)
 */
int oboe_is_ready(const uint32_t timeout);

/**
 * Send a raw message using the current reporter.
 *
 * Use oboe_event_send() unless you are handling all the details of constructing
 * the messages for a valid trace.
 *
 * @param channel the channel to send out this message (OBOE_SEND_EVENT or OBOE_SEND_STATUS)
 * @param data A BSON-encoded event message.
 * @param len The length of the message data in bytes.
 * @return Length of message sent in bytes on success; otherwise -1.
 */
int oboe_raw_send(int channel, const char *data, size_t len);

/**
 * Shut down the Oboe subsystems.
 *
 * This may be called on exit in order to release any resources held by
 * the Oboe library including any child threads.
 */
void oboe_shutdown();

/**
 * Don't call *coming_impl function directly, they are temporary
 */
bool oboe_validate_tracing_decisions_in_t(oboe_tracing_decisions_in_t *in);
int oboe_init_coming_impl(const char* json);
int oboe_tracing_decisions_coming_impl(oboe_tracing_decisions_in_t *in, oboe_tracing_decisions_out_t *out);
void oboe_shutdown_coming_impl();

// Settings interface

#define OBOE_SETTINGS_VERSION 1
#define OBOE_SETTINGS_MAGIC_NUMBER 0x6f626f65
#define OBOE_SETTINGS_TYPE_DEFAULT_SAMPLE_RATE 0
#define OBOE_SETTINGS_TYPE_LAYER_SAMPLE_RATE 1
#define OBOE_SETTINGS_TYPE_LAYER_APP_SAMPLE_RATE 2
#define OBOE_SETTINGS_TYPE_LAYER_HTTPHOST_SAMPLE_RATE 3
#define OBOE_SETTINGS_TYPE_CONFIG_STRING 4
#define OBOE_SETTINGS_TYPE_CONFIG_INT 5
#define OBOE_SETTINGS_FLAG_OK             0x0
#define OBOE_SETTINGS_FLAG_INVALID        0x1
#define OBOE_SETTINGS_FLAG_OVERRIDE       0x2
#define OBOE_SETTINGS_FLAG_SAMPLE_START   0x4
#define OBOE_SETTINGS_FLAG_SAMPLE_THROUGH 0x8
#define OBOE_SETTINGS_FLAG_SAMPLE_THROUGH_ALWAYS 0x10
#define OBOE_SETTINGS_FLAG_TRIGGERED_TRACE 0x20
#define OBOE_SETTINGS_MAX_STRLEN 256

#define OBOE_SETTINGS_UNSET -1

// Value for "SampleSource" info key
// where was the sample rate specified? (oboe settings, config file, hard-coded default, etc)
#define OBOE_SAMPLE_RATE_SOURCE_FILE 1
#define OBOE_SAMPLE_RATE_SOURCE_DEFAULT 2
#define OBOE_SAMPLE_RATE_SOURCE_OBOE 3
#define OBOE_SAMPLE_RATE_SOURCE_LAST_OBOE 4
#define OBOE_SAMPLE_RATE_SOURCE_DEFAULT_MISCONFIGURED 5
#define OBOE_SAMPLE_RATE_SOURCE_OBOE_DEFAULT 6
#define OBOE_SAMPLE_RATE_SOURCE_CUSTOM 7

#define OBOE_SAMPLE_RESOLUTION 1000000

// Used to convert to settings flags:
#define OBOE_TRACE_NEVER   0    // deprecated: do not use, only here for backward compatibility
#define OBOE_TRACE_ALWAYS  1    // deprecated: do not use, only here for backward compatibility
#define OBOE_TRACE_DISABLED   0
#define OBOE_TRACE_ENABLED  1
#define OBOE_TRIGGER_DISABLED   0
#define OBOE_TRIGGER_ENABLED  1

#define OBOE_SEND_EVENT 0
#define OBOE_SEND_STATUS 1
#define OBOE_SEND_PROFILING 2

// these codes are used by oboe_is_ready()
#define OBOE_SERVER_RESPONSE_UNKNOWN 0
#define OBOE_SERVER_RESPONSE_OK 1
#define OBOE_SERVER_RESPONSE_TRY_LATER 2
#define OBOE_SERVER_RESPONSE_LIMIT_EXCEEDED 3
#define OBOE_SERVER_RESPONSE_INVALID_API_KEY 4    // deprecated
#define OBOE_SERVER_RESPONSE_CONNECT_ERROR 5

// these codes are used by oboe_span() and oboe_http_span()
#define OBOE_SPAN_NULL_PARAMS -1
#define OBOE_SPAN_NULL_BUFFER -2
#define OBOE_SPAN_INVALID_VERSION -3
#define OBOE_SPAN_NO_REPORTER -4
#define OBOE_SPAN_NOT_READY -5

// these codes are returned by oboe_sample_layer_custom(), oboe_tracing_decisions(),
// oboe_reporter_is_ready(), and referenced in settings_messages.c (to convert
// error codes to messages.)
//
// they are structured such that codes that are <= 0 are successful, i.e., no
// error status needs to be reported to the user, while codes > 0 are errors that
// need to be reported.

#define OBOE_TRACING_DECISIONS_FAILED_AUTH -5
#define OBOE_TRACING_DECISIONS_TRIGGERED_TRACE_EXHAUSTED -4
#define OBOE_TRACING_DECISIONS_TRIGGERED_TRACE_DISABLED -3
#define OBOE_TRACING_DECISIONS_TRACING_DISABLED -2
#define OBOE_TRACING_DECISIONS_XTRACE_NOT_SAMPLED -1
#define OBOE_TRACING_DECISIONS_OK 0
#define OBOE_TRACING_DECISIONS_NULL_OUT 1
#define OBOE_TRACING_DECISIONS_NO_CONFIG 2
#define OBOE_TRACING_DECISIONS_REPORTER_NOT_READY 3
#define OBOE_TRACING_DECISIONS_NO_VALID_SETTINGS 4
#define OBOE_TRACING_DECISIONS_QUEUE_FULL 5
#define OBOE_TRACING_DECISIONS_BAD_ARG 6

// convert above codes into const char* messages.
const char* oboe_get_tracing_decisions_message(int code);

#define OBOE_TRACING_DECISIONS_AUTH_NOT_CHECKED -2
#define OBOE_TRACING_DECISIONS_AUTH_NOT_PRESENT -1
#define OBOE_TRACING_DECISIONS_AUTH_OK 0
#define OBOE_TRACING_DECISIONS_AUTH_NO_SIG_KEY 1
#define OBOE_TRACING_DECISIONS_AUTH_INVALID_SIG 2
#define OBOE_TRACING_DECISIONS_AUTH_BAD_TIMESTAMP 3
#define OBOE_TRACING_DECISIONS_AUTH_INTERNAL_ERROR 4

// convert above codes into const char* messages.
const char* oboe_get_tracing_decisions_auth_message (int code);

#define OBOE_REQUEST_TYPE_NONE -1
#define OBOE_REQUEST_TYPE_REGULAR 0
#define OBOE_REQUEST_TYPE_TRIGGER 1

#define OBOE_INIT_OPTIONS_SET_DEFAULTS_OK 0
#define OBOE_INIT_OPTIONS_SET_DEFAULTS_WRONG_VERSION 1

//
// these codes are returned by oboe_init(), oboe_init_reporter(), _oboe_create_reporter()
//
#define OBOE_INIT_ALREADY_INIT -1
#define OBOE_INIT_OK 0
#define OBOE_INIT_WRONG_VERSION 1
#define OBOE_INIT_INVALID_PROTOCOL 2
#define OBOE_INIT_NULL_REPORTER 3
#define OBOE_INIT_DESC_ALLOC 4
#define OBOE_INIT_FILE_OPEN_LOG 5
#define OBOE_INIT_UDP_NO_SUPPORT 6
#define OBOE_INIT_UDP_OPEN 7
#define OBOE_INIT_SSL_CONFIG_AUTH 8
#define OBOE_INIT_SSL_LOAD_CERT 9
#define OBOE_INIT_SSL_REPORTER_CREATE 10
#define OBOE_INIT_SSL_MISSING_KEY 11

//
// these codes are returned by oboe_custom_metric_summary() and oboe_custom_metric_increment()
//
#define OBOE_CUSTOM_METRICS_OK 0
#define OBOE_CUSTOM_METRICS_INVALID_COUNT 1
#define OBOE_CUSTOM_METRICS_INVALID_REPORTER 2
#define OBOE_CUSTOM_METRICS_TAG_LIMIT_EXCEEDED 3
#define OBOE_CUSTOM_METRICS_STOPPING 4
#define OBOE_CUSTOM_METRICS_QUEUE_LIMIT_EXCEEDED 5

//
// these codes are returned by oboe_reporter_flush()
//
#define OBOE_REPORTER_FLUSH_OK 0
#define OBOE_REPORTER_FLUSH_METRIC_ERROR 1
#define OBOE_REPORTER_FLUSH_BAD_UTF8 2
#define OBOE_REPORTER_FLUSH_NO_REPORTER 3
#define OBOE_REPORTER_FLUSH_REPORTER_NOT_READY 4

#define OBOE_INIT_LOG_LEVEL_FATAL 0
#define OBOE_INIT_LOG_LEVEL_ERROR 1
#define OBOE_INIT_LOG_LEVEL_WARNING 2
#define OBOE_INIT_LOG_LEVEL_INFO 3
#define OBOE_INIT_LOG_LEVEL_DEBUG 4
#define OBOE_INIT_LOG_LEVEL_PREVIOUS_MEDIUM 5
#define OBOE_INIT_LOG_LEVEL_TRACE 6

#define OBOE_INIT_LOG_TYPE_STDERR 0
#define OBOE_INIT_LOG_TYPE_STDOUT 1
#define OBOE_INIT_LOG_TYPE_FILE 2
#define OBOE_INIT_LOG_TYPE_NULL 3               // NULL means no output
#define OBOE_INIT_LOG_TYPE_DISABLE 4            // Explicit disable logging

// token buckets
enum TOKEN_BUCKETS {
  TOKEN_BUCKET_SAMPLING,    // for normal requests
  TOKEN_BUCKET_TT_RELAXED,  // for triggered traces initiated by Pingdom and
                            // other trusted sources (relaxed settings)
  TOKEN_BUCKET_TT_STRICT,   // for triggered traces initiated by CLI and
                            // other untrusted sources (strict settings)
  TOKEN_BUCKET_COUNT        // IMPORTANT NOTE: this must be the last element
                            // inside the enum
};

typedef struct {
    uint32_t magic;
    uint32_t timestamp;
    uint16_t type;
    uint16_t flags;
    uint32_t value;
    uint32_t ttl;
    uint32_t _pad;
    char layer[OBOE_SETTINGS_MAX_STRLEN]; // Flawfinder: ignore
    double bucket_capacity[TOKEN_BUCKET_COUNT];
    double bucket_rate_per_sec[TOKEN_BUCKET_COUNT];
    char signature_key[OBOE_SETTINGS_MAX_STRLEN]; // Flawfinder: ignore
} oboe_settings_t;

typedef struct {
    float available;
    double capacity;
    double rate_per_usec; // time is usecs from gettimeofday
    struct timeval last_check;
} token_bucket_t;


typedef struct {
    char name[OBOE_SETTINGS_MAX_STRLEN]; // Flawfinder: ignore
    volatile uint32_t request_count;            // all the requests that came through this layer
    volatile uint32_t exhaustion_count;         // # of times the token bucket limiting caused a trace to not occur
    volatile uint32_t trace_count;              // # of traces that were sent (includes "enabled" or "through" traces)
    volatile uint32_t sample_count;             // # of traces that caused a random coin-flip (not "through" traces)
    volatile uint32_t through_count;            // # of through traces
    volatile uint32_t through_ignored_count;    // # of new requests, that are rejected due to start_always_flag == 0
                                                // that have through_always_flag == 1
    volatile uint32_t triggered_count;             // # of triggered traces
    volatile uint32_t last_used_sample_rate;
    volatile uint32_t last_used_sample_source;

    volatile uint8_t used;
} entry_layer_t;

// Current settings configuration:
typedef struct {
    int tracing_mode;          // pushed from server, override from config file
    int sample_rate;           // pushed from server, override from config file
    int trigger_mode;          // pushed from server, override from config file
    oboe_settings_t *settings; // cached settings, updated by tracelyzer (init to NULL)
    int last_auto_sample_rate; // stores last known automatic sampling rate
    uint16_t last_auto_flags;  // stores last known flags associated with above
    uint32_t last_auto_timestamp; // timestamp from last *settings lookup
    uint32_t last_refresh;        // last refresh time
    token_bucket_t bucket[TOKEN_BUCKET_COUNT];     // token buckets for various tasks
} oboe_settings_cfg_t;

int oboe_settings_init_local();
oboe_settings_t* oboe_settings_get(uint16_t type, const char* layer, const char* arg);
oboe_settings_t* oboe_settings_get_layer_tracing_mode(const char* layer);
oboe_settings_t* oboe_settings_get_layer_sample_rate(const char* layer);
uint32_t oboe_settings_get_latest_timestamp(const char* layer);
int oboe_settings_get_value(oboe_settings_t *s, int *outval, unsigned short *outflags, uint32_t *outtimestamp);
entry_layer_t* oboe_settings_entry_layer_get(const char* name);

oboe_settings_cfg_t* oboe_settings_cfg_get();
void oboe_settings_cfg_init(oboe_settings_cfg_t *cfg);

void oboe_settings_set(int sample_rate, int tracing_mode, int trigger_mode);
void oboe_settings_rate_set(int sample_rate);
void oboe_settings_mode_set(int tracing_mode);
void oboe_settings_trigger_set(int trigger_mode);

/**
 * Convert a tracing mode to a printable string.
 */
const char *oboe_tracing_mode_to_string(int tracing_mode);

/**
 * Check if sampling is enabled.
 *
 * @param cfg Optional pointer to the settings configuration for the current
 *          thread, as an optimization to avoid retrieving it.  May be NULL.
 * @return Non-zero if sampling is now enabled.
 */
int oboe_sample_is_enabled(oboe_settings_cfg_t *cfg);

/**
 * Check if this request should be sampled.
 *
 * Checks for sample rate flags and settings for the specified service, considers
 * the current tracing mode and any special features in the X-Trace
 * headers, and, if appropriate, rolls the virtual dice to
 * decide if this request should be sampled.
 *
 * This is designed to be called once per request.
 *
 * @param in Struct containing all params to help making a tracing decision
 * @param out Struct containing all params that get set during decision making
 */
int oboe_tracing_decisions(oboe_tracing_decisions_in_t *in, oboe_tracing_decisions_out_t *out);

/* Oboe configuration interface. */
#ifndef _WIN32
/**
 * Check if the Oboe library is compatible with a given version.revision.
 *
 * This will succeed if the library is at least as recent as specified and if no
 * definitions have been removed since that revision.
 *
 * @param version The library's version number which increments every time the API changes.
 * @param revision The revision of the current version of the library.
 * @return Non-zero if the Oboe library is considered compatible with the specified revision.
 */
extern int oboe_config_check_version(int version, int revision);
#endif
/**
 * Get the Oboe library version number.
 *
 * This number increments whenever the API is changed.
 *
 * @return The library's version number or -1 if the version is not known.
 */
extern int oboe_config_get_version();

/**
 * Get the Oboe library revision number.
 *
 * This is the revision of the current version which is updated whenever
 * compatible changes are made to the API/ABI (ie. additions).
 *
 * @return The library's revision number or -1 if not known.
 */
extern int oboe_config_get_revision();

/*
 * Get the Oboe library version as a string.
 *
 * Returns the complete VERSION string or null
 */
const char* oboe_config_get_version_string();

// Span reporting

/*
 * generate a new general span
 *
 * @param buffer        a char buffer where the final transaction name will be written to
 * @param buffer_length the length of the char buffer
 * @param params        additional span parameters
 *
 * @return  size of the final transaction name written to buffer
 *          if an error occurs, these values will be returned:
 *          - OBOE_SPAN_NULL_PARAMS
 *          - OBOE_SPAN_NULL_BUFFER
 *          - OBOE_SPAN_INVALID_VERSION
 *          - OBOE_SPAN_NO_REPORTER
 *          - OBOE_SPAN_NOT_READY
 */
int oboe_span(char *buffer, const uint16_t buffer_length, oboe_span_params_t *params);

/*
 * generate a new HTTP span
 *
 * @param buffer        a char buffer where the final transaction name will be written to
 * @param buffer_length the length of the char buffer
 * @param params        additional span parameters
 *
 * @return  size of the final transaction name written to buffer
 *          if an error occurs, these values will be returned:
 *          - OBOE_SPAN_NULL_PARAMS
 *          - OBOE_SPAN_NULL_BUFFER
 *          - OBOE_SPAN_INVALID_VERSION
 *          - OBOE_SPAN_NO_REPORTER
 *          - OBOE_SPAN_NOT_READY
 */
int oboe_http_span(char *buffer, const uint16_t buffer_length, oboe_span_params_t *params);

/*
 * helper functions to mark the start/end of a span
 *
 * @return monotonic time in micro seconds (usec) since some unspecified starting point
 */
int64_t oboe_span_start();
int64_t oboe_span_stop();

// Custom metrics

int oboe_custom_metric_summary(const char *name, const double value, const int count, const int host_tag, const char *service_name,
        const oboe_metric_tag_t tags[], const size_t tags_count);

int oboe_custom_metric_increment(const char *name, const int count, const int host_tag, const char *service_name,
        const oboe_metric_tag_t tags[], const size_t tags_count);

// Service names

/*
 * Perform validation and replacement of invalid characters on the given service name.
 *
 * The rules are as follows:
 *    .toLowerCase() // automatically convert to lowercase
 *    .replace(/ /g, "-") // automatically convert spaces to hyphens
 *    .replace(/[^a-z0-9.:_-]/g, ""); // remove remaining invalid characters
 *
 * @param service_name pointer to the service name string to perform the validation on
 *        (important: address must be editable)
 * @param length pointer to the length of the service name
 *
 * @return 0 if service name is valid
 *         1 if service name was invalid and has been transformed
 *           (new valid service name is stored in service_name and length)
 *        -1 NULL pointer passed in for service_name or length
 */
int oboe_validate_transform_service_name(char *service_name, int *length);

// Timer tools
void oboe_timer_tool_wait(int usec);

// Get profiling interval as configured remotely
int oboe_get_profiling_interval();

// Get server warning message
const char* oboe_get_server_warning();

// Regex tools (Deprecated)
void* oboe_regex_new_expression(const char* exprString);
void oboe_regex_delete_expression(void* expression);
int oboe_regex_match(const char* string, void* expression);

/* oboe internal stats for agents to consume */
oboe_internal_stats_t* oboe_get_internal_stats();

// Random
void oboe_random_bytes(uint8_t bytes[], size_t sz);

// oboe logging macro (Phasing out marco)
#define OBOE_DEBUG_LOG_CONFIG(module, app_name, trace_mode, sample_rate, reporter_type, reporter_args, extra) do {} while(0)
#define OBOE_DEBUG_LOG_FATAL(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_ERROR(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_WARNING(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_INFO(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_LOW(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_MEDIUM(module, ...) do {} while(0)
#define OBOE_DEBUG_LOG_HIGH(module, ...) do {} while(0)

void oboe_init_once();

/**
 * Request Counts function
 * If succeed, it can get the value and reset the value to 0
 * @param value output value
 * @return bool
 */
bool oboe_consume_request_count(unsigned int* value);
bool oboe_consume_token_bucket_exhaustion_count(unsigned int* value);
bool oboe_consume_trace_count(unsigned int* value);
bool oboe_consume_sample_count(unsigned int* value);
bool oboe_consume_through_ignored_count(unsigned int* value);
bool oboe_consume_through_trace_count(unsigned int* value);
bool oboe_consume_triggered_trace_count(unsigned int* value);
/**
 * Request Counts function
 * If succeed, it can get the value
 * @param value output value
 * @return bool
 */
bool oboe_get_last_used_sample_rate(unsigned int* value);
bool oboe_get_last_used_sample_source(unsigned int* value);

#ifdef __cplusplus
} // extern "C"
#endif

#endif // LIBOBOE_H
