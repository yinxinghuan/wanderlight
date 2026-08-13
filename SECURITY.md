# Security notes

Wanderlight is a browser game. Its compiled JavaScript, game UUID, public
platform bridge contract, Media Service endpoint, and authored character anchor
identifiers are visible to every player and must not be treated as secrets.

The repository intentionally contains no deployment credentials, private
Worker bindings, migration tools, real-user reference URLs, generation task
logs, or internal QA archives.

The story protocol is parsed as data and rendered through React text nodes. The
authoritative reducer limits per-turn stat changes, inventory quantities,
character IDs and text field lengths; a hidden protocol command cannot silently
remove a companion. Run `npm run test:security` to verify these boundaries.

Authentication, origin validation, quotas and abuse prevention for AlterU
platform services are server responsibilities. A UUID or frontend endpoint is
not an authentication credential.

Please report security issues privately to the repository owner rather than
opening a public exploit report.
