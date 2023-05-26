#ifndef _OBOE_DEBUG_H
#define _OBOE_DEBUG_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdbool.h>

/**
 * Defined diagnostic log detail levels.
 */
enum OBOE_DEBUG_LOG_LEVEL {
    OBOE_DEBUG_DISABLED = -1,
    OBOE_DEBUG_FATAL = 0,
    OBOE_DEBUG_ERROR = 1,
    OBOE_DEBUG_WARNING = 2,
    OBOE_DEBUG_INFO = 3,
    OBOE_DEBUG_LOW = 4,
    OBOE_DEBUG_MEDIUM = 5,
    OBOE_DEBUG_HIGH = 6
};

/**
 * Defined modules that do diagnostic logging.
 */
enum OBOE_DEBUG_MODULE {
    OBOE_MODULE_ALL = -1,           /*!< Pseudo module to refer to ALL modules - used for configuring generic settings */
    OBOE_MODULE_UNDEF = 0,          /*!< Generic (undefined) module */
    OBOE_MODULE_LIBOBOE,            /*!< The core Oboe library */
    OBOE_MODULE_SETTINGS,           /*!< The Oboe settings functionality */
    OBOE_MODULE_REPORTER_FILE,      /*!< File reporter */
    OBOE_MODULE_REPORTER_UDP,       /*!< UDP (Tracelyzer) reporter */
    OBOE_MODULE_REPORTER_SSL,       /*!< SSL reporter */
    OBOE_MODULE_REPORTER_LAMBDA,    /*!< lambda wrapper */
    OBOE_MODULE_APACHE,             /*!< Apache webserver */
    OBOE_MODULE_NGINX,              /*!< Nginx webserver */
    OBOE_MODULE_PHP,                /*!< PHP interpreter */
    OBOE_MODULE_DOTNET,             /*!< dotnet wrapper */
    OBOE_MODULE_RUBY,               /*!< ruby c++ extension */
    OBOE_MODULE_HOST_ID_SERVICE,
    OBOE_MODULE_AWS_RESOURCE_PROVIDER,
    OBOE_MODULE_AZURE_RESOURCE_PROVIDER,
    OBOE_MODULE_UAMSCLIENT_RESOURCE_PROVIDER
};

/** Compile time debug logging detail level - cannot log more detailed than this. */
#define OBOE_DEBUG_LEVEL OBOE_DEBUG_HIGH

/**
 * Initial debug log detail level.
 *
 */
#define LOGLEVEL_DEFAULT OBOE_DEBUG_INFO

/** Limit for number of messages at specified level before demoting to debug MEDIUM. */
#define MAX_DEBUG_MSG_COUNT 1

void oboe_debug_log_init(FILE* output);

/**
 * Low-level diagnostics logging function.
 *
 * This is normally used only by the OBOE_DEBUG_LOG_* function macros and not used directly.
 *
 * This function may be adapted to format and route diagnostic log messages as desired.
 *
 * @param module One of the numeric module identifiers defined in debug.h - used to control logging detail by module.
 * @param level Diagnostic detail level of this message - used to control logging volume by detail level.
 * @param source_name Name of the source file, if available, or another useful name, or NULL.
 * @param source_lineno Number of the line in the source file where message is logged from, if available, or zero.
 * @param format A C language printf format specification string.
 * @param args A variable argument list in VA_ARG format containing arguments for each argument specifier in the format.
 */
void oboe_debug_logger(int module, int level, const char *source_name, int source_lineno, const char *format, ...);


/**
 * Prototype for a logger call-back function.
 *
 * A logging function of this form can be added to the logger chain using
 * oboe_debug_log_add().
 *
 * @param context The context pointer that was registered in the call to
 *          oboe_debug_log_add().  Use it to pass the pointer-to-self for
 *          objects (ie. "this" in C++) or just a structure in C,  May be
 *          NULL.
 * @param module The module identifier as passed to oboe_debug_logger().
 * @param level The diagnostic detail level as passed to oboe_debug_logger().
 * @param source_name Name of the source file as passed to oboe_debug_logger().
 * @param source_lineno Number of the line in the source file where message is
 *          logged from as passed to oboe_debug_logger().
 * @param msg The formatted message produced from the format string and its
 *          arguments as passed to oboe_debug_logger().
 */
