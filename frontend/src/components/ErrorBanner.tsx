import useGameStore from "../store/gameStore";

export default function ErrorBanner() {
  const errorMessage = useGameStore((s) => s.errorMessage);
  const setErrorMessage = useGameStore((s) => s.setErrorMessage);

  if (!errorMessage) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: "12px 16px",
        backgroundColor: "rgba(220, 38, 38, 0.95)",
        color: "white",
        fontWeight: 600,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{errorMessage}</span>
      <button
        style={{
          marginLeft: 12,
          backgroundColor: "rgba(255,255,255,0.2)",
          border: "none",
          color: "white",
          borderRadius: 4,
          padding: "4px 8px",
          cursor: "pointer",
        }}
        onClick={() => setErrorMessage(undefined)}
      >
        Close
      </button>
    </div>
  );
}
