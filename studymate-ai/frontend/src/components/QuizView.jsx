import { useMemo, useState } from "react";

const QuizView = ({ quiz }) => {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    if (!submitted) {
      return 0;
    }

    return quiz.reduce((total, item, index) => total + (answers[index] === item.correctIndex ? 1 : 0), 0);
  }, [answers, quiz, submitted]);

  if (!quiz?.length) {
    return <div className="empty-state">No quiz generated yet.</div>;
  }

  return (
    <div className="stack gap-lg">
      {quiz.map((item, index) => (
        <div key={index} className="card subtle">
          <p className="question-text">{index + 1}. {item.question}</p>
          <div className="options-grid">
            {item.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={`option-button ${answers[index] === optionIndex ? "selected" : ""} ${submitted && item.correctIndex === optionIndex ? "correct" : ""}`}
                onClick={() => setAnswers((value) => ({ ...value, [index]: optionIndex }))}
                disabled={submitted}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="quiz-footer">
        <button onClick={() => setSubmitted(true)}>Submit Quiz</button>
        {submitted ? <span className="score-pill">Score: {score}/{quiz.length}</span> : null}
      </div>
    </div>
  );
};

export default QuizView;
