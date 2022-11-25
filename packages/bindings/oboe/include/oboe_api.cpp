/**
 * @file oboe_api.cpp - C++ liboboe wrapper primarily used via swig interfaces
 * by the python and ruby agents
 *
 * TODO:  This doc is outdated
 * This API should follow https://github.com/tracelytics/tracelons/wiki/Instrumentation-API
 **/

#include "oboe_api.h"
#include <algorithm>
/////// Metatdata ///////

Metadata::Metadata(const oboe_metadata_t *md) {
    oboe_metadata_copy(this, md);
}

Metadata::~Metadata() {
    oboe_metadata_destroy(this);
}

Metadata *Metadata::makeRandom(bool sampled) {
    oboe_metadata_t md;
    oboe_metadata_init(&md);
    oboe_metadata_random(&md);

    if (sampled) md.flags |= XTR_FLAGS_SAMPLED;

    return new Metadata(&md);  // copies md
}

Metadata *Metadata::copy() {
    return new Metadata(this);
}

bool Metadata::isValid() {
    return oboe_metadata_is_valid(this);
}

bool Metadata::isSampled() {
    return oboe_metadata_is_sampled(this);
}

Metadata *Metadata::fromString(std::string s) {
    oboe_metadata_t md;
    oboe_metadata_init(&md);
    oboe_metadata_fromstr(&md, s.data(), s.size());
    return new Metadata(&md);  // copies md
}

oboe_metadata_t *Metadata::metadata() {
    return this;
}

Event *Metadata::createEvent() {
    return new Event(this);
}

