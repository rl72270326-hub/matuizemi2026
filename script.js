const defaultImage = "assets/gyaru-robot.png";

const state = {
  mood: "bright",
  timerSeconds: 300,
  timerId: null,
  photoUrl: null,
  music: JSON.parse(localStorage.getItem("galRobotMusic") || "[]"),
  voiceEnabled: JSON.parse(localStorage.getItem("galRobotVoiceEnabled") || "true"),
  conversationMode: false,
  recognizing: false,
  lastRecognitionError: "",
};

const moodLines = {
  bright: [
    "今日のノリいいやん。まず一個だけ片付けよ。",
    "今いける日やで。未来の自分めっちゃ助かるやつ。",
  ],
  sleepy: [
    "眠い日は小さくてOK。まず立つだけいこ。",
    "寝起きモードでも勝てる。水飲んで、5分だけやろ。",
  ],
  panic: [
    "焦ってる時こそ順番決めよ。今は一番大事な一個だけ。",
    "大丈夫、全部じゃなくて最初の一歩だけでいいで。",
  ],
  low: [
    "しんどい日も来てえらい。今日は60点で勝ちにしよ。",
    "うち横におるから、ゆっくりでいい。まず目の前だけ見よ。",
  ],
  oshi: [
    "推しに見られてるモード入ったで。今の一歩、普通にかっこいい。",
    "そのビジュなら準備したら優勝やん。軽く整えてこ。",
  ],
};

const eventLines = {
  before: "そろそろ準備しよ。服、持ち物、出る時間だけ決めたら勝ち。",
  drift: "脱線しても戻ってきたら勝ちやで。うちと5分だけ勝負しよ。",
  start: "え、ちゃんと始めたやん。天才すぎん？そのまま一個終わらせよ。",
  race: "5分勝負スタート。完璧いらん、手を動かしたら勝ち。",
  go: "やば、間に合いそうやん。そのままGO。忘れ物だけ一回見よ。",
};

const musicDefaults = [
  "平成ギャルっぽい元気曲",
  "朝に強いアップテンポ",
  "推しを思い出す曲",
  "焦りすぎない作業BGM",
];

const RecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = RecognitionApi ? new RecognitionApi() : null;

const companionImage = document.querySelector("#companionImage");
const talkText = document.querySelector("#talkText");
const statusPill = document.querySelector("#statusPill");
const taskInput = document.querySelector("#taskInput");
const timeInput = document.querySelector("#timeInput");
const countdownText = document.querySelector("#countdownText");
const moodGrid = document.querySelector("#moodGrid");
const voiceStatus = document.querySelector("#voiceStatus");
const listenButton = document.querySelector("#listenButton");
const conversationToggle = document.querySelector("#conversationToggle");
const voiceToggle = document.querySelector("#voiceToggle");
const conversationLog = document.querySelector("#conversationLog");
const chatInput = document.querySelector("#chatInput");
const sendChat = document.querySelector("#sendChat");
const buddyName = document.querySelector("#buddyName");
const photoInput = document.querySelector("#photoInput");
const resetPhoto = document.querySelector("#resetPhoto");
const musicInput = document.querySelector("#musicInput");
const addMusic = document.querySelector("#addMusic");
const musicPick = document.querySelector("#musicPick");
const musicList = document.querySelector("#musicList");
const timerFace = document.querySelector("#timerFace");
const startTimer = document.querySelector("#startTimer");
const resetTimer = document.querySelector("#resetTimer");

function buddy() {
  return buddyName.value.trim() || "ギャルロボ";
}

