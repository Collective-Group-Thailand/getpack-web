# Sign-in provider marks

The marks on the "continue with …" buttons (`src/features/customer/auth/BrandMark.tsx`). They are
the providers' own logos, taken unchanged from open icon sets that redistribute them under CC0
(the trademarks stay the providers'; using them to label their sign-in buttons is what each
provider's button guidelines ask for):

| File         | Mark                                  | Taken from                                                    | Licence |
|--------------|---------------------------------------|---------------------------------------------------------------|---------|
| `google.svg` | Google "G", four colours              | `@iconify-json/logos@1.2.16`, icon `google-icon` (gilbarbara/logos) | CC0-1.0 |
| `apple.svg`  | Apple logo, black (white button)      | `@iconify-json/simple-icons@1.2.100`, icon `apple`            | CC0-1.0 |
| `line.svg`   | LINE logo, white (on LINE green)      | `@iconify-json/simple-icons@1.2.100`, icon `line`             | CC0-1.0 |

Only the fill was set (`currentColor` → the colour above). To replace a mark with the provider's
own download (Google Identity branding, Apple "Sign in with Apple" resources, LINE Login button
kit), drop the file in under the same name. `BrandMark` shows nothing when a file is missing, so a
missing mark never breaks the button.