#ifdef SWIGJAVA
std::string Metadata::toStr() {
#else
std::string Metadata::toString() {
#endif
    char buf[OBOE_MAX_METADATA_PACK_LEN]; // Flawfinder: ignore

    int rc = oboe_metadata_tostr(this, buf, sizeof(buf) - 1);
    if (rc == 0) {
        return std::string(buf);
    } else {
        return std::string();  // throw exception?
    }
}

/////// Context ///////


void Context::setTracingMode(int newMode) {
    oboe_settings_mode_set(newMode);
}

void Context::setTriggerMode(int newMode) {
    oboe_settings_trigger_set(newMode);
}

void Context::setDefaultSampleRate(int newRate) {
    oboe_settings_rate_set(newRate);
}

void Context::getDecisions(
    // this parameter list is too long, but other forms of sending info
    // between python/ruby and c++ would require extra round trips
    // and may be less efficient.

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
    const char *in_xtrace,
    const char *tracestate,
    int custom_tracing_mode,
    int custom_sample_rate,
    int request_type,
    int custom_trigger_mode,
    const char *header_options,
    const char *header_signature,
    long header_timestamp
 ) {
    oboe_tracing_decisions_in_t tdi;
    memset(&tdi, 0, sizeof(tdi));
    tdi.version = 3;

    tdi.custom_tracing_mode = custom_tracing_mode;
    tdi.custom_sample_rate = custom_sample_rate;
    tdi.custom_trigger_mode = custom_trigger_mode;
    tdi.request_type = request_type;

    tdi.in_xtrace = in_xtrace;
    tdi.tracestate = tracestate; // value of sw member in tracestate, ignored when not in w3c mode
    tdi.header_options = header_options;
    tdi.header_signature = header_signature;
    tdi.header_timestamp = header_timestamp;

    oboe_tracing_decisions_out_t tdo;
    memset(&tdo, 0, sizeof(tdo));
    tdo.version = 3;

    *status = oboe_tracing_decisions(&tdi, &tdo);

    *do_sample = tdo.do_sample;
    *do_metrics = tdo.do_metrics;
    *sample_rate = tdo.sample_rate;
    *sample_source = tdo.sample_source;
    *bucket_rate = tdo.token_bucket_rate;
    *bucket_cap = tdo.token_bucket_capacity;
    *type = tdo.request_provisioned;
    if (tdo.status_message && tdo.status_message[0] != '\0') {
        *status_msg = tdo.status_message;
    }
    *auth = tdo.auth_status;
    if (tdo.auth_message && tdo.auth_message[0] != '\0') {
        *auth_msg = tdo.auth_message;
    }
}

oboe_metadata_t *Context::get() {
    return oboe_context_get();
}

#ifdef SWIGJAVA
std::string Context::toStr() {
#else
std::string Context::toString() {
#endif
    char buf[OBOE_MAX_METADATA_PACK_LEN]; // Flawfinder: ignore

    oboe_metadata_t *md = Context::get();
    int rc = oboe_metadata_tostr(md, buf, sizeof(buf) - 1);
    if (rc == 0) {
        return std::string(buf);
    } else {
        return std::string();  // throw exception?
    }
}

void Context::set(oboe_metadata_t *md) {
    oboe_context_set(md);
}

void Context::fromString(std::string s) {
    oboe_context_set_fromstr(s.data(), s.size());
}

// this new object is managed by SWIG %newobject
Metadata *Context::copy() {
    return new Metadata(Context::get());
}

void Context::setSampledFlag() {
    oboe_metadata_t *md = Context::get();
    md->flags |= XTR_FLAGS_SAMPLED;
}

void Context::clear() {
    oboe_context_clear();
}

bool Context::isValid() {
    return oboe_context_is_valid();
}

bool Context::isSampled() {
    return oboe_context_is_sampled();
}

std::string Context::validateTransformServiceName(std::string service_key) {
    char service_key_cpy[71 + 1 + 256] = {0};  // Flawfinder: ignore, key=71, colon=1, name<=255
    std::copy_n(service_key.begin(), std::min(service_key.size(), sizeof(service_key_cpy)), std::begin(service_key_cpy));
    int len = strlen(service_key_cpy);                                           // Flawfinder: ignore
    int ret = oboe_validate_transform_service_name(service_key_cpy, &len);

    if (ret == -1) {
        return "";
    }

    return std::string(service_key_cpy);
}

void Context::shutdown() {
    oboe_shutdown();
}

int Context::isReady(unsigned int timeout) {
    return oboe_is_ready(timeout);
}

bool Context::isLambda() {
    return (bool) oboe_is_lambda();
}

/**
 * Create a new event object that continues the trace context.
 *
 * NOTE: The returned object must be "delete"d.
 */
Event *Context::createEvent() {
    return new Event(Context::get());
}

/**
 * Create a new event object with a new trace context.
 *
 * NOTE: The returned object must be "delete"d.
 */
Event *Context::startTrace() {
    oboe_metadata_t *md = Context::get();
    oboe_metadata_random(md);
    return new Event();
}

Event* Context::createEntry(const oboe_metadata_t *md, int64_t timestamp, const oboe_metadata_t *parent_md) {
    /**
     * As liboboe assumed to manage metadata, liboboe needs to make sure all events are from the same trace.
     * While Otel doesn't require liboboe to manage metadata,
     * we need to set the thread local metadata the same task id as input parameter md but a different op_id.
     */
    auto thread_local_md = Context::get();
    oboe_metadata_copy(thread_local_md, md);
    // reset op_id to zeros
    memset(thread_local_md->ids.op_id, 0, OBOE_MAX_OP_ID_LEN);

    auto event = new Event();
    oboe_event_init(event, md, md->ids.op_id);
    oboe_event_add_info(event, "Label", "entry");
    oboe_event_add_info_int64(event, "Timestamp_u", timestamp);
    if (parent_md) {
        oboe_event_add_edge(event, parent_md);
    }
    return event;
}

Event* Context::createEvent(int64_t timestamp) {
    auto event = new Event(Context::get());
    oboe_event_add_info_int64(event, "Timestamp_u", timestamp);
    return event;
}

Event* Context::createExit(int64_t timestamp) {
    auto event = createEvent(timestamp);
    oboe_event_add_info(event, "Label", "exit");
    return event;
}

/////// Event ///////

Event::Event() {
    oboe_event_init(this, Context::get(), NULL);
}

Event::Event(const oboe_metadata_t *md, bool addEdge) {
    // both methods copy metadata from md -> this
    if (addEdge) {
        // create_event automatically adds edge in event to md
        oboe_metadata_create_event(md, this);
    } else {
        // initializes new Event with this md's task_id & new random op_id; no edges set
        oboe_event_init(this, md, NULL);
    }
}

Event::~Event() {
    oboe_event_destroy(this);
}

Event *Event::startTrace(const oboe_metadata_t *md) {
    return new Event(md, false);
}

// called e.g. from Python e.addInfo("Key", None) & Ruby e.addInfo("Key", nil)
bool Event::addInfo(char *key, void *val) {
    // oboe_event_add_info(evt, key, NULL) does nothing
    (void)key;
    (void)val;
    return true;
}

bool Event::addInfo(char *key, const std::string &val) {
    return oboe_event_add_info(this, key, val.data()) == 0;
}

bool Event::addInfo(char *key, long val) {
    int64_t val_ = val;
    return oboe_event_add_info_int64(this, key, val_) == 0;
}

bool Event::addInfo(char *key, double val) {
    return oboe_event_add_info_double(this, key, val) == 0;
}

bool Event::addInfo(char *key, bool val) {
    return oboe_event_add_info_bool(this, key, val) == 0;
}

/*
 * this function was added for profiling
 * to report the timestamps of omitted snapshots
 */
bool Event::addInfo(char *key, const long *vals, int num) {
    oboe_bson_append_start_array(&(this->bbuf), key);
    for (int i = 0; i < num; i++) {
        oboe_bson_append_long(&(this->bbuf), std::to_string(i).c_str(), (int64_t)vals[i]);
    }
    oboe_bson_append_finish_object(&(this->bbuf));
    return true;
}

/*
 * A profiling specific addInfo function
 * to add the frames that make up a snapshot
 */
bool Event::addInfo(char *key, const std::vector<FrameData> &vals) {
    oboe_bson_append_start_array(&(this->bbuf), key);
    int i = 0;
    for (FrameData val : vals) {
        oboe_bson_append_start_object(&(this->bbuf), std::to_string(i).c_str());
        i++;

        if (val.method != "")
            oboe_bson_append_string(&(this->bbuf), "M", (val.method).c_str());
        if (val.klass != "")
            oboe_bson_append_string(&(this->bbuf), "C", (val.klass).c_str());
        if (val.file != "")
            oboe_bson_append_string(&(this->bbuf), "F", (val.file).c_str());
        if (val.lineno > 0)
            oboe_bson_append_long(&(this->bbuf), "L", (int64_t)val.lineno);

        oboe_bson_append_finish_object(&(this->bbuf));
    }
    oboe_bson_append_finish_object(&(this->bbuf));
    return true;
}

bool Event::addEdge(oboe_metadata_t *md) {
    return oboe_event_add_edge(this, md) == 0;
}

bool Event::addHostname() {
    static char oboe_hostname[HOST_NAME_MAX + 1] = {'\0'}; // Flawfinder: ignore

    if (oboe_hostname[0] == '\0') {
        (void)gethostname(oboe_hostname, sizeof(oboe_hostname) - 1);
        if (oboe_hostname[0] == '\0') {
            // Something is wrong but we don't want to to report this more than
            // once so we'll set it to a minimal non-empty string.
            OBOE_DEBUG_LOG_WARNING(OBOE_MODULE_LIBOBOE, "Failed to get hostname, setting it to '?'");
            oboe_hostname[0] = '?';
            oboe_hostname[1] = '\0';
        }
    }
    return oboe_event_add_info(this, "Hostname", oboe_hostname) == 0;
}

bool Event::addContextOpId(const oboe_metadata_t *md) {
    char buf[OBOE_MAX_METADATA_PACK_LEN]; // Flawfinder: ignore
    oboe_metadata_tostr(md, buf, OBOE_MAX_METADATA_PACK_LEN);
    buf[58] = '\0';

    return oboe_event_add_info(this, "ContextOpId", &buf[42]);
}

bool Event::addSpanRef(const oboe_metadata_t *md) {
    char buf[OBOE_MAX_METADATA_PACK_LEN]; // Flawfinder: ignore
    oboe_metadata_tostr(md, buf, OBOE_MAX_METADATA_PACK_LEN);
    buf[58] = '\0';

    return oboe_event_add_info(this, "SpanRef", &buf[42]);
}

bool Event::addProfileEdge(std::string id) {
    return oboe_event_add_info(this, "Edge", id.c_str());
}

/**
     * Get a new copy of this metadata.
     *
     * NOTE: The returned object must be "delete"d.
     */
Metadata *Event::getMetadata() {
    return new Metadata(&this->metadata);
}

/**
 * used by Ruby profiling to manage edges separately from oboe
 */
std::string Event::opIdString() {
   char buf[OBOE_MAX_METADATA_PACK_LEN]; // Flawfinder: ignore
   oboe_metadata_tostr(&this->metadata, buf, OBOE_MAX_METADATA_PACK_LEN);
   buf[52] = '\0';
   return std::string(&buf[36]);
}

std::string Event::metadataString() {
    char buf[OBOE_MAX_METADATA_PACK_LEN];  // Flawfinder: ignore

    int rc = oboe_metadata_tostr(&this->metadata, buf, sizeof(buf) - 1);
    if (rc == 0) {
        return std::string(buf);
    } else {
        return std::string();  // throw exception?
    }
}

/**
     * Report this event.
     *
     * This sends the event using the default reporter.
     *
     * @return True on success; otherwise an error message is logged.
     */
bool Event::send(bool with_system_timestamp) {
    if (with_system_timestamp) {
        return (oboe_event_send(OBOE_SEND_EVENT, this, Context::get()) >= 0);
    } else {
        return (oboe_event_send_without_timestamp(OBOE_SEND_EVENT, this, Context::get()) >= 0);
    }
}

/**
 * Report a Profiling Event
 * needs to be sent raw, so that the timestamp doesn't get altered
 */
bool Event::sendProfiling() {
    int retval = -1;

    this->bb_str = oboe_bson_buffer_finish(&this->bbuf);
    if (!this->bb_str)
        return -1;

    size_t len = (size_t)(this->bbuf.cur - this->bbuf.buf);
    retval = oboe_raw_send(OBOE_SEND_PROFILING, this->bb_str, len);

    if (retval < 0)
        OBOE_DEBUG_LOG_ERROR(OBOE_MODULE_LIBOBOE, "Raw send failed - reporter returned %d", retval);

    return (retval >= 0);
}

/////// Span ///////

std::string Span::createSpan(const char *transaction, const char *domain, const int64_t duration,  const int has_error, const char *service_name) {
    oboe_span_params_t params;
    memset(&params, 0, sizeof(oboe_span_params_t));
    params.version = 1;
    params.transaction = transaction;
    params.domain = domain;
    params.duration = duration;
    params.has_error = has_error;
    params.service = service_name;

    char buffer[OBOE_TRANSACTION_NAME_MAX_LENGTH + 1];  // Flawfinder: ignore
    int len = oboe_span(buffer, sizeof(buffer), &params);
    if (len > 0) {
        return std::string(buffer);
    } else {
        return "";
    }
}

std::string Span::createHttpSpan(const char *transaction, const char *url, const char *domain, const int64_t duration,
                                 const int status, const char *method, const int has_error, const char *service_name) {
    oboe_span_params_t params;
    memset(&params, 0, sizeof(oboe_span_params_t));
    params.version = 1;
    params.transaction = transaction;
    params.url = url;
    params.domain = domain;
    params.duration = duration;
    params.status = status;
    params.method = method;
    params.has_error = has_error;
    params.service = service_name;

    char buffer[OBOE_TRANSACTION_NAME_MAX_LENGTH + 1];  // Flawfinder: ignore
    int len = oboe_http_span(buffer, sizeof(buffer), &params);
    if (len > 0) {
        return std::string(buffer);
    } else {
        return "";
    }
}

/////// MetricTags ///////

MetricTags::MetricTags(size_t count) {
    tags = new oboe_metric_tag_t[count];
    for (size_t i = 0; i < count; i++) {
        tags[i].key = nullptr;
        tags[i].value = nullptr;
    }
    size = count;
}

MetricTags::~MetricTags() {
    for (size_t i = 0; i < size; i++) {
        delete tags[i].key; tags[i].key = nullptr;
        delete tags[i].value; tags[i].value = nullptr;
    }
    delete[] tags;
}

bool MetricTags::add(size_t index, const char *k, const char *v) {
    if (index < size) {
        tags[index].key = strdup(k);
        tags[index].value = strdup(v);
        return (tags[index].key != nullptr && tags[index].value != nullptr);
    }
    return false;
}
oboe_metric_tag_t *MetricTags::get() const {
    return tags;
}

/////// CustomMetrics ///////

int CustomMetrics::summary(const char *name, const double value, const int count, const int host_tag,
                           const char *service_name, const MetricTags *tags, size_t tags_count) {
    if (tags->size < tags_count) {
        tags_count = tags->size;
    }
    return oboe_custom_metric_summary(name, value, count, host_tag, service_name, tags->get(), tags_count);
}

int CustomMetrics::increment(const char *name, const int count, const int host_tag,
                             const char *service_name, const MetricTags *tags, size_t tags_count) {
    if (tags->size < tags_count) {
        tags_count = tags->size;
    }
    return oboe_custom_metric_increment(name, count, host_tag, service_name, tags->get(), tags_count);
}

/////// Profiling ///////

// adding this to have a proper interface, even though it just
// returns the return value of the oboe function
// 0 indicates not to profile, returns -1 if the collector hasn't sent anything
int OboeProfiling::get_interval() {
    return oboe_get_profiling_interval();
}

/////// Reporter ///////

Reporter::Reporter(
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
) {
    oboe_init_options_t options;
    memset(&options, 0, sizeof(options));
    options.version = 15;
    oboe_init_options_set_defaults(&options);

    if (hostname_alias != "") {
        options.hostname_alias = hostname_alias.c_str();
    }
    options.log_level = log_level;
    options.log_file_path = log_file_path.c_str();
    options.max_transactions = max_transactions;
    options.max_flush_wait_time = max_flush_wait_time;
    options.events_flush_interval = events_flush_interval;
    options.max_request_size_bytes = max_request_size_bytes;
    if (reporter != "") {
        options.reporter = reporter.c_str();
    }
    if (host != "") {
        options.host = host.c_str();
    }
    if (service_key != "") {
        options.service_key = service_key.c_str();
    }
    if (certificates != "") {
        options.certificates = certificates.c_str();
    }
    options.buffer_size = buffer_size;
    options.trace_metrics = trace_metrics;
    options.histogram_precision = histogram_precision;
    options.token_bucket_capacity = token_bucket_capacity;
    options.token_bucket_rate = token_bucket_rate;
    options.file_single = file_single;
    options.ec2_metadata_timeout = ec2_metadata_timeout;
    if (grpc_proxy != "") {
        options.proxy = grpc_proxy.c_str();
    }
    options.stdout_clear_nonblocking = stdout_clear_nonblocking;
    options.metric_format = metric_format;
    init_status = oboe_init(&options);
}

Reporter::~Reporter() {
    oboe_reporter_destroy(this);
}

bool Reporter::sendReport(Event *evt, bool with_system_timestamp) {
    if (with_system_timestamp) {
        return oboe_event_send(OBOE_SEND_EVENT, evt, Context::get()) >= 0;
    } else {
        return oboe_event_send_without_timestamp(OBOE_SEND_EVENT, evt, Context::get()) >= 0;
    }
}

bool Reporter::sendReport(Event *evt, oboe_metadata_t *md, bool with_system_timestamp) {
    if (with_system_timestamp) {
        return oboe_event_send(OBOE_SEND_EVENT, evt, md) >= 0;
    } else {
        return oboe_event_send_without_timestamp(OBOE_SEND_EVENT, evt, md) >= 0;
    }
}

bool Reporter::sendStatus(Event *evt, bool with_system_timestamp) {
    if (with_system_timestamp) {
        return oboe_event_send(OBOE_SEND_STATUS, evt, Context::get()) >= 0;
    } else {
        return oboe_event_send_without_timestamp(OBOE_SEND_STATUS, evt, Context::get()) >= 0;
    }
}

bool Reporter::sendStatus(Event *evt, oboe_metadata_t *md, bool with_system_timestamp) {
    if (with_system_timestamp) {
        return oboe_event_send(OBOE_SEND_STATUS, evt, md) >= 0;
    } else {
        return oboe_event_send_without_timestamp(OBOE_SEND_STATUS, evt, md) >= 0;
    }
}

void Reporter::flush() {
    oboe_reporter_flush();
}

std::string Reporter::getType() {
    const char* type = oboe_get_reporter_type();
    return type ? std::string(type) : "";
}

/////// Config ///////

bool Config::checkVersion(int version, int revision) {
    return (oboe_config_check_version(version, revision) != 0);
}

std::string Config::getVersionString() {
    return oboe_config_get_version_string();
}