typedef void (*OboeDebugLoggerFcn)(void *context, int module, int level, const char *source_name, int source_lineno, const char *msg);

/**
 * Get a printable name for a diagnostics logging level.
 */
const char *oboe_debug_log_level_name(int level);

/**
 * Get a printable name for a diagnostics logging module identifier.
 */
const char *oboe_debug_module_name(int module);

/**
 * Get the maximum logging detail level for a module or for all modules.
 *
 * This level applies to the stderr logger only.  Added loggers get all messages
 * below their registed detail level and need to do their own module-specific
 * filtering.
 *
 * @param module One of the OBOE_MODULE_* values.  Use OBOE_MODULE_ALL (-1) to
 *          get the overall maximum detail level.
 * @return Maximum detail level value for module (or overall) where zero is the
 *          lowest and higher values generate more detailed log messages.
 */
int oboe_debug_log_level_get(int module);

/**
 * Set the maximum logging detail level for a module or for all modules.
 *
 * This level applies to the stderr logger only.  Added loggers get all messages
 * below their registered detail level and need to do their own module-specific
 * filtering.
 *
 * @param module One of the OBOE_MODULE_* values.  Use OBOE_MODULE_ALL to set
 *          the overall maximum detail level.
 * @param newLevel Maximum detail level value where zero is the lowest and higher
 *          values generate more detailed log messages.
 */
void oboe_debug_log_level_set(FILE* output, int module, int newLevel);

/**
 * Set the output stream for the default logger.
 *
 * @param newStream A valid, open FILE* stream or NULL to disable the default logger.
 * @return Zero on success; otherwise an error code (normally from errno).
 */
int oboe_debug_log_to_stream(FILE *newStream);

/**
 * If we're logging to a stream, flush it.
 *
 * @return Zero on success; otherwise an error code (normally from errno).
 */
int oboe_debug_log_flush();

/**
 * Set the default logger to write to the specified file.
 *
 * A NULL or empty path name will disable the default logger.
 *
 * If the file exists then it will be opened in append mode.
 *
 * @param pathname The path name of the
 * @return Zero on success; otherwise an error code (normally from errno).
 */
int oboe_debug_log_to_file(const char *pathname);

/**
 * Add a logger that takes messages up to a given logging detail level.
 *
 * This adds the logger to a chain in order of the logging level.  Log messages
 * are passed to each logger down the chain until the remaining loggers only
 * accept messages of a lower detail level.
 *
 * @return Zero on success, one if re-registered with the new logging level, and
 *          otherwise a negative value to indicate an error.
 */
int oboe_debug_log_add(OboeDebugLoggerFcn newLogger, void *context, int logLevel);

/**
 * Remove a logger.
 *
 * Remove the logger from the message handling chain.
 *
 * @return Zero on success, one if it was not found, and otherwise a negative
 *          value to indicate an error.
 */
int oboe_debug_log_remove(OboeDebugLoggerFcn oldLogger, void *context);

