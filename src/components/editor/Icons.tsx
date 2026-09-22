const P = (d: string) =>
  function Icon({ className = "h-5 w-5" }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d={d} />
      </svg>
    );
  };

export const IUndo = P("M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3");
export const IRedo = P("m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3");
export const IReset = P("M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5");
export const IPattern = P("M4 4h16v16H4zM4 12h16M12 4v16");
export const IText = P("M5 6V4h14v2M12 4v16M9 20h6");
export const IImage = P("M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01");
export const IRect = P("M4 6h16v12H4z");
export const ICircle = P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z");
export const IInfo = P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01");
export const IBox = P("M12 3 21 8v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8");
export const ISave = P("M5 3h11l3 3v15H5zM8 3v5h7M8 21v-7h8v7");
export const IDownload = P("M12 4v11m0 0-4-4m4 4 4-4M4 20h16");
export const IFit = P("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5");
export const IClose = P("M6 6l12 12M18 6 6 18");
export const ITrash = P("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13");
export const ICopy = P("M8 8h12v12H8zM4 16V4h12");
