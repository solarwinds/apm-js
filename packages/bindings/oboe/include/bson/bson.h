/* bson.h */

/*    Copyright 2009, 2010 10gen Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

#ifndef _BSON_H_
#define _BSON_H_

#define MONGO_HAVE_STDINT
#include "platform_hacks.h"
#include <time.h>

MONGO_EXTERN_C_START

typedef enum {
    oboe_bson_error=-1,
    oboe_bson_eoo=0,
    oboe_bson_double=1,
    oboe_bson_string=2,
    oboe_bson_object=3,
    oboe_bson_array=4,
    oboe_bson_bindata=5,
    oboe_bson_undefined=6,
    oboe_bson_oid=7,
    oboe_bson_bool=8,
    oboe_bson_date=9,
    oboe_bson_null=10,
    oboe_bson_regex=11,
    oboe_bson_dbref=12, /* deprecated */
    oboe_bson_code=13,
    oboe_bson_symbol=14,
    oboe_bson_codewscope=15,
    oboe_bson_int = 16,
    oboe_bson_timestamp = 17,
    oboe_bson_long = 18
} oboe_bson_type;

typedef int oboe_bson_bool_t;

typedef struct {
    char * data;
    oboe_bson_bool_t owned;
} oboe_bson;

typedef struct {
    const char * cur;
    oboe_bson_bool_t first;
} oboe_bson_iterator;

typedef struct {
    char * buf;
    char * cur;
    int bufSize;
    oboe_bson_bool_t finished;
    int stack[32];
    int stackPos;
} oboe_bson_buffer;

#pragma pack(1)
typedef union{
    char bytes[12];  // Flawfinder: ignore
    int ints[3];
} oboe_bson_oid_t;
#pragma pack()

typedef int64_t oboe_bson_date_t; /* milliseconds since epoch UTC */

/* ----------------------------
   READING
   ------------------------------ */


oboe_bson * oboe_bson_empty(oboe_bson * obj); /* returns pointer to static empty bson object */
int oboe_bson_copy(oboe_bson* out, const oboe_bson* in); /* puts data in new buffer. NOOP if out==NULL */
oboe_bson * oboe_bson_from_buffer(oboe_bson * b, oboe_bson_buffer * buf);
oboe_bson * oboe_bson_init( oboe_bson * b , char * data , oboe_bson_bool_t mine );
oboe_bson * oboe_bson_init_safe( oboe_bson * b , char * data , oboe_bson_bool_t mine , size_t buflen);
int oboe_bson_size(const oboe_bson * b );
void oboe_bson_destroy( oboe_bson * b );

void oboe_bson_print( oboe_bson * b );
void oboe_bson_print_raw( const char * bson , int depth );

/* advances iterator to named field */
/* returns bson_eoo (which is false) if field not found */
oboe_bson_type oboe_bson_find(oboe_bson_iterator* it, const oboe_bson* obj, const char* name);

void oboe_bson_iterator_init( oboe_bson_iterator * i , const char * bson );

/* more returns true for eoo. best to loop with bson_iterator_next(&it) */
oboe_bson_bool_t oboe_bson_iterator_more( const oboe_bson_iterator * i );
oboe_bson_type oboe_bson_iterator_next( oboe_bson_iterator * i );

oboe_bson_type oboe_bson_iterator_type( const oboe_bson_iterator * i );
const char * oboe_bson_iterator_key( const oboe_bson_iterator * i );
const char * oboe_bson_iterator_value( const oboe_bson_iterator * i );

/* these convert to the right type (return 0 if non-numeric) */
double oboe_bson_iterator_double( const oboe_bson_iterator * i );
int oboe_bson_iterator_int( const oboe_bson_iterator * i );
int64_t oboe_bson_iterator_long( const oboe_bson_iterator * i );

/* false: boolean false, 0 in any type, or null */
/* true: anything else (even empty strings and objects) */
oboe_bson_bool_t oboe_bson_iterator_bool( const oboe_bson_iterator * i );

/* these assume you are using the right type */
double oboe_bson_iterator_double_raw( const oboe_bson_iterator * i );
int oboe_bson_iterator_int_raw( const oboe_bson_iterator * i );
int64_t oboe_bson_iterator_long_raw( const oboe_bson_iterator * i );
oboe_bson_bool_t oboe_bson_iterator_bool_raw( const oboe_bson_iterator * i );
oboe_bson_oid_t* oboe_bson_iterator_oid( const oboe_bson_iterator * i );

/* these can also be used with bson_code and bson_symbol*/
const char * oboe_bson_iterator_string( const oboe_bson_iterator * i );
int oboe_bson_iterator_string_len( const oboe_bson_iterator * i );

/* works with bson_code, bson_codewscope, and bson_string */
/* returns NULL for everything else */
const char * oboe_bson_iterator_code(const oboe_bson_iterator * i);

/* calls bson_empty on scope if not a bson_codewscope */
void oboe_bson_iterator_code_scope(const oboe_bson_iterator * i, oboe_bson * scope);

