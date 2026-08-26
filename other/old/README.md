# other/old — archived builds

The build artifacts from the old flat repo layout, kept from the
`claude/rhythmdrop-upd7-campaign-vwj3xl` branch before it was retired.
Only the shippable files are archived here — the two single-file HTML
builds and the two V7 zips:

- `RhythmDrop.html` — V7 final, single file
- `RhythmDrop-Redesign.html` — V7 redesign, single file
- `RhythmDropV7-Final.zip` — V7 final, unpacked-extension zip
- `RhythmDropV7-Redesign.zip` — V7 redesign zip

Everything else from that branch (the V7 source folders, the test
suite, docs) already lives in the current tree under `other/v7/` and
`tests/`, so it is not duplicated here. These files are frozen history;
regenerate current builds with `other/tools/package.sh`.