function say(line) {
  talkText.textContent = `${buddy()}「${line}」`;
  appendMessage("robot", line);
  animateBuddy("is-talking");
  speak(line);
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function animateBuddy(className, duration = 820) {
  if (!companionImage) return;
  companionImage.classList.remove(className);
  void companionImage.offsetWidth;
  companionImage.classList.add(className);
  window.setTimeout(() => {
    if (className !== "is-sprinting") {
      companionImage.classList.remove(className);
    }
  }, duration);
}

function speak(line) {
  if (!state.voiceEnabled || !("speechSynthesis" in window)) {
    if (state.conversationMode) queueNextListen(900);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.lang = "ja-JP";
  utterance.rate = 1.08;
  utterance.pitch = 1.22;
  utterance.onend = () => {
    if (state.conversationMode) queueNextListen(450);
  };

  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find((voice) => voice.lang && voice.lang.startsWith("ja"));
  if (japaneseVoice) utterance.voice = japaneseVoice;

  window.speechSynthesis.speak(utterance);
}

function updateVoiceUi() {
  voiceToggle.textContent = state.voiceEnabled ? "声ON" : "声OFF";
  conversationToggle.textContent = state.conversationMode ? "会話モードON" : "会話モードOFF";
  conversationToggle.classList.toggle("active-mode", state.conversationMode);
  voiceStatus.textContent = recognition ? "声：待機中" : "声：文字入力のみ";
}

function appendMessage(role, text) {
  if (!conversationLog || !text) return;
  const row = document.createElement("div");
  row.className = `message-row ${role}`;
  const label = role === "user" ? "あなた" : buddy();
  row.innerHTML = `<span>${label}</span><p></p>`;
  row.querySelector("p").textContent = text;
  conversationLog.appendChild(row);

  while (conversationLog.children.length > 8) {
    conversationLog.removeChild(conversationLog.firstElementChild);
  }
  conversationLog.scrollTop = conversationLog.scrollHeight;
}

function queueNextListen(delay = 600) {
  if (!state.conversationMode || state.recognizing) return;
  window.setTimeout(() => {
    if (state.conversationMode && !state.recognizing) startListening();
  }, delay);
}

function makeReply(input) {
  const text = input.trim();
  if (!text) return "今なんて言おうとした？一言だけでも聞くで。";
  if (text.includes("眠") || text.includes("寝")) {
    return "眠いのに話してくれたんえらい。まず立つだけ、一緒にやろ。";
  }
  if (text.includes("やる気") || text.includes("無理") || text.includes("しんど")) {
    return "今日は気合い満タンじゃなくていいで。5分だけ動けたら勝ちにしよ。";
  }
  if (text.includes("遅") || text.includes("間に合")) {
    return "焦る時こそ一個ずつ。今は持ち物、服、出る時間だけ見よ。";
  }
  if (text.includes("スマホ") || text.includes("TikTok") || text.includes("SNS")) {
    return "戻ってきたのがもう勝ちやん。スマホ置いて、5分だけうちと勝負しよ。";
  }
  if (text.includes("課題") || text.includes("勉強") || text.includes("レポート")) {
    return "課題モード入ろ。まずタイトルか一行だけ書いたら、だいぶ進んだ扱いでOK。";
  }
  if (text.includes("不安") || text.includes("怖") || text.includes("心配")) {
    return "不安ある中で動こうとしてるの強いで。全部じゃなくて、次の一手だけ決めよ。";
  }
  if (text.includes("推し") || text.includes("かわい") || text.includes("写真")) {
    return "推しパワー入ったな。今の自分ちょっと盛れてるから、その勢いでいこ。";
  }
  if (text.includes("音楽") || text.includes("曲")) {
    updateMusicPick();
    return `今日は「${musicPick.textContent}」の気分ちゃう？流して準備しよ。`;
  }
  return "話してくれてありがと。じゃあ今から一番小さい一歩だけやろ。うち見てるで。";
}

function handleChat(input) {
  appendMessage("user", input.trim());
  const reply = makeReply(input);
  say(reply);
  chatInput.value = "";
  voiceStatus.textContent = "声：返事したで";
  if (state.conversationMode && !state.voiceEnabled) queueNextListen(900);
}

function startListening() {
  if (!recognition) {
    voiceStatus.textContent = "声：このブラウザは音声入力に未対応";
    say("文字でも話せるで。下の入力欄に今の気持ち入れてみて。");
    return;
  }

  if (state.recognizing) return;
  state.recognizing = true;
  state.lastRecognitionError = "";
  voiceStatus.textContent = state.conversationMode ? "声：会話モードで聞いてる" : "声：聞いてる";
  listenButton.textContent = "聞いてる";
  try {
    recognition.start();
  } catch {
    state.recognizing = false;
    listenButton.textContent = "話す";
    voiceStatus.textContent = "声：もう一回押してね";
  }
}

function stopListening() {
  if (!recognition || !state.recognizing) return;
  try {
    recognition.stop();
  } catch {
  }
  state.recognizing = false;
  listenButton.textContent = "話す";
}

function updateMood(mood) {
  state.mood = mood;
  document.querySelectorAll("#moodGrid button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === mood);
  });
  say(pick(moodLines[mood]));
  updateMusicPick();
}

function updateMusicPick() {
  const pool = state.music.length ? state.music : musicDefaults;
  const moodHint = state.mood === "sleepy" ? "ゆるめに " : state.mood === "panic" ? "落ち着く " : "";
  musicPick.textContent = `${moodHint}${pick(pool)}`;
}

function renderMusic() {
  musicList.innerHTML = "";
  state.music.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    musicList.appendChild(li);
  });
  localStorage.setItem("galRobotMusic", JSON.stringify(state.music));
  updateMusicPick();
}

function addMusicItem() {
  const value = musicInput.value.trim();
  if (!value) return;
  state.music = [value, ...state.music.filter((item) => item !== value)].slice(0, 8);
  musicInput.value = "";
  renderMusic();
  say(`それ好きなん覚えとく。今日は「${value}」の気分でいこ。`);
}

