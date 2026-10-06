/* eslint-disable react/jsx-no-literals -- the drawn boxes' own printed labels: part of the artwork, not UI copy. */
/**
 * The home page's category tiles' drawings (design language v2, the "Main" board): a folding
 * carton set, a corrugated mailer, a kraft bag and a label roll, on the tile's kraft wash.
 * Decorative — the tile's caption names the category.
 */
export function FoldingTileArt() {
  return (
    <svg viewBox="0 0 320 280" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
      <defs>
        <filter id="foldin-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        </filter>
        <linearGradient id="foldin-wT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(247,243,233)"></stop>
          <stop offset="1" stopColor="rgb(246,240,229)"></stop>
        </linearGradient>
        <linearGradient id="foldin-wL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(191,187,177)"></stop>
          <stop offset="1" stopColor="rgb(226,220,209)"></stop>
        </linearGradient>
        <linearGradient id="foldin-wR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(246,240,228)"></stop>
          <stop offset="1" stopColor="rgb(206,201,191)"></stop>
        </linearGradient>
        <linearGradient id="foldin-gT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(66,138,126)"></stop>
          <stop offset="1" stopColor="rgb(22,111,96)"></stop>
        </linearGradient>
        <linearGradient id="foldin-gL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(10,82,70)"></stop>
          <stop offset="1" stopColor="rgb(11,97,82)"></stop>
        </linearGradient>
        <linearGradient id="foldin-gR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(13,106,90)"></stop>
          <stop offset="1" stopColor="rgb(10,89,75)"></stop>
        </linearGradient>
      </defs>
      <ellipse cx="110.0" cy="206.0" rx="60.0" ry="21.6" fill="rgba(60,40,20,.35)" filter="url(#foldin-blur)"></ellipse>
      <path d="M58.0 70.0 L110.0 100.0 L110.0 230.0 L58.0 200.0 Z" fill="url(#foldin-wL)"></path>
      <path d="M162.0 70.0 L162.0 200.0 L110.0 230.0 L110.0 100.0 Z" fill="url(#foldin-wR)"></path>
      <path d="M110.0 40.0 L162.0 70.0 L110.0 100.0 L58.0 70.0 Z" fill="url(#foldin-wT)"></path>
      <path d="M84.0 55.0 L136.0 85.0" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
      <path d="M84.0 56.2 L136.0 86.2" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
      <path
        d="M110.0 40.0 L162.0 70.0 L110.0 100.0 L58.0 70.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M58.0 70.0 L110.0 100.0 L110.0 230.0 L58.0 200.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M162.0 70.0 L162.0 200.0 L110.0 230.0 L110.0 100.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <circle cx="162.0" cy="72.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="155.5" cy="76.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="149.0" cy="79.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="142.5" cy="83.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="136.0" cy="87.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="129.5" cy="91.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="123.0" cy="94.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="116.5" cy="98.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <g transform="translate(58.0,200.0) skewY(30)">
        <rect x="0" y="-130" width="52" height="130" fill="#0d7a66"></rect>
        <text x="8" y="-74" fontFamily="Trirong,serif" fontWeight="600" fontSize="13" fill="#fff">
          mali
        </text>
        <text x="8" y="-58" fontFamily="Trirong,serif" fontStyle="italic" fontSize="13" fill="#fff">
          glow
        </text>
      </g>
      <path
        d="M58.0 70.0 L110.0 100.0 L110.0 230.0 L58.0 200.0 Z"
        fill="url(#foldin-wL)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".55"
      ></path>
      <path
        d="M162.0 70.0 L162.0 200.0 L110.0 230.0 L110.0 100.0 Z"
        fill="url(#foldin-wR)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".45"
      ></path>
      <path d="M58.0 70.0 L110.0 100.0 L110.0 102.6 L58.0 72.6 Z" fill="rgba(255,245,225,.55)"></path>
      <path d="M162.0 70.0 L110.0 100.0 L110.0 102.6 L162.0 72.6 Z" fill="rgba(255,245,225,.35)"></path>
      <ellipse cx="205.0" cy="279.0" rx="56.0" ry="20.2" fill="rgba(60,40,20,.35)" filter="url(#foldin-blur)"></ellipse>
      <path d="M156.5 217.0 L205.0 245.0 L205.0 301.0 L156.5 273.0 Z" fill="url(#foldin-gL)"></path>
      <path d="M253.5 217.0 L253.5 273.0 L205.0 301.0 L205.0 245.0 Z" fill="url(#foldin-gR)"></path>
      <path d="M205.0 189.0 L253.5 217.0 L205.0 245.0 L156.5 217.0 Z" fill="url(#foldin-gT)"></path>
      <path d="M180.8 203.0 L229.2 231.0" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
      <path d="M180.8 204.2 L229.2 232.2" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
      <path
        d="M205.0 189.0 L253.5 217.0 L205.0 245.0 L156.5 217.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M156.5 217.0 L205.0 245.0 L205.0 301.0 L156.5 273.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M253.5 217.0 L253.5 273.0 L205.0 301.0 L205.0 245.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M156.5 217.0 L205.0 245.0 L205.0 301.0 L156.5 273.0 Z"
        fill="url(#foldin-gL)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".55"
      ></path>
      <path
        d="M253.5 217.0 L253.5 273.0 L205.0 301.0 L205.0 245.0 Z"
        fill="url(#foldin-gR)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".45"
      ></path>
      <path d="M156.5 217.0 L205.0 245.0 L205.0 247.6 L156.5 219.6 Z" fill="rgba(255,245,225,.55)"></path>
      <path d="M253.5 217.0 L205.0 245.0 L205.0 247.6 L253.5 219.6 Z" fill="rgba(255,245,225,.35)"></path>
    </svg>
  );
}