/* both of these only work with bson_date */
oboe_bson_date_t oboe_bson_iterator_date(const oboe_bson_iterator * i);
time_t oboe_bson_iterator_time_t(const oboe_bson_iterator * i);

int oboe_bson_iterator_bin_len( const oboe_bson_iterator * i );
char oboe_bson_iterator_bin_type( const oboe_bson_iterator * i );
const char * oboe_bson_iterator_bin_data( const oboe_bson_iterator * i );

const char * oboe_bson_iterator_regex( const oboe_bson_iterator * i );
const char * oboe_bson_iterator_regex_opts( const oboe_bson_iterator * i );

/* these work with bson_object and bson_array */
void oboe_bson_iterator_subobject(const oboe_bson_iterator * i, oboe_bson * sub);
void oboe_bson_iterator_subiterator(const oboe_bson_iterator * i, oboe_bson_iterator * sub);

/* str must be at least 24 hex chars + null byte */
void oboe_bson_oid_from_string(oboe_bson_oid_t* oid, const char* str);
void oboe_bson_oid_to_string(const oboe_bson_oid_t* oid, char* str);
void oboe_bson_oid_gen(oboe_bson_oid_t* oid);

time_t oboe_bson_oid_generated_time(oboe_bson_oid_t* oid); /* Gives the time the OID was created */

/* ----------------------------
   BUILDING
   ------------------------------ */

oboe_bson_buffer * oboe_bson_buffer_init( oboe_bson_buffer * b );
oboe_bson_buffer * oboe_bson_ensure_space( oboe_bson_buffer * b , const int bytesNeeded );

/**
 * @return the raw data.  you either should free this OR call bson_destroy not both
 */
char * oboe_bson_buffer_finish( oboe_bson_buffer * b );
void oboe_bson_buffer_destroy( oboe_bson_buffer * b );

oboe_bson_buffer * oboe_bson_append_oid( oboe_bson_buffer * b , const char * name , const oboe_bson_oid_t* oid );
oboe_bson_buffer * oboe_bson_append_int( oboe_bson_buffer * b , const char * name , const int i );
oboe_bson_buffer * oboe_bson_append_long( oboe_bson_buffer * b , const char * name , const int64_t i );
oboe_bson_buffer * oboe_bson_append_double( oboe_bson_buffer * b , const char * name , const double d );
oboe_bson_buffer * oboe_bson_append_string( oboe_bson_buffer * b , const char * name , const char * str );
oboe_bson_buffer * oboe_bson_append_symbol( oboe_bson_buffer * b , const char * name , const char * str );
oboe_bson_buffer * oboe_bson_append_code( oboe_bson_buffer * b , const char * name , const char * str );
oboe_bson_buffer * oboe_bson_append_code_w_scope( oboe_bson_buffer * b , const char * name , const char * code , const oboe_bson * scope);
oboe_bson_buffer * oboe_bson_append_binary( oboe_bson_buffer * b, const char * name, char type, const char * str, int len );
oboe_bson_buffer * oboe_bson_append_bool( oboe_bson_buffer * b , const char * name , const oboe_bson_bool_t v );
oboe_bson_buffer * oboe_bson_append_null( oboe_bson_buffer * b , const char * name );
oboe_bson_buffer * oboe_bson_append_undefined( oboe_bson_buffer * b , const char * name );
oboe_bson_buffer * oboe_bson_append_regex( oboe_bson_buffer * b , const char * name , const char * pattern, const char * opts );
oboe_bson_buffer * oboe_bson_append_bson( oboe_bson_buffer * b , const char * name , const oboe_bson* bson);
oboe_bson_buffer * oboe_bson_append_element( oboe_bson_buffer * b, const char * name_or_null, const oboe_bson_iterator* elem);

/* these both append a bson_date */
oboe_bson_buffer * oboe_bson_append_date(oboe_bson_buffer * b, const char * name, oboe_bson_date_t millis);
oboe_bson_buffer * oboe_bson_append_time_t(oboe_bson_buffer * b, const char * name, time_t secs);

oboe_bson_buffer * oboe_bson_append_start_object( oboe_bson_buffer * b , const char * name );
oboe_bson_buffer * oboe_bson_append_start_array( oboe_bson_buffer * b , const char * name );
oboe_bson_buffer * oboe_bson_append_finish_object( oboe_bson_buffer * b );

void oboe_bson_numstr(char* str, int i);
void oboe_bson_incnumstr(char* str);


/* ------------------------------
   ERROR HANDLING - also used in mongo code
   ------------------------------ */

void * oboe_bson_malloc(int size); /* checks return value */

/* bson_err_handlers shouldn't return!!! */
typedef void(*ob_bson_err_handler)(const char* errmsg);

/* returns old handler or NULL */
/* default handler prints error then exits with failure*/
ob_bson_err_handler oboe_set_bson_err_handler(ob_bson_err_handler func);



/* does nothing is ok != 0 */
void oboe_bson_fatal( int ok );
int oboe_bson_fatal_msg( int ok, const char* msg );

MONGO_EXTERN_C_END
#endif
