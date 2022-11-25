/**
 * @file oboe_api.hpp - C++ liboboe wrapper primarily for generating SWIG interfaces
 * and used by Ruby c++ extension for profiling
 *
 * TODO:  This doc is outdated
 * This API should follow https://github.com/tracelytics/tracelons/wiki/Instrumentation-API
 */

#ifndef OBOE_API_HPP
#define OBOE_API_HPP

#include <unistd.h>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>

#include "oboe.h"

class Event;
class Reporter;
class Context;

// exclude some stuff that unnecessarily bloats the swig interface
#ifndef SWIG
// FrameData is for profiling and only used via Ruby directly compiled c++ code
typedef struct frame_data {
    std::string klass;
    std::string method;
    std::string file;
    int lineno = 0;
} FrameData;
#endif  // SWIG exclusion

/**
 * Metadata is the X-Trace identifier and the information needed to work with it.
 */
class Metadata : private oboe_metadata_t {
    friend class Reporter;
    friend class Context;

   public:
    Metadata(const oboe_metadata_t *md);
    ~Metadata();

    // these new objects are managed by SWIG %newobject
    /**
     * Create a new event object using this Metadata's context.
     *
     * NOTE: The returned object must be "delete"d.
     */
    Event *createEvent();

    Metadata *copy();
    bool isValid();
    bool isSampled();

    static Metadata *makeRandom(bool sampled = true);
    static Metadata *fromString(std::string s);

    oboe_metadata_t *metadata();

#ifdef SWIGJAVA
    std::string toStr();
#else
    std::string toString();
#endif
};

/**
 * The Context class manages the metadata and the settings configuration.
 *
 * The metadata includes the X-Trace identifier fields and the information work working with it.
 * The metadata is needed before any trace messages can be sent and must either be generated for
 * new traces or derived from the X-Trace header of an existing trace.
 *
 * The settings information is used primarily to determine when a new request should be traced.
 * The information begins with configuration values for tracing_mode and sample_rate and then
 * updates are received periodically from the collector to adjust the rate at which traces
 * are generated.
 */
class Context {
   public:
    /**
     * Set the tracing mode.
     *
     * @param newMode One of
     * - OBOE_TRACE_DISABLED(0) to disable tracing,
     * - OBOE_TRACE_ENABLED(1) to start a new trace if needed, or
     * - OBOE_TRACE_THROUGH(2) to only add to an existing trace.
     */
    static void setTracingMode(int newMode);

    /**
     * Set the trigger tracing mode.
     *
     * @param newMode One of
     * - OBOE_TRIGGER_DISABLED(0) to disable tracing, or
     * - OBOE_TRIGGER_ENABLED(1) to start a new trace if needed
     */
    static void setTriggerMode(int newMode);

    /**
     * Set the default sample rate.
     *
     * This rate is used until overridden by the AppOptics servers.  If not set then the
     * value comes from settings records downloaded from AppOptics.
     *
     * The rate is interpreted as a ratio out of OBOE_SAMPLE_RESOLUTION (currently 1,000,000).
     *
     * @param newRate A number between 0 (none) and OBOE_SAMPLE_RESOLUTION (a million)
     */
    static void setDefaultSampleRate(int newRate);

    /**
     * Ask the collector for the final tracing decisions
     *
     * call once per request
     *
     * when compiled via SWIG this function takes 0-8 input argss and returns 9 output args
     *
     * inputs (0-8, all optional):
     * @param in_xtrace, a valid xtrace string
     * @param tracestate, value of sw member in tracestate, ignored when not in w3c mode
     * @param custom_sample_rate, 0-1000000
     * @param custom_tracing_mode, 0(disabled) or 1(enabled)
     * @param request_type, 0 normal sampling, 1 trigger trace
     * @param custom_custom_trigger_mode, 0(disabled) or 1(enabled)
     * @param header_options, the string from the X-Trace-Options header
     * @param header_signature, the string from the X-Trace-Options-Signature header
     * @param header_timestamp, the timestamp inside the X-Trace-Options header
     *
     * returns:
     * @param do_metrics, ignore when using SWIG, it will be mapped to the first return value
     * @param do_sample, ignore when using SWIG, it will be mapped to the second return value
     * @param sample_rate, ignore when using SWIG, it will be mapped to the third return value
     * @param sample_source, ignore when using SWIG, it will be mapped to the forth return value
     * @param type, 0 normal sampling, 1 - trigger trace
     * @param auth, 0 success, 1 failure, -1 not requested
     * @param status_msg, message describing the trigger tracing decision
     * @param auth_msg, message describing the success/failure of the authorization
     *
     * @status one of the OBOE_TRACING_DECISION_* codes
     */