export function CorrugatedTileArt() {
  return (
    <svg viewBox="-50 -30 420 340" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
      <defs>
        <filter id="corrug-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        </filter>
        <linearGradient id="corrug-kT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(216,188,148)"></stop>
          <stop offset="1" stopColor="rgb(207,173,123)"></stop>
        </linearGradient>
        <linearGradient id="corrug-kL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(159,132,92)"></stop>
          <stop offset="1" stopColor="rgb(188,156,108)"></stop>
        </linearGradient>
        <linearGradient id="corrug-kR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(205,170,118)"></stop>
          <stop offset="1" stopColor="rgb(172,142,99)"></stop>
        </linearGradient>
      </defs>
      <ellipse cx="93.4" cy="257.5" rx="123.0" ry="44.3" fill="rgba(60,40,20,.35)" filter="url(#corrug-blur)"></ellipse>
      <path d="M-13.1 168.0 L116.8 243.0 L116.8 313.0 L-13.1 238.0 Z" fill="url(#corrug-kL)"></path>
      <path d="M199.9 195.0 L199.9 265.0 L116.8 313.0 L116.8 243.0 Z" fill="url(#corrug-kR)"></path>
      <path d="M70.0 120.0 L199.9 195.0 L116.8 243.0 L-13.1 168.0 Z" fill="url(#corrug-kT)"></path>
      <path d="M28.4 144.0 L158.3 219.0" stroke="rgba(70,45,20,.55)" strokeWidth="1.6"></path>
      <path d="M28.4 145.2 L158.3 220.2" stroke="rgba(255,255,255,.35)" strokeWidth="1"></path>
      <path d="M124.6 151.5 L145.3 163.5 L62.2 211.5 L41.4 199.5 Z" fill="rgba(210,190,150,.55)"></path>
      <path d="M165.0 215.2 L151.7 222.8 L151.7 254.3 L165.0 246.7 Z" fill="rgba(210,190,150,.45)"></path>
      <path
        d="M70.0 120.0 L199.9 195.0 L116.8 243.0 L-13.1 168.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M-13.1 168.0 L116.8 243.0 L116.8 313.0 L-13.1 238.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M199.9 195.0 L199.9 265.0 L116.8 313.0 L116.8 243.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <circle cx="199.9" cy="197.2" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="193.5" cy="200.9" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="187.1" cy="204.6" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="180.7" cy="208.3" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="174.3" cy="212.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="167.9" cy="215.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="161.5" cy="219.4" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="155.1" cy="223.0" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="148.7" cy="226.7" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="142.3" cy="230.4" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="136.0" cy="234.1" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="129.6" cy="237.8" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <circle cx="123.2" cy="241.5" r="1.3" fill="rgba(70,45,20,.35)"></circle>
      <path
        d="M-13.1 168.0 L116.8 243.0 L116.8 313.0 L-13.1 238.0 Z"
        fill="url(#corrug-kL)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".55"
      ></path>
      <path
        d="M199.9 195.0 L199.9 265.0 L116.8 313.0 L116.8 243.0 Z"
        fill="url(#corrug-kR)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".45"
      ></path>
      <path d="M-13.1 168.0 L116.8 243.0 L116.8 245.6 L-13.1 170.6 Z" fill="rgba(255,245,225,.55)"></path>
      <path d="M199.9 195.0 L116.8 243.0 L116.8 245.6 L199.9 197.6 Z" fill="rgba(255,245,225,.35)"></path>
    </svg>
  );
}

