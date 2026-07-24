"use client";

import { useEffect } from "react";

/**
 * SDE audience, SDE joke: whoever opens devtools on an audit tool is
 * exactly the person this is for. Fires once per page load.
 */
export function ConsoleEgg() {
  useEffect(() => {
    console.log(
      "%c$ whoami",
      "color:#8a8a82;font-family:monospace;font-size:12px;"
    );
    console.log(
      "%cchecking the source instead of trusting the score. correct instinct.",
      "color:#ffb400;font-family:monospace;font-size:13px;font-weight:bold;"
    );
    console.log(
      "%cnothing hidden here — same fetch → parse → score pipeline the UI, the API, and the CLI all share. lib/audit.ts, if you want the real thing.",
      "color:#e9e7e0;font-family:monospace;font-size:12px;"
    );
  }, []);

  return null;
}
