// DOM Elements
const setupView = document.getElementById('setup-view');
const testView = document.getElementById('test-view');
const resultView = document.getElementById('result-view');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const setupError = document.getElementById('setup-error');
const shuffleToggle = document.getElementById('shuffle-toggle');
const sampleBtn = document.getElementById('sample-btn');

const progressBar = document.getElementById('progress-bar');
const currentQuestionNumEl = document.getElementById('current-question-num');
const totalQuestionsEl = document.getElementById('total-questions');
const currentScoreEl = document.getElementById('current-score');
const questionTextEl = document.getElementById('question-text');
const readQuestionBtn = document.getElementById('read-question-btn');
const choicesContainer = document.getElementById('choices-container');
const answerBtn = document.getElementById('answer-btn');

const finalScoreCorrectEl = document.getElementById('final-score-correct');
const finalScoreTotalEl = document.getElementById('final-score-total');
const scoreMessageEl = document.getElementById('score-message');
const retryBtn = document.getElementById('retry-btn');
const toggleReviewBtn = document.getElementById('toggle-review-btn');
const reviewList = document.getElementById('review-list');
const reviewChevron = document.getElementById('review-chevron');
const voiceSelect = document.getElementById('voice-select');

// Application State
let questions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let results = []; // { questionData, userAnswer, isCorrect }
let selectedChoiceText = null;
let currentChoices = []; // Randomized choices for the current question
let isAnswered = false;
let availableVoices = [];
let selectedVoice = null;

// --- File Handling & CSV Parsing ---

// Handle Drag and Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// Handle File Input Click
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    setupError.classList.add('hidden');

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        showError('CSVファイルを選択してください。');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            parseCSV(e.target.result);
            startTest();
        } catch (error) {
            showError('ファイルの読み込みに失敗しました。フォーマットを確認してください。');
            console.error(error);
        }
    };
    reader.onerror = () => {
        showError('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsText(file);
}

function showError(message) {
    setupError.textContent = message;
    setupError.classList.remove('hidden');
}

// Handle Sample Button Click
sampleBtn.addEventListener('click', async () => {
    setupError.classList.add('hidden');
    // Disable button to prevent multiple clicks
    const originalText = sampleBtn.textContent;
    sampleBtn.textContent = '読み込み中...';
    sampleBtn.disabled = true;

    try {
        const response = await fetch('sample.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        parseCSV(text);
        startTest();
    } catch (error) {
        showError('サンプルファイルの読み込みに失敗しました。「sample.csv」が同じフォルダに存在するか確認してください。');
        console.error('Error fetching sample CSV:', error);
    } finally {
        sampleBtn.textContent = originalText;
        sampleBtn.disabled = false;
    }
});

function parseCSV(text) {
    // Basic CSV parsing. Assumes no quoted commas within the fields for this specific app format.
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length <= 1) {
        throw new Error('データがありません');
    }

    // Skip the first line (header)
    const dataLines = lines.slice(1);

    const parsedQuestions = dataLines.map(line => {
        const columns = line.split(',');
        // Expected format: 漢字,カタカナ読み,正答,誤答1,誤答2,誤答3
        if (columns.length < 6) return null;

        return {
            kanji: columns[0].trim(),
            katakana: columns[1].trim(),
            correct: columns[2].trim(),
            wrong1: columns[3].trim(),
            wrong2: columns[4].trim(),
            wrong3: columns[5].trim()
        };
    }).filter(q => q !== null);

    if (parsedQuestions.length === 0) {
        throw new Error('有効な問題がありません');
    }

    let finalQuestions = parsedQuestions;

    // Shuffle if enabled
    if (shuffleToggle.checked) {
        finalQuestions = shuffleArray(finalQuestions);
    }

    questions = finalQuestions;
}

// Utility: Fisher-Yates array shuffle
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// --- Audio (Speech Synthesis) ---
function initVoices() {
    if (!('speechSynthesis' in window)) {
        voiceSelect.innerHTML = '<option value="">音声合成に非対応です</option>';
        voiceSelect.disabled = true;
        return;
    }

    const populateVoices = () => {
        availableVoices = window.speechSynthesis.getVoices();

        // Filter for Japanese voices
        const jpVoices = availableVoices.filter(voice => voice.lang.includes('ja'));

        if (jpVoices.length === 0) {
            voiceSelect.innerHTML = '<option value="">日本語音声が見つかりません</option>';
            return;
        }

        voiceSelect.innerHTML = '';
        jpVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            // Store the voice object index for easy retrieval later
            option.value = index;
            option.textContent = `${voice.name} ${voice.localService ? '(ローカル)' : ''}`;

            // Try to set a default (often Google or Kyoko depending on OS)
            if (voice.default || voice.name.includes('Kyoko')) {
                option.selected = true;
                selectedVoice = voice;
            }

            voiceSelect.appendChild(option);
        });

        // If no default was found, select the first one
        if (!selectedVoice && jpVoices.length > 0) {
            voiceSelect.options[0].selected = true;
            selectedVoice = jpVoices[0];
        }
    };

    populateVoices();
    // In some browsers, getVoices() needs to wait for the voiceschanged event
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
    }

    voiceSelect.addEventListener('change', (e) => {
        const selectedIndex = e.target.value;
        const jpVoices = availableVoices.filter(voice => voice.lang.includes('ja'));
        selectedVoice = jpVoices[selectedIndex];

        // Preview the selected voice
        if (selectedVoice) {
            speakText("この音声で読み上げます");
        }
    });
}

