// --- State Management ---
let allQuestions = [];
let currentPlaylist = [];
let currentQuestion = null;
let currentQuizName = "questions.json";
let progress = {};

// --- DOM Elements ---
const DOM = {
  courseTitle: document.getElementById("course-title"),
  fileUpload: document.getElementById("file-upload"),
  resetBtn: document.getElementById("reset-btn"),
  unitSelect: document.getElementById("unit-select"),
  questionSelect: document.getElementById("question-select"),
  randomBtn: document.getElementById("random-btn"),
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

  fetch(currentQuizName)
    .then((response) => {
      if (!response.ok) throw new Error("Local file not found");
      return response.json();
    })
    .then((data) => {
      processCourseData(data);
    })
    .catch((err) => {
      DOM.msgContainer.textContent =
        "Could not load questions automatically. Please upload your JSON file.";
    });

  // Event Listeners
  DOM.fileUpload.addEventListener("change", handleFileUpload);
  DOM.resetBtn.addEventListener("click", resetProgress);
  DOM.randomBtn.addEventListener("click", generateRandomQuiz);
  DOM.nextBtn.addEventListener("click", loadNextQuestion);
  DOM.markCorrectBtn.addEventListener("click", () => recordSelfMark(true));
  DOM.markIncorrectBtn.addEventListener("click", () => recordSelfMark(false));
  
  DOM.unitSelect.addEventListener("change", handleUnitChange);
  DOM.questionSelect.addEventListener("change", handleQuestionChange);
}

// --- Data Parsing & Progress ---
function processCourseData(data) {
  DOM.courseTitle.textContent = data.course || "Mock Quiz App";
  allQuestions = [];

  data.units.forEach((u) => {
    u.questions.forEach((q, idx) => {
      let choices = q.options || {};
      let correctAns = q.correctAnswers || [];
      
      // Auto-generate true/false options if missing
      if (q.type === "true_false" && Object.keys(choices).length === 0) {
        choices = { "True": "True", "False": "False" };
      }

      // If ordering question has no correctAnswers array, assume the sorted keys are the correct order
      if (q.type === "ordering" && correctAns.length === 0) {
        correctAns = Object.keys(choices).sort();
      }

      allQuestions.push({
        title: `Unit ${u.unit} - Q${idx + 1}`,
        unit: u.unit,
        topic: `Unit ${u.unit}`,
        questionText: q.question,
        type: q.type,
        choices: choices,
        correctAnswers: correctAns,
        explanation: q.explanation || ""
      });
    });
  });

  populateUnitDropdown();
  setPlaylist(allQuestions);
}

function loadProgress() {
  progress = JSON.parse(localStorage.getItem("quiz_progress_" + currentQuizName)) || {};
}

function saveProgress() {
  localStorage.setItem("quiz_progress_" + currentQuizName, JSON.stringify(progress));
}

// --- Navigation & UI Updates ---
function populateUnitDropdown() {
  const units = [...new Set(allQuestions.map(q => q.unit))];
  DOM.unitSelect.innerHTML = '<option value="all">All Units</option>';
  units.forEach(u => {
    DOM.unitSelect.innerHTML += `<option value="${u}">Unit ${u}</option>`;
  });
}

function updateQuestionDropdown() {
  DOM.questionSelect.innerHTML = '<option value="">-- Select Question --</option>';
  currentPlaylist.forEach(q => {
    let status = progress[q.title] !== undefined ? (progress[q.title] ? '✅' : '❌') : '⬜';
    DOM.questionSelect.innerHTML += `<option value="${q.title}">${status} ${q.title}</option>`;
  });
  
  if (currentQuestion) {
      DOM.questionSelect.value = currentQuestion.title;
  }
}

function handleUnitChange(e) {
  const val = e.target.value;
  if (val === "all") {
    setPlaylist(allQuestions);
  } else {
    setPlaylist(allQuestions.filter(q => q.unit == val));
  }
}

function handleQuestionChange(e) {
  const title = e.target.value;
  if (!title) return;
  const targetQ = currentPlaylist.find(q => q.title === title);
  if (targetQ) {
    currentQuestion = targetQ;
    renderQuestion(targetQ);
  }
}

