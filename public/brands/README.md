# Sign-in provider marks

Place each provider's **official** sign-in mark here, unchanged, as the provider publishes it:

| File         | Source                                                             |
|--------------|--------------------------------------------------------------------|
| `google.svg` | Google Identity — "Sign in with Google" branding guidelines (the "G" logo) |
| `apple.svg`  | Apple — Sign in with Apple, Human Interface Guidelines (Apple logo, white on black) |
| `line.svg`   | LINE Developers — LINE Login button design guidelines (LINE icon, white) |

`src/features/customer/auth/BrandMark.tsx` shows the file when it exists and nothing when it
does not, so a missing file never breaks the button. Packio does not redraw any of these marks.
