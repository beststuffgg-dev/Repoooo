#!/usr/bin/env bash
# Regenerates every derived artifact.
#
# V8 is the game: its single-file build and zip land at the top level.
# V7 is kept whole alongside it under other/v7/, and rebuilds in place.
#
# The 150 campaign songs are NOT rebuilt here. Baking them is a
# deliberate act with a large diff — run other/tools/bake-levels.js
# yourself when you mean to change the campaign.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "V8 (the game):"
node other/tools/build-single.js other/RhythmDropV8 htmls/RhythmDrop.html

echo "V7 (kept alongside):"
node other/tools/build-redesign.js
node other/tools/build-single.js other/v7/RhythmDropV7          other/v7/RhythmDrop.html
node other/tools/build-single.js other/v7/RhythmDropV7-Redesign other/v7/RhythmDrop-Redesign.html

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
make('other/RhythmDropV8',              'RhythmDropV8.zip')
make('other/v7/RhythmDropV7',           'other/v7/RhythmDropV7-Final.zip')
make('other/v7/RhythmDropV7-Redesign',  'other/v7/RhythmDropV7-Redesign.zip')
PY
echo "done — now: cd tests && node run-all.js"