// Initialize voices on load
initVoices();

function speakText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        // Optional: tweak rate or pitch if needed
        utterance.rate = 1.0;

        window.speechSynthesis.speak(utterance);
    }
}

// --- Test Logic ---

function startTest() {
    currentQuestionIndex = 0;
    correctCount = 0;
    results = [];

    totalQuestionsEl.textContent = questions.length;
    switchView(setupView, testView);
    renderQuestion();
}

function switchView(fromView, toView) {
    fromView.classList.remove('active');
    setTimeout(() => {
        fromView.classList.add('hidden');
        toView.classList.remove('hidden');
        // Small delay to allow display block to take effect before opacity transition
        setTimeout(() => {
            toView.classList.add('active');
        }, 50);
    }, 300); // Wait for fade out transition (var(--transition-normal))
}

function renderQuestion() {
    isAnswered = false;
    selectedChoiceText = null;
    answerBtn.disabled = true;
    answerBtn.textContent = '回答する';
    answerBtn.className = 'primary-btn base-btn'; // Reset classes

    const q = questions[currentQuestionIndex];

    // Update headers
    currentQuestionNumEl.textContent = currentQuestionIndex + 1;
    currentScoreEl.textContent = correctCount;

    // Update progress bar
    const progressPercent = ((currentQuestionIndex) / questions.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    // Set question text (Katakana)
    questionTextEl.textContent = q.katakana;

    // Prepare and shuffle choices
    currentChoices = shuffleArray([q.correct, q.wrong1, q.wrong2, q.wrong3]);

    // Render choice buttons
    choicesContainer.innerHTML = '';

    currentChoices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'base-btn choice-btn';
        btn.textContent = choice;

        // Handle selection and audio
        btn.addEventListener('click', () => {
            if (isAnswered) return;

            // Speak the choice
            speakText(choice);

            // Update UI selection
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            // Update state
            selectedChoiceText = choice;
            answerBtn.disabled = false;
        });

        choicesContainer.appendChild(btn);
    });
}

// Question reading button
readQuestionBtn.addEventListener('click', () => {
    // Read the "Katakana" field as requested by the user
    const q = questions[currentQuestionIndex];
    speakText(q.katakana);
});

questionTextEl.addEventListener('click', () => {
    const q = questions[currentQuestionIndex];
    speakText(q.katakana);
});