    static void getDecisions(
        // output
        int *do_metrics,
        int *do_sample,
        int *sample_rate,
        int *sample_source,
        double *bucket_rate,
        double *bucket_cap,
        int *type,
        int *auth,
        std::string *status_msg,
        std::string *auth_msg,
        int *status,
        // input
        const char *in_xtrace = NULL,
        const char *tracestate = NULL,
        int custom_tracing_mode = OBOE_SETTINGS_UNSET,
        int custom_sample_rate = OBOE_SETTINGS_UNSET,
        int request_type = 0,
        int custom_trigger_mode = 0,
        const char *header_options = NULL,
        const char *header_signature = NULL,
        long header_timestamp = 0);

    /**
     * Get a pointer to the current context (from thread-local storage)
     */
    static oboe_metadata_t *get();

    /**
     * Get the current context as a printable string.
     */
#ifdef SWIGJAVA
    static std::string toStr();
#else
    static std::string toString();
#endif

    /**
     * Set the current context (this updates thread-local storage).
     */
    static void set(oboe_metadata_t *md);

    /**
     * Set the current context from a string.
     */
    static void fromString(std::string s);

    // this new object is managed by SWIG %newobject
    static Metadata *copy();

    static void setSampledFlag();

    static void clear();

    static bool isValid();

    static bool isSampled();

    /**
     * Perform validation and replacement of invalid characters on the given service key.
     */
    static std::string validateTransformServiceName(std::string service_key);

    /**
     * Shut down the Oboe library.
     *
     * This releases any resources held by the library which may include terminating
     * child threads.
     */
    static void shutdown();

    /**
     * check if oboe is ready for tracing
     *
     * @param timeout an optional timeout (in milli seconds) to block this function until ready
     * @return one of the return codes (see oboe.h):
     * - OBOE_SERVER_RESPONSE_UNKNOWN
     * - OBOE_SERVER_RESPONSE_OK
     * - OBOE_SERVER_RESPONSE_TRY_LATER
     * - OBOE_SERVER_RESPONSE_LIMIT_EXCEEDED
     * - OBOE_SERVER_RESPONSE_INVALID_API_KEY
     * - OBOE_SERVER_RESPONSE_CONNECT_ERROR
     */
    static int isReady(unsigned int timeout);

    /**
     * check if oboe is running in a AWS Lambda environment
     */
    static bool isLambda();

    // these new objects are managed by SWIG %newobject
    /**
     * Create a new event object using the thread's context.
     *
     * NOTE: The returned object must be "delete"d.
     */
    static Event *createEvent();
    static Event *startTrace();

    /**
     * Create entry event with user-defined metadata and timestamp
     * @param md const oboe_metadata_t *
     * @param timestamp int64_t
     * @param parent_md const oboe_metadata_t *
     * @return Event*
     */
    static Event* createEntry(const oboe_metadata_t *md, int64_t timestamp, const oboe_metadata_t *parent_md = nullptr);
    /**
     * Create an continuous event with user-defined timestamp
     * @param timestamp int64_t
     * @return Event*
     */
    static Event* createEvent(int64_t timestamp);
    /**
     * Create exit event with user-defined timestamp
     * @param timestamp int64_t
     * @return Event*
     */
    static Event* createExit(int64_t timestamp);
};

class Event : private oboe_event_t {
    friend class Reporter;
    friend class Context;
    friend class Metadata;

   private:
    Event();
    Event(const oboe_metadata_t *md, bool addEdge = true);

   public:
    ~Event();

    // called e.g. from Python e.addInfo("Key", None) & Ruby e.addInfo("Key", nil)
    bool addInfo(char *key, void *val);
    bool addInfo(char *key, const std::string &val);
    bool addInfo(char *key, long val);
    bool addInfo(char *key, double val);
    bool addInfo(char *key, bool val);
    bool addInfo(char *key, const long *vals, int num);

#ifndef SWIG  // for profiling only used by Ruby gem cpp-code
    bool addInfo(char *key, const std::vector<FrameData> &vals);
#endif

    bool addEdge(oboe_metadata_t *md);
    bool addContextOpId(const oboe_metadata_t *md);

    bool addHostname();

    /**
     * Get a new copy of this metadata.
     *
     * NOTE: The returned object must be "delete"d.
     */
    Metadata *getMetadata();
    std::string metadataString();
    std::string opIdString();

    /**
     * Report this event.
     *
     * This sends the event using the default reporter.
     * @param with_system_timestamp bool True means system timestamp 'Timestamp_u' will be added to event
     * @return True on success; otherwise an error message is logged.
     */
    bool send(bool with_system_timestamp = true);

