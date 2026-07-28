const HintLadder = ({ currentHint, revealedCount, totalHints, onNext, loading }) => {
  return (
    <div className="stack gap-md">
      <div className="card">
        <span className="chip">Hint {revealedCount} / {totalHints}</span>
        <p className="hint-text">{currentHint}</p>
      </div>
      <button onClick={onNext} disabled={loading || revealedCount >= totalHints}>
        {loading ? "Loading..." : revealedCount >= totalHints ? "All hints shown" : "Give me the next hint"}
      </button>
    </div>
  );
};

export default HintLadder;
