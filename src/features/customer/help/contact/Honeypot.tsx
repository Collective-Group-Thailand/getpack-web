import { HONEYPOT } from "./send";

/** A field only robots fill: off-screen, out of the tab order and hidden from assistive technology. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        {HONEYPOT}
        <input type="text" name={HONEYPOT} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
