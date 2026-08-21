#!/usr/bin/env bash
# Regenerates every derived artifact from RhythmDropV7/.
# Run this after any source change: the single-file builds, the
# Redesign variant and the zips are all generated, never hand-edited.
set -euo pipefail
cd "$(dirname "$0")/.."

node tools/build-redesign.js
node tools/build-single.js
node tools/build-single.js RhythmDropV7-Redesign RhythmDrop-Redesign.html

python3 - <<'PY'
import zipfile, os
# Fixed timestamps and sorted entries: the Redesign folder is
# regenerated on every run, so real mtimes would make its zip differ
# byte-for-byte each time even when nothing changed. Reproducible
# artifacts mean `git status` after a rebuild is a real signal.
STAMP = (1980, 1, 1, 0, 0, 0)
def make(src, out):
    if os.path.exists(out): os.remove(out)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src):
            dirs.sort()
            for f in sorted(files):
                p = os.path.join(root, f)
                info = zipfile.ZipInfo(os.path.relpath(p, os.path.dirname(src)), STAMP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(p, 'rb') as fh:
                    z.writestr(info, fh.read())
    print('  %s (%s bytes)' % (out, format(os.path.getsize(out), ',')))
print('zipping:')
make('RhythmDropV7', 'RhythmDropV7-Final.zip')
make('RhythmDropV7-Redesign', 'RhythmDropV7-Redesign.zip')
PY
echo "done — now: cd rhythmdrop-tests && node run-all.js"
