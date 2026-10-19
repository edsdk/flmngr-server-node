# Tests

`node --test test/*.test.mjs` after a build (`npm run build`). The tests run against the built
`dist/` on Node 18 or newer, with nothing but `node:test`.

The JSON files in `vectors/` are the answers of the PHP backend
([flmngr-server-php](https://github.com/edsdk/flmngr-server-php)) for fixed inputs: what its
`fnmatch()`, `strnatcmp()` and `parse_str()` return, how its path guard, deny list and paged
listing behave, what its SVG sanitizer produces. This port must answer the same, so the tests
replay them. `blurhash-vectors.json` are the hashes of the reference BlurHash encoder.
