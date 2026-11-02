import { DrawingFrame } from "./DrawingFrame";

/** #/draw in development: the drawing frame on its own */
export default function Sketch() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <DrawingFrame keepAs="jqzz:sketch" onSend={async () => true} />
    </main>
  );
}