    /**
     * Report a profiling event
     *
     * This sends the event using the default reporter
     * It doesn't add a timestamp
     * The timestamp needs to be precise for profiling and therefore
     * needs to be added by the agent when the snapshot is taken
     */
    bool sendProfiling();

    bool addSpanRef(const oboe_metadata_t *md);
    bool addProfileEdge(std::string id);

    /**
      * Create a new event object using the given metadata context.
      *
      * NOTE: The metadata context must be unique to the new trace.
      *
      * NOTE: The returned object must be "delete"d.
      *
      * @param md The metadata object to use when creating the new event.
      */
    static Event *startTrace(const oboe_metadata_t *md);
};

class Span {
   public:
   /**
    * these functions return the final transaction name
    * to be used in the exit event of the trace
    */
    static std::string createSpan(const char *transaction, const char *domain, const int64_t duration, const int has_error, const char *service_name = NULL);

    static std::string createHttpSpan(const char *transaction, const char *url, const char *domain, const int64_t duration,
                                      const int status, const char *method, const int has_error, const char *service_name = NULL);
};

class MetricTags {
    friend class CustomMetrics;

   public:
    MetricTags(size_t count);
    ~MetricTags();
    bool add(size_t index, const char *k, const char *v);
    /**
     * Get oboe_metric_tag_t function
     * Please note that SWIG doesn't have the definition of
     * oboe_metric_tag_t.
     * Ruby and Python should not call this method
     * @return oboe_metric_tag_t*
     */
    oboe_metric_tag_t *get() const;
   private:
    oboe_metric_tag_t *tags;
    size_t size;
};

class CustomMetrics {
   public:
    static int summary(const char *name, const double value, const int count, const int host_tag,
                       const char *service_name, const MetricTags *tags, size_t tags_count);

    static int increment(const char *name, const int count, const int host_tag,
                         const char *service_name, const MetricTags *tags, size_t tags_count);
};

#ifndef SWIG  // for profiling only used by Ruby gem c++-code
class OboeProfiling {
    public:
     static int get_interval();
};
#endif

class Reporter : private oboe_reporter_t {
    friend class Context;  // Access to the private oboe_reporter_t base structure.
   public:
    int init_status;

    /**
      * Initialize a reporter structure.
      *
      * See the wrapped Context::init for more details.
      *
      * @params  these correspond to the keys of the oboe_init_options struct
      */
    Reporter(
        std::string hostname_alias,  // optional hostname alias
        int log_level,               // level at which log messages will be written to log file (0-6)
        std::string log_file_path,   // file name including path for log file

        int max_transactions,        // maximum number of transaction names to track
        int max_flush_wait_time,     // maximum wait time for flushing data before terminating in milli seconds
        int events_flush_interval,   // events flush timeout in seconds (threshold for batching messages before sending off)
        int max_request_size_bytes,  // events flush batch size in KB (threshold for batching messages before sending off)

        std::string reporter,      // the reporter to be used ("ssl", "upd", "file", "null")
        std::string host,          // collector endpoint (reporter=ssl), udp address (reporter=udp), or file path (reporter=file)
        std::string service_key,   // the service key (also known as access_key)
        std::string certificates,  // content of SSL certificates, passed to gRPC::SslCredentialsOptions() for collector connection verification

        int buffer_size,                // size of the message buffer
        int trace_metrics,              // flag indicating if trace metrics reporting should be enabled (default) or disabled
        int histogram_precision,        // the histogram precision (only for ssl)
        double token_bucket_capacity,   // custom token bucket capacity
        double token_bucket_rate,       // custom token bucket rate
        int file_single,                // use single files in file reporter for each event

        int ec2_metadata_timeout,       // the timeout (milli seconds) for retrieving EC2 metadata
        std::string grpc_proxy,         // HTTP proxy address and port to be used for the gRPC connection
        int stdout_clear_nonblocking,   // flag indicating if the O_NONBLOCK flag on stdout should be cleared,
                                        // only used in lambda reporter (off=0, on=1, default off)
        int metric_format               // flag indicating the format of metric (0 = Both; 1 = TransactionResponseTime only; 2 = ResponseTime only; default = 0)
    );

    ~Reporter();

    bool sendReport(Event *evt, bool with_system_timestamp = true);
    bool sendReport(Event *evt, oboe_metadata_t *md, bool with_system_timestamp = true);
    bool sendStatus(Event *evt, bool with_system_timestamp = true);
    bool sendStatus(Event *evt, oboe_metadata_t *md, bool with_system_timestamp = true);
    void flush();
    std::string getType();
};

class Config {
   public:
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
    static bool checkVersion(int version, int revision);

    /**
     * Get the complete Oboe library version number as a string, e.g. '10.0.3'
     *
     * @return The library's version string
     */
    static std::string getVersionString();
};

#endif  // OBOE_API_HPP