function updateCountdown() {
  if (!timeInput.value) {
    countdownText.textContent = "時間を入れてね";
    statusPill.textContent = "待機中";
    return;
  }

  const now = new Date();
  const [hour, minute] = timeInput.value.split(":").map(Number);
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  let diffMinutes = Math.ceil((target - now) / 60000);
  if (diffMinutes < -720) {
    target.setDate(target.getDate() + 1);
    diffMinutes = Math.ceil((target - now) / 60000);
  }

  if (diffMinutes < 0) {
    countdownText.textContent = `${Math.abs(diffMinutes)}分すぎた`;
    statusPill.textContent = "急ご";
    return;
  }

  countdownText.textContent = `${diffMinutes}分`;
  statusPill.textContent = diffMinutes <= 5 ? "出発前" : diffMinutes <= 30 ? "準備タイム" : "見守り中";
}

function formatTime(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function renderTimer() {
  timerFace.textContent = formatTime(state.timerSeconds);
}

function startSprint() {
  if (state.timerId) return;
  say(eventLines.race);
  startTimer.textContent = "進行中";
  companionImage.classList.add("is-sprinting");
  timerFace.classList.add("is-running");
  state.timerId = window.setInterval(() => {
    state.timerSeconds -= 1;
    renderTimer();
    if (state.timerSeconds <= 0) {
      window.clearInterval(state.timerId);
      state.timerId = null;
      startTimer.textContent = "開始";
      state.timerSeconds = 300;
      companionImage.classList.remove("is-sprinting");
      timerFace.classList.remove("is-running");
      say("5分やり切ったやん。今の自分、かなり強いで。");
      renderTimer();
    }
  }, 1000);
}

function resetSprint() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  state.timerSeconds = 300;
  startTimer.textContent = "開始";
  companionImage.classList.remove("is-sprinting");
  timerFace.classList.remove("is-running");
  renderTimer();
}

document.querySelectorAll("[data-event]").forEach((button) => {
  button.addEventListener("click", () => {
    const event = button.dataset.event;
    say(eventLines[event]);
    if (event === "race") startSprint();
    if (event === "drift") {
      statusPill.textContent = "復帰中";
      animateBuddy("is-alert", 1200);
    }
    if (event === "start") statusPill.textContent = "作業中";
    if (event === "go") statusPill.textContent = "出発前";
  });
});

moodGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-mood]");
  if (button) updateMood(button.dataset.mood);
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = URL.createObjectURL(file);
  companionImage.src = state.photoUrl;
  companionImage.alt = "選んだ相棒の写真";
  say("相棒チェンジ完了。見守り力、上がったんちゃう？");
});

resetPhoto.addEventListener("click", () => {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = null;
  companionImage.src = defaultImage;
  companionImage.alt = "ギャル系AIロボット";
  say("ロボに戻ったで。今日も横で応援するわ。");
});

buddyName.addEventListener("change", () => {
  say("呼び名アップデートしたで。うちらで今日進めよ。");
});

addMusic.addEventListener("click", addMusicItem);
musicInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addMusicItem();
});

voiceToggle.addEventListener("click", () => {
  state.voiceEnabled = !state.voiceEnabled;
  localStorage.setItem("galRobotVoiceEnabled", JSON.stringify(state.voiceEnabled));
  if (!state.voiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  updateVoiceUi();
  if (state.voiceEnabled) say("声オンにしたで。ちゃんと声でも応援するわ。");
});

listenButton.addEventListener("click", startListening);
conversationToggle.addEventListener("click", () => {
  state.conversationMode = !state.conversationMode;
  updateVoiceUi();
  if (state.conversationMode) {
    say("会話モード入れたで。話しかけてくれたら、うちも返すわ。");
  } else {
    stopListening();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    voiceStatus.textContent = "声：会話モードOFF";
  }
});
sendChat.addEventListener("click", () => handleChat(chatInput.value));
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleChat(chatInput.value);
});

taskInput.addEventListener("change", () => {
  say(`「${taskInput.value || "今日の予定"}」やな。まず一個だけ動かそ。`);
});

timeInput.addEventListener("change", () => {
  updateCountdown();
  say("時間セットできた。うちが残り時間見とくで。");
});

startTimer.addEventListener("click", startSprint);
resetTimer.addEventListener("click", resetSprint);

if (recognition) {
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    voiceStatus.textContent = `声：${transcript}`;
    handleChat(transcript);
  });

  recognition.addEventListener("end", () => {
    state.recognizing = false;
    listenButton.textContent = "話す";
    if (voiceStatus.textContent === "声：聞いてる") {
      voiceStatus.textContent = "声：待機中";
    }
    if (state.conversationMode && state.lastRecognitionError === "no-speech") {
      voiceStatus.textContent = "声：もう一回聞くで";
      queueNextListen(900);
    }
  });

  recognition.addEventListener("error", (event) => {
    state.lastRecognitionError = event.error || "error";
    state.recognizing = false;
    listenButton.textContent = "話す";
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.conversationMode = false;
      updateVoiceUi();
      voiceStatus.textContent = "声：マイク許可が必要";
      return;
    }
    voiceStatus.textContent = event.error === "no-speech" ? "声：聞こえへんかった" : "声：文字入力で試してね";
  });
}

renderMusic();
renderTimer();
updateCountdown();
updateVoiceUi();
window.setInterval(updateCountdown, 30000);
