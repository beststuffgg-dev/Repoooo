#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."

echo "V9 (the game):"
node "All else/RhythmDrop/tools/build-single.js" RhythmDropV9 htmls/RhythmDrop.html

echo "V7 (kept alongside):"
node "All else/RhythmDrop/tools/build-redesign.js"
node "All else/RhythmDrop/tools/build-single.js" "All else/RhythmDrop/v7/RhythmDropV7" "All else/RhythmDrop/v7/RhythmDrop.html"
node "All else/RhythmDrop/tools/build-single.js" "All else/RhythmDrop/v7/RhythmDropV7-Redesign" "All else/RhythmDrop/v7/RhythmDrop-Redesign.html"

python3 - <<'PY'
import zipfile, os
STAMP = (1980, 1, 1, 0, 0, 0)
def make(src, out):
    if os.path.exists(out): os.remove(out)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src):
            dirs.sort()
            for f in sorted(files):
                p = os.path.join(root, f)
                info = zipfile.ZipInfo(os.path.relpath(p, os.path.dirname(os.path.abspath(src))), STAMP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(p, 'rb') as fh:
                    z.writestr(info, fh.read())
    print('  %s (%s bytes)' % (out, format(os.path.getsize(out), ',')))
print('zipping:')
make('RhythmDropV9',              'RhythmDropV9.zip')
make('All else/RhythmDrop/v7/RhythmDropV7',           'All else/RhythmDrop/v7/RhythmDropV7-Final.zip')
make('All else/RhythmDrop/v7/RhythmDropV7-Redesign',  'All else/RhythmDrop/v7/RhythmDropV7-Redesign.zip')
PY
echo "done — now: cd tests && node run-all.js"