/*
 * Log the application's Oboe configuration.
 *
 * We use this to get a reasonable standard format between apps.
 *
 * @param module An OBOE_MODULE_* module identifier.  Use zero for undefined.
 * @param app_name Either NULL or a pointer to a string containing a name for
 *          the application - will prefix the log entry.  Useful when multiple
 *          apps log to the same destination.
 * @param trace_mode A string identifying the configured tracing mode, one of:
 *          "enabled", "disabled", "unset", or "undef" (for invalid values)
 *          Use the oboe_tracing_mode_to_string() function to convert from
 *          numeric values.
 * @param sample_rate The configured sampling rate: -1 for unset or a
 *          integer fraction of 1000000.
 * @param reporter_type String identifying the type of reporter configured:
 *          One of 'udp' (the default), 'ssl', or 'file'.
 * @param reporter_args The string of comma-separated key=value settings
 *          used to initialize the reporter.
 * @param extra: Either NULL or a pointer to a string to be appended to
 *          the log message and designed to include a few other
 *          configuration parameters of interest.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_INFO
# define OBOE_DEBUG_LOG_CONFIG_EX(module, app_name, trace_mode, sample_rate, reporter_type, reporter_args, extra) \
  {                                                                                 \
    oboe_debug_logger(module, OBOE_DEBUG_INFO, __FILE__, __LINE__,                  \
        "%s Oboe config: tracing=%s, sampling=%d, reporter=('%s', '%s') %s",        \
        (app_name == NULL ? "" : app_name),                                         \
        trace_mode,                                                                 \
        sample_rate,                                                                \
        (reporter_type == NULL ? "?" : reporter_type),                              \
        (reporter_args == NULL ? "?" : reporter_args),                              \
        (extra == NULL ? "" : extra));                                              \
  }
#else
# define OBOE_DEBUG_LOG_CONFIG_EX(module, app_name, trace_mode, sample_rate, reporter_type, reporter_args, extra) {}
#endif

/**
 * Log a fatal error.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_FATAL
# define OBOE_DEBUG_LOG_FATAL_EX(module, ...)                   \
  {                                                          \
    oboe_debug_logger(module, OBOE_DEBUG_FATAL, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_FATAL_EX(module, ...) {}
#endif

/**
 * Log a recoverable error.
 *
 * Each message is limited in the number of times that it will be reported at the
 * ERROR level after which it will be logged at the debug MEDIUM level.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_ERROR
# define OBOE_DEBUG_LOG_ERROR_EX(module, ...)                   \
  {                                                          \
    static int usage_counter = 0;                            \
    int loglev = (++usage_counter <= MAX_DEBUG_MSG_COUNT ? OBOE_DEBUG_ERROR : OBOE_DEBUG_MEDIUM); \
    oboe_debug_logger(module, loglev, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_ERROR_EX(module, ...) {}
#endif

/**
 * Log a warning.
 *
 * Each message is limited in the number of times that it will be reported at the
 * WARNING level after which it will be logged at the debug MEDIUM level.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_WARNING
# define OBOE_DEBUG_LOG_WARNING_EX(module, ...)                 \
  {                                                          \
    static int usage_counter = 0;                            \
    int loglev = (++usage_counter <= MAX_DEBUG_MSG_COUNT ? OBOE_DEBUG_WARNING : OBOE_DEBUG_MEDIUM); \
    oboe_debug_logger(module, loglev, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_WARNING_EX(module, ...) {}
#endif

/**
 * Log an informative message.
 *
 * Each message is limited in the number of times that it will be reported at the
 * INFO level after which it will be logged at the debug MEDIUM level.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_INFO
# define OBOE_DEBUG_LOG_INFO_EX(module, ...)                    \
  {                                                                     \
    static int usage_counter = 0;                            \
    int loglev = (++usage_counter <= MAX_DEBUG_MSG_COUNT ? OBOE_DEBUG_INFO : OBOE_DEBUG_MEDIUM); \
    oboe_debug_logger(module, loglev, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_INFO_EX(module, ...) {}
#endif

/**
 * Log a low-detail diagnostic message.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_LOW
# define OBOE_DEBUG_LOG_LOW_EX(module, ...)                    \
  {                                                                     \
    oboe_debug_logger(module, OBOE_DEBUG_LOW, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_LOW_EX(module, ...) {}
#endif

/**
 * Log a medium-detail diagnostic message.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_MEDIUM
# define OBOE_DEBUG_LOG_MEDIUM_EX(module, ...)                    \
  {                                                                     \
    oboe_debug_logger(module, OBOE_DEBUG_MEDIUM, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_MEDIUM_EX(module, ...) {}
#endif

/**
 * Log a high-detail diagnostic message.
 */
#if OBOE_DEBUG_LEVEL >= OBOE_DEBUG_HIGH
# define OBOE_DEBUG_LOG_HIGH_EX(module, ...)                    \
  {                                                                     \
    oboe_debug_logger(module, OBOE_DEBUG_HIGH, __FILE__, __LINE__, __VA_ARGS__); \
  }
#else
# define OBOE_DEBUG_LOG_HIGH_EX(module, ...) {}
#endif

#ifdef __cplusplus
} // extern "C"
#endif

#endif // _OBOE_DEBUG_H
