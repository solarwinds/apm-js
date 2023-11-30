#ifndef _OBOE_DEBUG_H
#define _OBOE_DEBUG_H

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*OboeDebugLoggerFcn)(void *context, int level, const char *source_name, int source_lineno, const char *msg);

// Add or update a callback function to get log details
int oboe_debug_log_add(OboeDebugLoggerFcn newLogger, void *context);

#ifdef __cplusplus
} // extern "C"
#endif

#endif // _OBOE_DEBUG_H