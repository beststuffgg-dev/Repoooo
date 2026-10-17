# Block Blast: RG35XX Edition

A Block Blast clone built as a PICO-8 cartridge, laid out for the Anbernic RG35XX's
screen and buttons. The whole game is the single file `blockblast.p8`. It runs on
the handheld through PICO-8 or fake08, and on a computer through PICO-8.

## What's in it

- **Classic mode.** An 8×8 board and three pieces per round. Place all three to get
  a new set. Fill a row or column and it clears. The game ends when none of your
  pieces fit.
- **Adventure mode.** Each level starts with blocks already on the board, some of
  them holding gems. Clear the lines the gems sit on to collect them, and finish
  the level by collecting every gem. Levels get harder as you go, and the
  furthest level you've reached is saved.
- **All the piece shapes:** lines from 1 to 5 long in both directions, 2×2, 3×3,
  2×3, L, J, T, S, Z, corners and diagonals. As in the original, pieces don't
  rotate.
- **Scoring.** You get 1 point per block placed. Clearing lines gives a bonus that
  grows with the number of lines cleared at once. The combo multiplier rises each
  time a placement clears lines and resets after 3 placements in a row without a
  clear (the pips at the bottom left count these down). Emptying the whole board
  gives +300.
- **Feedback.** Messages from "Good!" up to "Unbelievable!", a `+points` popup,
  combo counter, screen shake, particles and a pop animation on cleared blocks.
- **Line preview.** While you hold a piece over a valid spot, the rows and columns
  it would clear light up in its colour.
- **Grey pieces.** A piece in the tray turns grey when there's nowhere it can go.
- **Fair dealing.** The deal is weighted toward useful pieces and always includes
  at least one piece that fits, when one exists.
- **Best score with a crown.** It updates live and is saved to the device. Scores
  above PICO-8's 32767 number limit are handled.
- **Sound.** Synthesized sound effects and a background music loop that can be
  turned off.

## Controls

| RG35XX | Keyboard | What it does |
|---|---|---|
| D-pad | Arrow keys | Move the held piece around the board. On the title screen, pick a mode or level. |
| 🅾️ button | Z | Place the piece / confirm |
| ❎ button | X | Switch to the next piece in your tray / back |
| START | Enter / P | Pause menu: music on/off, **swap A/B**, quit to title |

Which physical button is 🅾️ and which is ❎ depends on your firmware and emulator.
If place and switch feel backwards, open the pause menu with START and turn
on **swap a/b**. The on-screen button hints follow that setting.

## Putting it on the RG35XX

1. Copy `blockblast.p8` to the PICO-8 ROM folder on your SD card. The name
   depends on your firmware: usually `Roms/PICO`, `ROMS/pico8`, or the folder
   your firmware's PICO-8 / fake08 system reads from (GarlicOS, muOS, Knulli,
   MinUI and so on).
2. Refresh the game list and launch it from the PICO-8 system.

Stock firmware with no PICO-8 system can still run it if it includes the
RetroArch **fake08** core: load the `.p8` with that core.

## Playing on a computer

- **PICO-8:** `load blockblast.p8`, then `run`.
- **fake08 / RetroArch:** open the file with the fake08 core.

## Editing it

`blockblast.p8` is plain text. The game code is under `__lua__`. Sound effects
are under `__sfx__` (slots 0–10 are effects, 16–23 are the music loop) and the
song order is under `__music__`. The code uses about 3,100 of PICO-8's 8,192
tokens, which leaves plenty of room to add more.
