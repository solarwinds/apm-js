module.exports = {
  transactionSettings: [
    { tracing: "enabled", regex: /^hello$/ },
    { tracing: "disabled", regex: "[A-Z]" },
    { tracing: "enabled", matcher: (ident) => ident.startsWith("foo") },
  ],
}
