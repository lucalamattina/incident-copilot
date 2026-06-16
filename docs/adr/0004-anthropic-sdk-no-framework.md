# Build the agent loop on the Anthropic SDK directly, no agent framework

The agentic tool-calling loop is built directly on the Anthropic SDK with Claude Sonnet, rather than on an agent framework (LangChain, LlamaIndex, the Vercel AI SDK abstractions, etc.).

The project already uses TypeScript and an Anthropic API key (matching the prior license-service work), and the agent loop here is small (a handful of read tools and a hard iteration cap), so a framework would add indirection and dependency weight without earning it. Tool definitions, the loop, fixtures, and the eval harness stay in one type-checked codebase. This is the most reversible of the recorded decisions; it is captured mainly so a reader doesn't assume a framework was overlooked.
