// --- State Management ---
let allQuestions = [];
let currentQuestion = null;
let currentQuizName = "questions.json"; // Default file name
let progress = {};

// --- Progress Handling ---
function loadProgress() {
  // Load progress tied specifically to the current file name
  progress = JSON.parse(localStorage.getItem("quiz_progress_" + currentQuizName)) || {};
}

function saveProgress() {
  // Save progress tied specifically to the current file name
  localStorage.setItem("quiz_progress_" + currentQuizName, JSON.stringify(progress));
}

// --- DOM Elements ---
const DOM = {
  fileUpload: document.getElementById("file-upload"),
  resetBtn: document.getElementById("reset-btn"),
  skipInput: document.getElementById("skip-input"),
  skipBtn: document.getElementById("skip-btn"),
  scorePercent: document.getElementById("score-percent"),
  answeredCount: document.getElementById("answered-count"),
  msgContainer: document.getElementById("message-container"),
  quizArea: document.getElementById("question-area"),
  qTitle: document.getElementById("q-title"),
  qTopic: document.getElementById("q-topic"),
  qText: document.getElementById("q-text"),
  qImages: document.getElementById("q-images"),
  qInteraction: document.getElementById("q-interaction-area"),
  qFeedback: document.getElementById("q-feedback-area"),
  feedbackTitle: document.getElementById("feedback-title"),
  qAnswerImages: document.getElementById("q-answer-images"),
  qExplanation: document.getElementById("q-explanation"),
  selfMarkControls: document.getElementById("self-mark-controls"),
  nextBtn: document.getElementById("next-btn"),
  markCorrectBtn: document.getElementById("mark-correct-btn"),
  markIncorrectBtn: document.getElementById("mark-incorrect-btn"),
};

// --- Initialization ---
function init() {
  loadProgress();
  updateStatsUI();

  fetch(currentQuizName)
    .then((response) => {
      if (!response.ok) throw new Error("Local file not found");
      return response.json();
    })
    .then((data) => {
      allQuestions = data;
      startQuiz();
    })
    .catch((err) => {
      DOM.msgContainer.textContent =
        "Could not load questions automatically. Please upload a JSON file.";
    });

  // Event Listeners
  DOM.fileUpload.addEventListener("change", handleFileUpload);
  DOM.resetBtn.addEventListener("click", resetProgress);
  DOM.skipBtn.addEventListener("click", handleSkip);
  DOM.nextBtn.addEventListener("click", loadNextQuestion);
  DOM.markCorrectBtn.addEventListener("click", () => recordSelfMark(true));
  DOM.markIncorrectBtn.addEventListener("click", () => recordSelfMark(false));
}

// --- File Handling ---
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  currentQuizName = file.name; // Update the state with the new file's name

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      allQuestions = JSON.parse(e.target.result);
      loadProgress(); // Fetch the unique progress profile for this specific file
      startQuiz();
    } catch (error) {
      alert("Invalid JSON format.");
    }
  };
  reader.readAsText(file);
}

// --- Quiz Logic ---
function startQuiz() {
  DOM.msgContainer.style.display = "none";
  DOM.quizArea.style.display = "block";
  updateStatsUI(); // Ensure stats reflect the newly loaded file's progress
  loadNextQuestion();
}

function handleSkip() {
  if (allQuestions.length === 0) return;

  const targetIndex = parseInt(DOM.skipInput.value) - 1; // Convert 1-based to 0-based array index

  if (
    isNaN(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= allQuestions.length
  ) {
    alert(
      `Please enter a valid question number between 1 and ${allQuestions.length}`,
    );
    return;
  }

  // 1. FORWARD SKIP: Mark all previous questions as skipped (null) if not already answered
  for (let i = 0; i < targetIndex; i++) {
    const qTitle = allQuestions[i].title;
    if (!(qTitle in progress)) {
      progress[qTitle] = null;
    }
  }

  // 2. BACKTRACK: If we are going backward, delete progress for the target question and everything after it
  for (let i = targetIndex; i < allQuestions.length; i++) {
    const qTitle = allQuestions[i].title;
    delete progress[qTitle];
  }

  // Save and re-load
  saveProgress();
  updateStatsUI();
  DOM.skipInput.value = ""; // clear input

  loadNextQuestion();
}

function loadNextQuestion() {
  // Hide feedback areas
  DOM.qFeedback.style.display = "none";
  DOM.selfMarkControls.style.display = "none";
  DOM.nextBtn.style.display = "none";
  DOM.qInteraction.innerHTML = "";
  DOM.qImages.innerHTML = "";
  DOM.qAnswerImages.innerHTML = "";

  // Find next unanswered question (where title is NOT in the progress object)
  currentQuestion = allQuestions.find((q) => !(q.title in progress));

  if (!currentQuestion) {
    DOM.quizArea.style.display = "none";
    DOM.msgContainer.style.display = "block";
    DOM.msgContainer.textContent =
      "🎉 You have completed all available questions for this file!";
    return;
  }

  renderQuestion(currentQuestion);
}

function renderQuestion(q) {
  DOM.qTitle.textContent = q.title;
  DOM.qTopic.textContent = `Topic: ${q.topic}`;
  DOM.qText.textContent = q.questionText.replace("//IMG//", "");

  if (q.questionImages && q.questionImages.length > 0) {
    q.questionImages.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      DOM.qImages.appendChild(img);
    });
  }

  if (q.isMultipleChoice && q.choices) {
    renderMultipleChoice(q);
  } else {
    renderSelfMarking(q);
  }
}

