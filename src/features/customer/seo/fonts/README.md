# Fonts for the Open Graph card

`anuphan-400.ttf` and `anuphan-700.ttf` are static instances of the site's own Anuphan files
(`src/ui/fonts/files/anuphan-*.woff2`, SIL OFL — see `src/ui/fonts/OFL-anuphan.txt`), with the
Thai and Latin subsets merged into one file per weight. `next/og` (satori) reads neither woff2
nor a variable font's axes, so the card needs them in this form. Regenerate with fontTools
(`varLib.instancer` at wght 400/700, then `fontTools.merge`) when the site's font files change.
