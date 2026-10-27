# Extension Organizer

Sort, search, pin, and categorize the drawers in SillyTavern's Extensions
settings panel — because with a dozen extensions installed, finding the one
you want becomes a scavenger hunt.

## Features

- **Automatic type detection** — every extension is sorted into a type based on
  its title, its manifest/folder name, and (as a fallback) the labels in its
  settings drawer:

  | Type | Color | Examples |
  | --- | --- | --- |
  | Translation | 🟢 lime | Chat Translation |
  | Image & Vision | 🩷 pink | Image Generation, Captioning, Gallery |
  | Voice & Audio | 🟠 amber | TTS, Speech Recognition, music/ambience |
  | Characters & Expressions | 🟣 orchid | Character Expressions, Live2D, VRM |
  | Memory & Context | 🟪 violet | Summarize, Vector Storage, Data Bank, lorebooks |
  | Web & Integrations | 🔵 sky | Web Search, Discord, API/proxy tools |
  | UI & Themes | 🟧 coral | themes, CSS, layout tweaks |
  | Chat & Prompting | 🩵 teal | Quick Reply, Regex, trackers, prompt tools |
  | Utilities | 🌊 mint | Token Counter, backups, managers |
  | Other | ⚪ gray | anything unrecognized |

- **Color coding everywhere** — each drawer gets a stripe and type badge in its
  type's color, and section headers and counts match
- **Core vs third-party badge** — extensions bundled with SillyTavern are tagged
  *Core*, and ones you installed are tagged *3rd-party* (read from SillyTavern's
  own extension list)
- **Type chips** — a color legend under the search bar with a count per type;
  click a chip to show only that type
- **Search bar** (sticky at the top) — filters by name, type ("audio",
  "memory"…) or source ("core", "third-party")
- **Pin favorites** — star any drawer to keep it in a ⭐ Pinned section at the top
- **Categories** — override the auto type with any other type or a category
  you create; each gets a collapsible, color-coded header with a count badge
- **A–Z sorting** toggle within sections
- **Organize mode** — the pin stars and category dropdowns only show while the
  sliders button is active, so the panel stays clean day to day

Assignments are keyed by drawer title, so they survive reloads and reinstalls.
Extensions that register their settings late are picked up automatically and
slotted into their category, including ones that don't use the standard
drawer layout (plain headings or bare wrappers).

## Use

Open the Extensions panel. The toolbar sits at the top:
🔍 search · ✨ auto-group by type · A–Z toggle · 🎛 organize mode

Below it are the color-coded type chips. Click one to filter, and click it
again to show everything.

Click the sliders icon, star your favorites, and change a drawer's category
from its dropdown (*Auto* uses the detected type; you can also create new
categories). Click the sliders icon again to hide the controls. Click any
category header to collapse it. Turn off ✨ to stop grouping by type, so
unassigned drawers fall into *Other*.

## Install

Extensions ▸ Install extension ▸ paste this repo's URL.
Or copy this folder into `data/<your-user>/extensions/` and reload.

To return to the vanilla layout, disable the extension and refresh.
