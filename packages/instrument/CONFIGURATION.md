# Configuration

When using the `instrument` package for instrumentation, configuration options are read from both then environment and an optional configuration file, with environment variables taking precedence over config file values.

All configuration options are optional except for the service key which is always required.

## Environment Variables

| Name                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| **`SW_APM_SERVICE_KEY`** | **Service key**                                 |
| `SW_APM_COLLECTOR`       | Collector URL                                   |
| `SW_APM_TRUSTED_PATH`    | Path to the collector's SSL certificate         |
| `SW_APM_LOG_LEVEL`       | Logging level for the instrumentation libraries |

## Configuration File

When required, the package will look for the file in the current working directory under three possible formats, in the following order:

- `swo.config.json` - JSON config, doesn't support certain options, optional peer dependency on `json5`
- `swo.config.js` - JavaScript config, supports all options
- `swo.config.ts` - TypeScript config, supports all options, required peer dependency on `ts-node`

### Type Checking

The package exports a type for the config file which can be used to type check it when using TypeScript or add a JSDoc type annotation when using JavaScript.

```ts
import type { ConfigFile } from "@swotel/instrument"

const config: ConfigFile = {
  // ...
}
export default config
```

```js
/** @type {import('@swotel/instrument').ConfigFile} */
module.exports = {
  // ...
}
```

### Specification

| Key                   | Description                                       |
| --------------------- | ------------------------------------------------- |
| `collector`           | Collector URL                                     |
| `trustedPath`         | Path to the collector's SSL certificate           |
| `logLevel`            | Logging level for the instrumentation libraries   |
| `transactionSettings` | See [Transaction Settings](#transaction-settings) |

#### Transaction Settings

Transaction settings allow filtering out certain transactions, based on URL for web requests, and the type and name concatenated with a colon for everything else. This option should be set to an array of objects.

Each entry must have a `tracing` key set to either `enabled` or `disabled` which determines the outcome if it is matched against. The entry must also either have a `regex` key set to a string or `RegExp` object which will be matched against, or a `matcher` key set to a function taking a string and returning `true` if it should match.

If multiple entries match, the first one will be used. Note that setting `tracing` to `enabled` does not guarantee the transaction will be traced.

```js
module.exports = {
  transactionSettings: [
    {
      tracing: "disabled",
      regex: /\/auth\/.*$/,
    },
    {
      tracing: "disabled",
      matcher: (id) => {
        const [ty] = id.split(":")
        if (ty === "CLIENT") return true
      },
    },
  ],
}
```