function setPlaylist(playlist) {
  currentPlaylist = playlist;
  currentQuestion = null; 
  updateQuestionDropdown();
  updateStatsUI();
  loadNextQuestion();
}

// --- Core Logic ---
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  currentQuizName = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      loadProgress();
      processCourseData(data);
    } catch (error) {
      alert("Invalid JSON format. Please ensure it matches the required structure.");
    }
  };
  reader.readAsText(file);
}

function generateRandomQuiz() {
  let countStr = prompt(`How many questions? (Max: ${allQuestions.length})`, "10");
  if (!countStr) return;
  
  let count = parseInt(countStr);
  if (isNaN(count) || count <= 0) return;
  if (count > allQuestions.length) count = allQuestions.length;

  if (!confirm("This will reset your current session's progress. Continue?")) return;

  progress = {};
  saveProgress();

  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  DOM.unitSelect.value = "all";
  setPlaylist(shuffled.slice(0, count));
}

function loadNextQuestion() {
  DOM.qFeedback.style.display = "none";
  DOM.selfMarkControls.style.display = "none";
  DOM.nextBtn.style.display = "none";
  DOM.qInteraction.innerHTML = "";
  DOM.qImages.innerHTML = "";
  DOM.qAnswerImages.innerHTML = "";

  let currentIdx = currentPlaylist.findIndex(q => currentQuestion && q.title === currentQuestion.title);
  
  let nextQ = null;
  for (let i = currentIdx + 1; i < currentPlaylist.length; i++) {
    if (!(currentPlaylist[i].title in progress)) {
      nextQ = currentPlaylist[i];
      break;
    }
  }

  if (!nextQ) {
    for (let i = 0; i < currentIdx; i++) {
      if (!(currentPlaylist[i].title in progress)) {
        nextQ = currentPlaylist[i];
        break;
      }
    }
  }

  if (!nextQ) {
    if (currentQuestion && !(currentQuestion.title in progress)) {
       return;
    }
    DOM.quizArea.style.display = "none";
    DOM.msgContainer.style.display = "block";
    DOM.msgContainer.textContent = "🎉 You have completed all questions in the current selection!";
    return;
  }

  currentQuestion = nextQ;
  renderQuestion(currentQuestion);
}

function renderQuestion(q) {
  DOM.quizArea.style.display = "block";
  DOM.msgContainer.style.display = "none";
  
  DOM.questionSelect.value = q.title;
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

  DOM.qFeedback.style.display = "none";
  DOM.qInteraction.innerHTML = "";

  if (q.type === "multiple_choice" || q.type === "single_choice" || q.type === "true_false") {
    renderStandardChoices(q);
  } else if (q.type === "ordering") {
    renderOrdering(q);
  } else {
    renderSelfMarking(q);
  }
}

// --- Interaction Rendering ---
function renderStandardChoices(q) {
  const form = document.createElement("form");
  const isMultiSelect = q.type === "multiple_choice";
  const inputType = isMultiSelect ? "checkbox" : "radio";

  for (const [key, value] of Object.entries(q.choices)) {
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

    const selectedInputs = Array.from(form.querySelectorAll('input[name="choice"]:checked'));
    if (selectedInputs.length === 0) return alert("Please select an answer.");

    const selectedValues = selectedInputs.map(input => input.value).sort();
    const expectedValues = q.correctAnswers.slice().sort();
    
    const isCorrect = JSON.stringify(selectedValues) === JSON.stringify(expectedValues);

    handleAnswer(isCorrect);

    submitBtn.disabled = true;
    form.querySelectorAll("input").forEach(input => (input.disabled = true));
  });

  DOM.qInteraction.appendChild(form);
}

