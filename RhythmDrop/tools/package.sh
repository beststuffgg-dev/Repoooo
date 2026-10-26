#!/usr/bin/env bash
# Regenerates every derived artifact.
#
# V8 is the game: its single-file build and zip land at the top level.
# V7 is kept whole alongside it under RhythmDrop/v7/, and rebuilds in place.
#
# The 150 campaign songs are NOT rebuilt here. Baking them is a
# deliberate act with a large diff — run RhythmDrop/tools/bake-levels.js
# yourself when you mean to change the campaign.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "V8 (the game):"
node RhythmDrop/tools/build-single.js RhythmDrop/RhythmDropV8 htmls/RhythmDrop.html

echo "V7 (kept alongside):"
node RhythmDrop/tools/build-redesign.js
node RhythmDrop/tools/build-single.js RhythmDrop/v7/RhythmDropV7          RhythmDrop/v7/RhythmDrop.html
node RhythmDrop/tools/build-single.js RhythmDrop/v7/RhythmDropV7-Redesign RhythmDrop/v7/RhythmDrop-Redesign.html

python3 - <<'PY'
import zipfile, os
# Fixed timestamps and sorted entries: folders get regenerated, so real
# mtimes would make a zip differ byte-for-byte each run even when
# nothing changed. Reproducible artifacts keep `git status` meaningful.
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
make('RhythmDrop/RhythmDropV8',              'RhythmDropV8.zip')
make('RhythmDrop/v7/RhythmDropV7',           'RhythmDrop/v7/RhythmDropV7-Final.zip')
make('RhythmDrop/v7/RhythmDropV7-Redesign',  'RhythmDrop/v7/RhythmDropV7-Redesign.zip')
PY
echo "done — now: cd tests && node run-all.js"
