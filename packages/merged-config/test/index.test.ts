import * as mc from "../src/index"

describe("merged-config", () => {
  beforeEach(() => {
    for (const key in process.env) {
      // eslint-disable-next-line
      if (key.startsWith("TEST_")) delete process.env[key]
    }
  })

  it("should pick up file options", () => {
    const file = { name: "Joe", age: 42 }

    const result = mc.config(
      { name: { file: true }, age: { file: true } },
      file,
    )

    expect(result).toEqual(file)
  })

  it("should pick up env options", () => {
    process.env.TEST_NAME = "Joe"
    process.env.TEST_AGE = "42"

    const result = mc.config(
      { name: { env: true }, age: { env: true } },
      {},
      "TEST_",
    )

    expect(result).toEqual({ name: "Joe", age: "42" })
  })

  it("should prioritise env over file", () => {
    const file = { name: "Joe" }
    process.env.TEST_NAME = "Jane"

    const result = mc.config({ name: { file: true, env: true } }, file, "TEST_")

    expect(result).toEqual({ name: "Jane" })
  })

  it("should properly case env", () => {
    process.env.TEST_FULL_NAME = "Jane Doe"

    const result = mc.config({ fullName: { env: true } }, {}, "TEST_")

    expect(result).toEqual({ fullName: "Jane Doe" })
  })

  it("should support custom env name", () => {
    process.env.TEST_NAME = "Jane Doe"

    const result = mc.config({ fullName: { env: "TEST_NAME" } }, {}, "TEST_")

    expect(result).toEqual({ fullName: "Jane Doe" })
  })

  it("should use default if not present", () => {
    const result = mc.config({ name: { file: true, default: "Joe" } }, {})

    expect(result).toEqual({ name: "Joe" })
  })

  it("should not use default if present", () => {
    const result = mc.config(
      { name: { file: true, default: "Joe" } },
      { name: "Jane" },
    )

    expect(result).toEqual({ name: "Jane" })
  })

  it("should throw if required and not present", () => {
    expect(() =>
      mc.config({ name: { file: true, required: true } }, {}),
    ).toThrow(/name/)
  })

  it("should not throw if required and present", () => {
    expect(() =>
      mc.config({ name: { file: true, required: true } }, { name: "Joe" }),
    ).not.toThrow()
  })

  it("should use the provided parser", () => {
    const file = { age: "42" }

    const result = mc.config(
      { age: { file: true, parser: Number } },
      file,
      "TEST_",
    )

    expect(result).toEqual({ age: 42 })
  })
})