function renderOrdering(q) {
  const container = document.createElement("div");
  container.className = "ordering-container";

  const p = document.createElement("p");
  p.textContent = "Use the Up/Down arrows to arrange the items in the correct order.";
  p.style.fontStyle = "italic";
  p.style.marginBottom = "15px";
  container.appendChild(p);

  const list = document.createElement("ul");
  list.className = "ordering-list";

  // Shuffle the initial display
  let currentOrder = [...Object.keys(q.choices)].sort(() => Math.random() - 0.5);

  function renderList() {
    list.innerHTML = "";
    currentOrder.forEach((key, index) => {
      const li = document.createElement("li");
      li.className = "ordering-item";
      li.dataset.key = key;

      const controls = document.createElement("div");
      controls.className = "order-controls";

      const btnUp = document.createElement("button");
      btnUp.className = "btn-order";
      btnUp.innerHTML = "▲";
      btnUp.disabled = index === 0;
      btnUp.onclick = () => moveItem(index, -1);

      const btnDown = document.createElement("button");
      btnDown.className = "btn-order";
      btnDown.innerHTML = "▼";
      btnDown.disabled = index === currentOrder.length - 1;
      btnDown.onclick = () => moveItem(index, 1);

      controls.appendChild(btnUp);
      controls.appendChild(btnDown);

      const text = document.createElement("div");
      text.className = "order-text";
      text.textContent = q.choices[key];

      li.appendChild(controls);
      li.appendChild(text);
      list.appendChild(li);
    });
  }

  function moveItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[newIndex];
    currentOrder[newIndex] = temp;
    
    renderList();
  }

  renderList();
  container.appendChild(list);

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary";
  submitBtn.textContent = "Submit Answer";
  container.appendChild(submitBtn);

  submitBtn.addEventListener("click", () => {
    // Compare strictly by array sequence
    const isCorrect = JSON.stringify(currentOrder) === JSON.stringify(q.correctAnswers);
    
    handleAnswer(isCorrect);
    
    submitBtn.disabled = true;
    list.querySelectorAll('.btn-order').forEach(btn => btn.disabled = true);
  });

  DOM.qInteraction.appendChild(container);
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

  // Build the correct answer text conditionally based on type
  let correctAnswerText = "";
  if (currentQuestion.correctAnswers && currentQuestion.correctAnswers.length > 0) {
    if (currentQuestion.type === "ordering") {
      // Connect them with arrows for visual clarity
      correctAnswerText = currentQuestion.correctAnswers.map(key => `[${key}] ${currentQuestion.choices[key]}`).join(" ➔ ");
    } else {
      correctAnswerText = currentQuestion.correctAnswers.slice().sort().join(", ");
    }
  }

  if (autoGradeResult !== null) {
    DOM.feedbackTitle.textContent = autoGradeResult ? "✅ Correct!" : "❌ Incorrect!";
    if (!autoGradeResult && correctAnswerText) {
       DOM.feedbackTitle.textContent += ` (Correct: ${correctAnswerText})`;
    }
    DOM.feedbackTitle.style.color = autoGradeResult ? "var(--success)" : "var(--danger)";
    DOM.nextBtn.style.display = "block";
  } else {
    DOM.feedbackTitle.textContent = "Answer Reveal:";
    DOM.feedbackTitle.style.color = "inherit";
    if (correctAnswerText) {
      DOM.feedbackTitle.textContent += ` ${correctAnswerText}`;
    }
    DOM.selfMarkControls.style.display = "flex";
  }

  DOM.qExplanation.textContent = currentQuestion.explanation ? `Explanation: ${currentQuestion.explanation}` : "";
}

// --- State Updates ---
function updateProgress(isCorrect) {
  progress[currentQuestion.title] = isCorrect;
  saveProgress();
  updateStatsUI();
  updateQuestionDropdown();
}

function updateStatsUI() {
  let total = currentPlaylist.length;
  let answered = 0;
  let correct = 0;

  currentPlaylist.forEach(q => {
    if (q.title in progress) {
      answered++;
      if (progress[q.title] === true) correct++;
    }
  });

  DOM.answeredCount.textContent = `${answered} / ${total}`;
  const percentage = answered === 0 ? 0 : Math.round((correct / answered) * 100);
  DOM.scorePercent.textContent = `${percentage}%`;
}

function resetProgress() {
  if (!confirm(`Are you sure you want to reset all your progress for ${currentQuizName}?`)) return;
  progress = {};
  saveProgress();
  updateStatsUI();
  updateQuestionDropdown();
  if (currentPlaylist.length > 0) loadNextQuestion();
}

// Boot up
init();