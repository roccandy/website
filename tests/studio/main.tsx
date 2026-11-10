import { createRoot } from "react-dom/client";
import { useState } from "react";
import { DesignEditor } from "@/app/admin/design/DesignEditor";
import {
  studioCandyDesign,
  emptyCandyDesign,
  type CandyDesign,
} from "@/lib/candyDesign";
import "@/app/globals.css";

// Isolated component harness. Authentication/database writes are mocked by server.mjs.
function Harness() {
  const [applied, setApplied] = useState<CandyDesign>();
  const [initial] = useState(() =>
    new URLSearchParams(location.search).has("legacy")
      ? emptyCandyDesign("Legacy fixture")
      : studioCandyDesign("Studio fixture"),
  );
  return (
    <div className="mx-auto max-w-[1700px] p-4">
      <DesignEditor initialDesign={initial} onApply={setApplied} />
      <output data-testid="applied" hidden>
        {JSON.stringify(applied)}
      </output>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