function renderMultipleChoice(q) {
  const form = document.createElement("form");

  const isMultiSelect = q.correctAnswer && q.correctAnswer.length > 1;
  const inputType = isMultiSelect ? "checkbox" : "radio";

  const sortedChoices = Object.entries(q.choices).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );

  for (const [key, value] of sortedChoices) {
    const label = document.createElement("label");
    label.className = "choice-label";

    const input = document.createElement("input");
    input.type = inputType;
    input.name = "choice";
    input.value = key;

    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${key}: ${value}`));
    form.appendChild(label);
  }

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary";
  submitBtn.textContent = "Submit Answer";

  form.appendChild(submitBtn);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedInputs = Array.from(
      form.querySelectorAll('input[name="choice"]:checked'),
    );
    if (selectedInputs.length === 0) return alert("Please select an answer.");

    const selectedValues = selectedInputs
      .map((input) => input.value)
      .sort()
      .join("");
    const expectedAnswer = q.correctAnswer.split("").sort().join("");
    const isCorrect = selectedValues === expectedAnswer;

    handleAnswer(isCorrect);

    submitBtn.disabled = true;
    form.querySelectorAll("input").forEach((input) => (input.disabled = true));
  });

  DOM.qInteraction.appendChild(form);
}

function renderSelfMarking(q) {
  const revealBtn = document.createElement("button");
  revealBtn.className = "btn btn-primary";
  revealBtn.textContent = "Reveal Answer";

  revealBtn.addEventListener("click", () => {
    revealBtn.style.display = "none";
    showFeedback(null);
  });

  DOM.qInteraction.appendChild(revealBtn);
}

// --- Evaluation & Feedback ---
function handleAnswer(isCorrect) {
  updateProgress(isCorrect);
  showFeedback(isCorrect);
}

function recordSelfMark(isCorrect) {
  updateProgress(isCorrect);
  DOM.selfMarkControls.style.display = "none";
  DOM.nextBtn.style.display = "block";
}

function showFeedback(autoGradeResult) {
  DOM.qFeedback.style.display = "block";

  if (autoGradeResult !== null) {
    DOM.feedbackTitle.textContent = autoGradeResult
      ? "✅ Correct!"
      : `❌ Incorrect! (Correct answer: ${currentQuestion.correctAnswer.split("").sort().join(", ")})`;
    DOM.feedbackTitle.style.color = autoGradeResult
      ? "var(--success)"
      : "var(--danger)";
    DOM.nextBtn.style.display = "block";
  } else {
    DOM.feedbackTitle.textContent = "Answer Reveal:";
    DOM.feedbackTitle.style.color = "inherit";
    if (currentQuestion.correctAnswer) {
      DOM.feedbackTitle.textContent += ` ${currentQuestion.correctAnswer.split("").sort().join(", ")}`;
    }
    DOM.selfMarkControls.style.display = "flex";
  }

  if (currentQuestion.answerImages && currentQuestion.answerImages.length > 0) {
    currentQuestion.answerImages.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      DOM.qAnswerImages.appendChild(img);
    });
  }

  DOM.qExplanation.textContent = currentQuestion.explanation
    ? `Explanation: ${currentQuestion.explanation}`
    : "";
}

// --- State Updates ---
function getStats() {
  let total = 0;
  let correct = 0;
  for (const title in progress) {
    total++;
    if (progress[title] === true) correct++;
  }
  return { total, correct };
}

function updateProgress(isCorrect) {
  progress[currentQuestion.title] = isCorrect;
  saveProgress();
  updateStatsUI();
}

function updateStatsUI() {
  const stats = getStats();
  DOM.answeredCount.textContent = stats.total;
  const percentage =
    stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  DOM.scorePercent.textContent = `${percentage}%`;
}

function resetProgress() {
  if (!confirm(`Are you sure you want to reset all your progress for ${currentQuizName}?`)) return;
  progress = {};
  saveProgress();
  updateStatsUI();
  if (allQuestions.length > 0) startQuiz();
}

// Boot up
init();