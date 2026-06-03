# Target State

The portal is composed of:

- web app for user workflows and embedding
- agent service for planning and tool orchestration
- memory service for durable and episodic notes
- reusable packages for policy, tools, and embed token handling
- reusable BI operations package for user/role/report/page/rule governance

Design goal: replaceable LLM providers and replaceable tool backends with no UI contract changes.
