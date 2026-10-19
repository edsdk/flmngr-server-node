// The same sources are compiled twice; each output dir says which module system it is,
// so Node picks the right loader for dist/esm and dist/cjs without renaming files.
import {writeFileSync} from "node:fs";

writeFileSync(new URL("../dist/esm/package.json", import.meta.url), '{"type":"module"}\n');
writeFileSync(new URL("../dist/cjs/package.json", import.meta.url), '{"type":"commonjs"}\n');
