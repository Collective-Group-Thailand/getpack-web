/* eslint-disable react/jsx-no-literals -- the drawn boxes' own printed labels: part of the artwork, not UI copy. */
/**
 * The home hero's still life (design language v2, the "Main" board): three printed boxes on kraft
 * with their shadows, drawn — not a photo, and not anyone's product. Decorative: the hero's words
 * carry the meaning.
 */
export function HeroStillLife() {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false" viewBox="0 0 640 560">
      <defs>
        <filter id="hero-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9"></feGaussianBlur>
        </filter>
        <filter id="hero-paper">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" result="n"></feTurbulence>
          <feColorMatrix type="saturate" values="0"></feColorMatrix>
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 .12"></feFuncA>
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in"></feComposite>
        </filter>
        <linearGradient id="hero-kT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(216,188,148)"></stop>
          <stop offset="1" stopColor="rgb(207,173,123)"></stop>
        </linearGradient>
        <linearGradient id="hero-kL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(159,132,92)"></stop>
          <stop offset="1" stopColor="rgb(188,156,108)"></stop>
        </linearGradient>
        <linearGradient id="hero-kR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(205,170,118)"></stop>
          <stop offset="1" stopColor="rgb(172,142,99)"></stop>
        </linearGradient>
        <linearGradient id="hero-wT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(247,243,233)"></stop>
          <stop offset="1" stopColor="rgb(246,240,229)"></stop>
        </linearGradient>
        <linearGradient id="hero-wL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(191,187,177)"></stop>
          <stop offset="1" stopColor="rgb(226,220,209)"></stop>
        </linearGradient>
        <linearGradient id="hero-wR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(246,240,228)"></stop>
          <stop offset="1" stopColor="rgb(206,201,191)"></stop>
        </linearGradient>
        <linearGradient id="hero-cT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(202,173,134)"></stop>
          <stop offset="1" stopColor="rgb(190,154,106)"></stop>
        </linearGradient>
        <linearGradient id="hero-cL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(146,117,78)"></stop>
          <stop offset="1" stopColor="rgb(172,138,92)"></stop>
        </linearGradient>
        <linearGradient id="hero-cR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(188,150,100)"></stop>
          <stop offset="1" stopColor="rgb(157,126,84)"></stop>
        </linearGradient>
      </defs>
      <g>
        <ellipse cx="340.0" cy="265.0" rx="78.0" ry="28.1" fill="rgba(60,40,20,.35)" filter="url(#hero-blur)"></ellipse>
        <path d="M272.5 89.0 L340.0 128.0 L340.0 298.0 L272.5 259.0 Z" fill="url(#hero-wL)"></path>
        <path d="M407.5 89.0 L407.5 259.0 L340.0 298.0 L340.0 128.0 Z" fill="url(#hero-wR)"></path>
        <path d="M340.0 50.0 L407.5 89.0 L340.0 128.0 L272.5 89.0 Z" fill="url(#hero-wT)"></path>
        <path d="M306.2 69.5 L373.8 108.5" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
        <path d="M306.2 70.7 L373.8 109.7" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
        <path
          d="M340.0 50.0 L407.5 89.0 L340.0 128.0 L272.5 89.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M272.5 89.0 L340.0 128.0 L340.0 298.0 L272.5 259.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M407.5 89.0 L407.5 259.0 L340.0 298.0 L340.0 128.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <circle cx="407.5" cy="91.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="401.4" cy="94.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="395.3" cy="98.3" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="389.1" cy="101.8" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="383.0" cy="105.4" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="376.8" cy="108.9" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="370.7" cy="112.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="364.6" cy="116.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="358.4" cy="119.6" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="352.3" cy="123.1" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="346.1" cy="126.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <g transform="translate(272.5,259.0) skewY(30)">
          <rect x="0" y="-170" width="67.5" height="170" fill="#0d7a66" opacity=".96"></rect>
          <text
            x="12"
            y="-136"
            style={{ fontFamily: "var(--font-sans)" }}
            fontSize="6"
            fill="#fff"
            letterSpacing="2"
            opacity=".85"
          >
            COFFEE
          </text>
          <text
            x="12"
            y="-108"
            style={{ fontFamily: "var(--font-display)" }}
            fontWeight="600"
            fontSize="15"
            fill="#fff"
          >
            คั่วเข้ม
          </text>
          <text x="12" y="-88" style={{ fontFamily: "var(--font-display)" }} fontWeight="600" fontSize="15" fill="#fff">
            เชียงใหม่
          </text>
          <text x="12" y="-28" style={{ fontFamily: "var(--font-sans)" }} fontSize="6" fill="#fff" opacity=".8">
            NET 250 g · PACKIO
          </text>
        </g>
        <path
          d="M272.5 89.0 L340.0 128.0 L340.0 298.0 L272.5 259.0 Z"
          fill="url(#hero-wL)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".55"
        ></path>
        <path
          d="M407.5 89.0 L407.5 259.0 L340.0 298.0 L340.0 128.0 Z"
          fill="url(#hero-wR)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".45"
        ></path>
        <path d="M272.5 89.0 L340.0 128.0 L340.0 130.6 L272.5 91.6 Z" fill="rgba(255,245,225,.55)"></path>
        <path d="M407.5 89.0 L340.0 128.0 L340.0 130.6 L407.5 91.6 Z" fill="rgba(255,245,225,.35)"></path>
        <ellipse
          cx="188.4"
          cy="377.5"
          rx="123.0"
          ry="44.3"
          fill="rgba(60,40,20,.35)"
          filter="url(#hero-blur)"
        ></ellipse>
        <path d="M81.9 284.0 L211.8 359.0 L211.8 433.0 L81.9 358.0 Z" fill="url(#hero-kL)"></path>
        <path d="M294.9 311.0 L294.9 385.0 L211.8 433.0 L211.8 359.0 Z" fill="url(#hero-kR)"></path>
        <path d="M165.0 236.0 L294.9 311.0 L211.8 359.0 L81.9 284.0 Z" fill="url(#hero-kT)"></path>
        <path d="M123.4 260.0 L253.3 335.0" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
        <path d="M123.4 261.2 L253.3 336.2" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
        <path
          d="M165.0 236.0 L294.9 311.0 L211.8 359.0 L81.9 284.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M81.9 284.0 L211.8 359.0 L211.8 433.0 L81.9 358.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M294.9 311.0 L294.9 385.0 L211.8 433.0 L211.8 359.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <circle cx="294.9" cy="313.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="288.5" cy="316.9" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="282.1" cy="320.6" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="275.7" cy="324.3" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="269.3" cy="328.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="262.9" cy="331.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="256.5" cy="335.4" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="250.1" cy="339.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="243.7" cy="342.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="237.3" cy="346.4" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="231.0" cy="350.1" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="224.6" cy="353.8" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="218.2" cy="357.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <g transform="translate(81.9,358.0) skewY(30)">
          <rect
            x="14"
            y="-60"
            width="102"
            height="46"
            rx="2"
            fill="none"
            stroke="#0d7a66"
            strokeWidth="1.3"
            opacity=".8"
          ></rect>
          <text
            x="22"
            y="-31"
            style={{ fontFamily: "var(--font-display)" }}
            fontWeight="600"
            fontSize="18"
            fill="#0a5f50"
          >
            mali
            <tspan fontStyle="italic" fontWeight="500">
              glow
            </tspan>
          </text>
          <text
            x="22"
            y="-20"
            style={{ fontFamily: "var(--font-sans)" }}
            fontSize="6"
            fill="#4a3217"
            letterSpacing="1.5"
          >
            SKINCARE · 30 ML
          </text>
        </g>
        <path
          d="M81.9 284.0 L211.8 359.0 L211.8 433.0 L81.9 358.0 Z"
          fill="url(#hero-kL)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".55"
        ></path>
        <path
          d="M294.9 311.0 L294.9 385.0 L211.8 433.0 L211.8 359.0 Z"
          fill="url(#hero-kR)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".45"
        ></path>
        <path d="M81.9 284.0 L211.8 359.0 L211.8 361.6 L81.9 286.6 Z" fill="rgba(255,245,225,.55)"></path>
        <path d="M294.9 311.0 L211.8 359.0 L211.8 361.6 L294.9 313.6 Z" fill="rgba(255,245,225,.35)"></path>
        <ellipse
          cx="400.0"
          cy="506.0"
          rx="100.0"
          ry="36.0"
          fill="rgba(60,40,20,.35)"
          filter="url(#hero-blur)"
        ></ellipse>
        <path d="M313.4 400.0 L400.0 450.0 L400.0 550.0 L313.4 500.0 Z" fill="url(#hero-cL)"></path>
        <path d="M486.6 400.0 L486.6 500.0 L400.0 550.0 L400.0 450.0 Z" fill="url(#hero-cR)"></path>
        <path d="M400.0 350.0 L486.6 400.0 L400.0 450.0 L313.4 400.0 Z" fill="url(#hero-cT)"></path>
        <path d="M356.7 375.0 L443.3 425.0" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
        <path d="M356.7 376.2 L443.3 426.2" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
        <path d="M436.4 371.0 L450.2 379.0 L363.6 429.0 L349.8 421.0 Z" fill="rgba(210,190,150,.55)"></path>
        <path d="M450.2 421.0 L436.4 429.0 L436.4 474.0 L450.2 466.0 Z" fill="rgba(210,190,150,.45)"></path>
        <path
          d="M400.0 350.0 L486.6 400.0 L400.0 450.0 L313.4 400.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M313.4 400.0 L400.0 450.0 L400.0 550.0 L313.4 500.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <path
          d="M486.6 400.0 L486.6 500.0 L400.0 550.0 L400.0 450.0 Z"
          fill="none"
          stroke="rgba(60,40,20,.28)"
          strokeWidth="1"
          strokeLinejoin="round"
        ></path>
        <circle cx="486.6" cy="402.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="480.4" cy="405.8" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="474.2" cy="409.3" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="468.0" cy="412.9" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="461.9" cy="416.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="455.7" cy="420.1" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="449.5" cy="423.6" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="443.3" cy="427.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="437.1" cy="430.8" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="430.9" cy="434.3" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="424.7" cy="437.9" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="418.6" cy="441.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="412.4" cy="445.1" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <circle cx="406.2" cy="448.6" r="1.3" fill="rgba(70,45,20,.35)"></circle>
        <g transform="translate(400.0,550.0) skewY(-30)">
          <rect x="18" y="-56" width="46" height="26" rx="2" fill="#fff" opacity=".92"></rect>
          <text x="24" y="-43" style={{ fontFamily: "var(--font-sans)" }} fontWeight="700" fontSize="7" fill="#1e1b18">
            HONEY FARM
          </text>
          <text x="24" y="-35" style={{ fontFamily: "var(--font-sans)" }} fontSize="5" fill="#5b534b">
            ส่งจาก: นครสวรรค์
          </text>
          <rect x="22" y="-78" width="16" height="12" fill="none" stroke="#1e1b18" strokeWidth=".8" opacity=".5"></rect>
          <path d="M24 -76h3v3h-3zM33 -76h3v3h-3zM24 -71h3v3h-3zM29 -74h2v2h-2z" fill="#1e1b18" opacity=".5"></path>
        </g>
        <path
          d="M313.4 400.0 L400.0 450.0 L400.0 550.0 L313.4 500.0 Z"
          fill="url(#hero-cL)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".55"
        ></path>
        <path
          d="M486.6 400.0 L486.6 500.0 L400.0 550.0 L400.0 450.0 Z"
          fill="url(#hero-cR)"
          style={{ mixBlendMode: "multiply" }}
          opacity=".45"
        ></path>
        <path d="M313.4 400.0 L400.0 450.0 L400.0 452.6 L313.4 402.6 Z" fill="rgba(255,245,225,.55)"></path>
        <path d="M486.6 400.0 L400.0 450.0 L400.0 452.6 L486.6 402.6 Z" fill="rgba(255,245,225,.35)"></path>
      </g>
    </svg>
  );
}
