module.exports = {
	transactionName: [
		{
			scheme: "spanAttribute",
			delimiter: "-",
			attributes: ["one", "two", "three"],
		},
		{
			scheme: "spanAttribute",
			delimiter: ":",
			attributes: ["one", "two"],
		},
		{
			scheme: "spanAttribute",
			delimiter: "\n",
			attributes: ["one"],
		},
	],
}
