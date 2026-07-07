const defaultImage = "assets/gyaru-robot.png";

const state = {
  mood: "bright",
  timerSeconds: 300,
  timerId: null,
  photoUrl: null,
  music: JSON.parse(localStorage.getItem("galRobotMusic") || "[]"),
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

const companionImage = document.querySelector("#companionImage");
const talkText = document.querySelector("#talkText");
const statusPill = document.querySelector("#statusPill");
const taskInput = document.querySelector("#taskInput");
const timeInput = document.querySelector("#timeInput");
const countdownText = document.querySelector("#countdownText");
const moodGrid = document.querySelector("#moodGrid");
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
  animateBuddy("is-talking");
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

taskInput.addEventListener("change", () => {
  say(`「${taskInput.value || "今日の予定"}」やな。まず一個だけ動かそ。`);
});

timeInput.addEventListener("change", () => {
  updateCountdown();
  say("時間セットできた。うちが残り時間見とくで。");
});

startTimer.addEventListener("click", startSprint);
resetTimer.addEventListener("click", resetSprint);

renderMusic();
renderTimer();
updateCountdown();
window.setInterval(updateCountdown, 30000);
