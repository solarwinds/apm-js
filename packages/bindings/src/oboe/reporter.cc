#include "reporter.hh"
#include "event.hh"
#include "metadata.hh"

Reporter* from_options(sw::Object const& options) {
    auto hostname_alias = options.get<std::string>("hostname_alias");
    auto log_level = options.get<int>("log_level");
    auto log_file_path = options.get<std::string>("log_file_path");

    auto max_transactions = options.get<int>("max_transactions");
    auto max_flush_wait_time = options.get<int>("max_flush_wait_time");
    auto events_flush_interval = options.get<int>("events_flush_interval");
    auto max_request_size_bytes = options.get<int>("max_request_size_bytes");

    auto reporter = options.get<std::string>("reporter");
    auto host = options.get<std::string>("host");
    auto service_key = options.get<std::string>("service_key");
    auto certificates = options.get<std::string>("certificates");

    auto buffer_size = options.get<int>("buffer_size");
    auto trace_metrics = options.get<int>("trace_metrics");
    auto histogram_precision = options.get<int>("histogram_precision");
    auto token_bucket_capacity = options.get<double>("token_bucket_capacity");
    auto token_bucket_rate = options.get<double>("token_bucket_rate");
    auto file_single = options.get<int>("file_single");

    auto ec2_metadata_timeout = options.get<int>("ec2_metadata_timeout");
    auto grpc_proxy = options.get<std::string>("grpc_proxy");
    auto stdout_clear_nonblocking = options.get<int>("stdout_clear_nonblocking");

    auto metric_format = options.get<int>("metric_format");
    auto log_type = options.get<int>("log_type");

    return new Reporter(
        hostname_alias, log_level, log_file_path, max_transactions, max_flush_wait_time,
        events_flush_interval, max_request_size_bytes, reporter, host, service_key, certificates,
        buffer_size, trace_metrics, histogram_precision, token_bucket_capacity, token_bucket_rate,
        file_single, ec2_metadata_timeout, grpc_proxy, stdout_clear_nonblocking, metric_format,
        log_type
    );
}

JsReporter::JsReporter(sw::CallbackInfo const info)
    : sw::Class<JsReporter, Reporter>(from_options(info.arg<sw::Object>(0)), info) {}
Napi::Object JsReporter::init(Napi::Env env, Napi::Object exports) {
    return define_class("Reporter")
        .field<&JsReporter::get__init_status>("init_status")
        .method<&JsReporter::sendReport>("sendReport")
        .method<&JsReporter::sendStatus>("sendStatus")
        .method<&JsReporter::flush>("flush")
        .method<&JsReporter::getType>("getType")
        .register_class(env, exports);
}

Napi::Value JsReporter::get__init_status(sw::CallbackInfo const info) {
    return info.value(base->init_status);
}

// sendReport and sendStatus have the same signature so abstract over them
// send2 and send3 are just pointer to the two separate overloads
Napi::Value send(
    sw::CallbackInfo const info, Reporter* const reporter, bool (Reporter::*send2)(Event*, bool),
    bool (Reporter::*send3)(Event*, oboe_metadata_t*, bool)
) {
    auto evt = JsEvent::Unwrap(info.arg<Napi::Object>(0));
    auto either = info.arg_optional<Napi::Value>(1).value_or(info.value(true));
    if (either.IsBoolean()) {
        auto with_system_timestamp = sw::from_value<bool>(either);
        return info.value((reporter->*send2)(evt->base, with_system_timestamp));
    } else {
        auto md = JsMetadata::Unwrap(sw::from_value<Napi::Object>(either));
        auto with_system_timestamp = info.arg_optional<bool>(2).value_or(true);
        return info.value((reporter->*send3)(evt->base, md->base->metadata(), with_system_timestamp)
        );
    }
}

Napi::Value JsReporter::sendReport(sw::CallbackInfo const info) {
    return send(info, base, &Reporter::sendReport, &Reporter::sendReport);
}
Napi::Value JsReporter::sendStatus(sw::CallbackInfo const info) {
    return send(info, base, &Reporter::sendStatus, &Reporter::sendStatus);
}
Napi::Value JsReporter::flush(sw::CallbackInfo const info) {
    base->flush();
    return info.undefined();
}
Napi::Value JsReporter::getType(sw::CallbackInfo const info) { return info.value(base->getType()); }