// Answer Button Logic
answerBtn.addEventListener('click', () => {
    if (isAnswered || !selectedChoiceText) return;
    isAnswered = true;

    const q = questions[currentQuestionIndex];
    const choiceBtns = document.querySelectorAll('.choice-btn');

    const isCorrect = selectedChoiceText === q.correct;

    if (isCorrect) {
        correctCount++;
        currentScoreEl.textContent = correctCount;
    }

    results.push({
        questionData: q,
        userAnswer: selectedChoiceText,
        isCorrect: isCorrect
    });

    // Add visual feedback classes
    choiceBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === q.correct) {
            btn.classList.add('correct');
            btn.classList.add('show-maru'); // 正解の選択肢に丸印
        } else if (btn.textContent === selectedChoiceText && !isCorrect) {
            btn.classList.add('incorrect');
            btn.classList.add('show-batsu'); // 不正解の選択肢にバツ印
        }
    });

    // Read the correct answer for auditory feedback automatically?
    // Let's not interrupt unless needed, wait, prompt says "正誤が示され、次の問題に進みます"

    // Delay before next question
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            renderQuestion();
        } else {
            showResult();
        }
    }, 1500); // 1.5 seconds delay
});

// --- Result View Logic ---
function showResult() {
    progressBar.style.width = '100%'; // Complete progress bar

    finalScoreCorrectEl.textContent = correctCount;
    finalScoreTotalEl.textContent = questions.length;

    const accuracy = correctCount / questions.length;
    if (accuracy === 1) {
        scoreMessageEl.textContent = '全問正解！完璧です！🎊';
    } else if (accuracy >= 0.8) {
        scoreMessageEl.textContent = '素晴らしい成績です！🌟';
    } else if (accuracy >= 0.5) {
        scoreMessageEl.textContent = 'よくがんばりました！👍';
    } else {
        scoreMessageEl.textContent = '復習して再チャレンジしましょう！💪';
    }

    // Render Review List
    reviewList.innerHTML = '';
    if (results.length === 0) {
        toggleReviewBtn.classList.add('hidden');
    } else {
        toggleReviewBtn.classList.remove('hidden');
        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = `review-item ${result.isCorrect ? 'correct-item' : 'incorrect-item'}`;

            let statusBadge = result.isCorrect
                ? '<span class="status-badge correct-badge">正解</span>'
                : '<span class="status-badge incorrect-badge">不正解</span>';

            item.innerHTML = `
                <div class="target">
                    <span>Q${index + 1}. ${result.questionData.katakana}</span>
                    <span class="kanji">(${result.questionData.kanji})</span>
                    ${statusBadge}
                </div>
                <div class="correct-ans">正解: ${result.questionData.correct}</div>
                ${!result.isCorrect ? `<div class="user-ans">あなたの回答: ${result.userAnswer}</div>` : ''}
            `;
            reviewList.appendChild(item);
        });
    }

    // Ensure review list is hidden initially
    reviewList.classList.add('hidden');
    reviewChevron.textContent = '▼';

    switchView(testView, resultView);
}

toggleReviewBtn.addEventListener('click', () => {
    reviewList.classList.toggle('hidden');
    reviewChevron.textContent = reviewList.classList.contains('hidden') ? '▼' : '▲';
});

retryBtn.addEventListener('click', () => {
    // Reset file input so same file can be triggering change event if needed
    fileInput.value = '';
    switchView(resultView, setupView);
});

// --- Theme Toggle Logic ---
const themeToggleBtn = document.getElementById('theme-toggle');
const moonIcon = document.getElementById('moon-icon');
const sunIcon = document.getElementById('sun-icon');

// Check saved theme or system preference
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

const setTheme = (theme) => {
    document.body.setAttribute('data-theme', theme);
    if (theme === 'dark') {
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
};

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    setTheme('dark');
} else {
    setTheme('light');
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});