export function BagTileArt() {
  return (
    <svg viewBox="0 0 320 280" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
      <defs>
        <filter id="bagtil-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        </filter>
        <linearGradient id="bagtil-bT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(227,204,165)"></stop>
          <stop offset="1" stopColor="rgb(221,192,144)"></stop>
        </linearGradient>
        <linearGradient id="bagtil-bL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(171,148,109)"></stop>
          <stop offset="1" stopColor="rgb(202,174,128)"></stop>
        </linearGradient>
        <linearGradient id="bagtil-bR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(220,190,140)"></stop>
          <stop offset="1" stopColor="rgb(184,159,117)"></stop>
        </linearGradient>
      </defs>
      <ellipse cx="140.3" cy="253.5" rx="75.0" ry="27.0" fill="rgba(60,40,20,.35)" filter="url(#bagtil-blur)"></ellipse>
      <path d="M75.4 110.0 L170.6 165.0 L170.6 285.0 L75.4 230.0 Z" fill="url(#bagtil-bL)"></path>
      <path d="M205.3 145.0 L205.3 265.0 L170.6 285.0 L170.6 165.0 Z" fill="url(#bagtil-bR)"></path>
      <path d="M110.0 90.0 L205.3 145.0 L170.6 165.0 L75.4 110.0 Z" fill="url(#bagtil-bT)"></path>
      <path
        d="M110.0 90.0 L205.3 145.0 L170.6 165.0 L75.4 110.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M75.4 110.0 L170.6 165.0 L170.6 285.0 L75.4 230.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M205.3 145.0 L205.3 265.0 L170.6 285.0 L170.6 165.0 Z"
        fill="none"
        stroke="rgba(60,40,20,.28)"
        strokeWidth="1"
        strokeLinejoin="round"
      ></path>
      <path
        d="M127.3 102.0 C127.3 62.0 187.9 97.0 187.9 137.0"
        fill="none"
        stroke="#7a5a33"
        strokeWidth="3"
        strokeLinecap="round"
      ></path>
      <path
        d="M92.7 122.0 C92.7 82.0 153.3 117.0 153.3 157.0"
        fill="none"
        stroke="#7a5a33"
        strokeWidth="3"
        strokeLinecap="round"
      ></path>
      <path
        d="M75.4 110.0 L170.6 165.0 L170.6 285.0 L75.4 230.0 Z"
        fill="url(#bagtil-bL)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".55"
      ></path>
      <path
        d="M205.3 145.0 L205.3 265.0 L170.6 285.0 L170.6 165.0 Z"
        fill="url(#bagtil-bR)"
        style={{ mixBlendMode: "multiply" }}
        opacity=".45"
      ></path>
      <path d="M75.4 110.0 L170.6 165.0 L170.6 167.6 L75.4 112.6 Z" fill="rgba(255,245,225,.55)"></path>
      <path d="M205.3 145.0 L170.6 165.0 L170.6 167.6 L205.3 147.6 Z" fill="rgba(255,245,225,.35)"></path>
    </svg>
  );
}

export function LabelTileArt() {
  return (
    <svg viewBox="0 0 320 280" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
      <defs>
        <filter id="labelt-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        </filter>
        <linearGradient id="labelt-cyl" x1="0" x2="1">
          <stop offset="0" stopColor="#e3dbcf"></stop>
          <stop offset=".45" stopColor="#fff"></stop>
          <stop offset="1" stopColor="#d6ccbd"></stop>
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="200" rx="86" ry="30" fill="rgba(60,40,20,.3)" filter="url(#labelt-blur)"></ellipse>
      <path d="M80 90 v90 a80 28 0 0 0 160 0 v-90" fill="url(#labelt-cyl)"></path>
      <ellipse cx="160" cy="90" rx="80" ry="28" fill="#fff"></ellipse>
      <ellipse cx="160" cy="90" rx="78" ry="26" fill="none" stroke="#e8dfd2"></ellipse>
      <ellipse cx="160" cy="90" rx="26" ry="9" fill="#e7d8c0"></ellipse>
      <g transform="translate(160,120)">
        <rect x="-40" y="0" width="80" height="34" rx="4" fill="#0d7a66"></rect>
        <text x="0" y="22" textAnchor="middle" fontFamily="Trirong,serif" fontWeight="600" fontSize="14" fill="#fff">
          ฉลาก
        </text>
      </g>
    </svg>
  );
}
