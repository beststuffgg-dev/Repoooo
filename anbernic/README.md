# Block Blast: RG35XX Edition

A Block Blast clone built as a PICO-8 cartridge, laid out for the Anbernic RG35XX's
screen and buttons. The whole game is the single file `blockblast.p8`. It runs on
the handheld through PICO-8 or fake08, and on a computer through PICO-8.

## Modes

- **Classic.** An 8×8 board and three pieces per round. Place all three to get a
  new set. Fill a row or column and it clears. The game ends when none of your
  pieces fit. Your best score is saved.
- **Campaign.** 40 levels in 5 worlds, each with its own theme and music. Every
  level has a goal, and the goal type rotates:
  - **score** — reach a points target
  - **lines** — clear a number of rows and columns
  - **gems** — clear the lines holding every gem on a pre-filled board

  Finishing in few moves earns up to ★★★. Clearing a level opens the next one,
  and beating a world's last level unlocks that world's theme. The level map
  shows your stars and the next goal.
- **Adventure.** Endless gem levels that get harder as you go. The furthest
  level you've reached is saved, and you can start from any level up to it.
- **Themes.** Six looks, each with its own colours, animated background and music
  track: classic (drifting squares), night (twinkling stars), candy (bubbles),
  forest (falling leaves), ocean (rising bubbles) and sunset (embers). Classic is
  available from the start; the campaign unlocks the rest. Use ◀ ▶ to preview a
  theme live, including its music.

## Features from the original

- **All the piece shapes:** lines from 1 to 5 long in both directions, 2×2, 3×3,
  2×3, L, J, T, S, Z, corners and diagonals. Pieces don't rotate.
- **Scoring.** You get 1 point per block placed. Clearing lines gives a bonus that
  grows with the number of lines cleared at once. The combo multiplier rises each
  time a placement clears lines and resets after 3 placements in a row without a
  clear (the pips at the bottom left count these down). Emptying the whole board
  gives +300.
- **Line preview.** While you hold a piece over a valid spot, the rows and columns
  it would clear light up in its colour.
- **Grey pieces.** A piece in the tray turns grey when there's nowhere it can go.
- **Fair dealing.** The deal is weighted toward useful pieces and always includes
  at least one piece that fits, when one exists.

## Graphics and sound

- Glossy bevelled blocks, a board with a drop shadow, and rounded panels.
- Large chunky text for the score and for messages from "Good!" up to
  "Unbelievable!".
- The held piece lifts off the board with a shadow.
- Placement flashes, blocks that pop and scatter particles when cleared,
  sparkles when you collect a gem, and screen shake on big clears.
- Board blocks turn grey row by row at game over, and stars animate in on a
  level win.
- Three music tracks (chill, bouncy and dreamy), each with bass, arpeggio and
  melody parts. Each theme uses one of them.
- 16 sound effects: one each for moving, placing, switching pieces, failed
  placements, gem collection, earned stars, theme unlocks, a new best, game over
  and level complete, plus four chimes that rise as clears get bigger.

## Controls

| RG35XX | Keyboard | What it does |
|---|---|---|
| D-pad | Arrow keys | Move the held piece. In menus, move the selection. |
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
are under `__sfx__`: slots 0–15 are effects, and 16–51 hold the three music
tracks. The song order is under `__music__`: tracks start at patterns 0, 8 and 16.
The code uses about 5,000 of PICO-8's 8,192 tokens.
