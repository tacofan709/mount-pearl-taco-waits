// =========================
// Firebase initialization
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyB3ElBHMDJrCRPNW3MeR8YZWKR1HYyCgmo",
  authDomain: "mount-pearl-taco-waits.firebaseapp.com",
  projectId: "mount-pearl-taco-waits",
  storageBucket: "mount-pearl-taco-waits.firebasestorage.app",
  messagingSenderId: "182160934094",
  appId: "1:182160934094:web:a116715546f9364945fc9f"
};

firebase.initializeApp(firebaseConfig);

// App Check (invisible reCAPTCHA)
firebase.appCheck().activate(
  "6LcXXXXXXXXXXXXXXX", // replace with your App Check site key
  true
);

// Firestore + Auth
const db = firebase.firestore();
const auth = firebase.auth();

// -------------------------
// DOM Elements
// -------------------------
const driveTimeEl = document.getElementById("driveTime");
const dineTimeEl = document.getElementById("dineTime");
const driveUpdatedEl = document.getElementById("driveUpdated");
const dineUpdatedEl = document.getElementById("dineUpdated");
const warningEl = document.getElementById("warning");

const openFormBtn = document.getElementById("openFormBtn");
const formSection = document.getElementById("formSection");
const cancelBtn = document.getElementById("cancelBtn");
const submitBtn = document.getElementById("submitBtn");

const locationButtons = document.querySelectorAll(".location-choice button");
const hoursInput = document.getElementById("hours");
const minutesInput = document.getElementById("minutes");

// FAQ modal
const faqBtn = document.getElementById("faqBtn");
const faqModal = document.getElementById("faqModal");
const faqClose = document.getElementById("faqClose");

// Positive message
const msgBtn = document.getElementById("msgBtn");
const msgModal = document.getElementById("msgModal");
const msgClose = document.getElementById("msgClose");
const msgInput = document.getElementById("msgInput");
const msgSubmitBtn = document.getElementById("msgSubmitBtn");

let selectedLocation = null;

// -------------------------
// Anonymous Auth
// -------------------------
auth.signInAnonymously().catch(err => {
  console.error("Auth error:", err);
});

// -------------------------
// UI Handlers
// -------------------------
openFormBtn.onclick = () => formSection.classList.remove("hidden");
cancelBtn.onclick = () => { formSection.classList.add("hidden"); resetForm(); };

// Location selection
locationButtons.forEach(btn => {
  btn.onclick = () => {
    locationButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLocation = btn.dataset.type;
  };
});

// FAQ modal
if(faqBtn && faqModal && faqClose) {
  faqBtn.onclick = () => faqModal.classList.remove("hidden");
  faqClose.onclick = () => faqModal.classList.add("hidden");
}

// Positive message modal
if(msgBtn && msgModal && msgClose && msgSubmitBtn && msgInput) {
  msgBtn.onclick = () => msgModal.classList.remove("hidden");
  msgClose.onclick = () => msgModal.classList.add("hidden");
}

// -------------------------
// Reset form
// -------------------------
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove("selected"));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// -------------------------
// Submit Wait Time
// -------------------------
submitBtn.onclick = async () => {
  if (!auth.currentUser) { alert("Please wait a moment and try again."); return; }
  if (!selectedLocation) { alert("Select drive-thru or dine-in."); return; }

  const hours = Number(hoursInput.value) || 0;
  const mins = Number(minutesInput.value) || 0;

  if (hours < 0 || hours > 4 || mins < 0 || mins > 59) {
    alert("Enter a valid time: 0–4 hours, 0–59 minutes.");
    return;
  }

  const totalMinutes = hours * 60 + mins;
  if (totalMinutes <= 0) { alert("Wait time must be at least 1 minute."); return; }

  if(!isBusinessHours()) { alert("Submissions are only allowed 10:30 AM – 1:15 AM NL time."); return; }

  try {
    const uid = auth.currentUser.uid;
    const lockRef = db.collection("userLocks").doc(uid);
    const lockSnap = await lockRef.get();

    if(lockSnap.exists) {
      const last = lockSnap.data().lastSubmission.toDate();
      const diff = (Date.now() - last.getTime()) / (1000*60*60);
      if(diff < 6) { alert("You can submit only once every 6 hours."); return; }
    }

    // Update lock
    await lockRef.set({ lastSubmission: firebase.firestore.FieldValue.serverTimestamp() });

    // Submit wait time
    await db.collection("waitTimes").add({
      uid,
      location: selectedLocation,
      minutes: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Thanks! Your wait time was submitted.");
    formSection.classList.add("hidden");
    resetForm();
    fetchLatestWaitTimes();

  } catch(err) {
    console.error("Submission error:", err);
    alert("Submission failed. Please try again.");
  }
};

// -------------------------
// Fetch & Display Wait Times
// -------------------------
async function fetchLatestWaitTimes() {
  const locations = ["drive", "dine"];
  let showWarning = false;

  for(const loc of locations){
    try {
      const snap = await db.collection("waitTimes")
        .where("location","==",loc)
        .orderBy("timestamp","desc")
        .limit(10)
        .get();

      if(snap.empty) { setDisplay(loc,"No data yet",""); continue; }

      let total = 0;
      let latest = null;

      snap.forEach(doc => {
        const d = doc.data();
        total += d.minutes;
        if(d.timestamp) {
          const t = d.timestamp.toDate();
          if(!latest || t > latest) latest = t;
        }
      });

      const avg = Math.round(total / snap.size);
      const h = Math.floor(avg / 60);
      const m = avg % 60;
      const label = h ? `${h}h ${m}m` : `${m}m`;

      if(avg >= 120) showWarning = true;

      setDisplay(loc,label,
        latest ? `Updated: ${latest.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : ""
      );

    } catch(err) {
      console.error("Fetch error:", err);
    }
  }

  warningEl.classList.toggle("hidden", !showWarning);
}

function setDisplay(loc,time,updated){
  if(loc==="drive") { driveTimeEl.textContent = time; driveUpdatedEl.textContent = updated; }
  else { dineTimeEl.textContent = time; dineUpdatedEl.textContent = updated; }
}

// -------------------------
// Submit Positive Message
// -------------------------
if(msgSubmitBtn && msgInput) {
  msgSubmitBtn.onclick = async () => {
    const text = msgInput.value.trim();
    if(text.length === 0 || text.length > 200) { alert("Message must be 1–200 characters."); return; }
    if(/https?:\/\//i.test(text) || /[<>$]/.test(text)) { alert("Message contains invalid characters."); return; }

    try {
      await db.collection("messages").add({
        message: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Thanks for your positive message!");
      msgInput.value = "";
      msgModal.classList.add("hidden");
    } catch(err) {
      console.error("Message error:", err);
      alert("Submission failed. Try again.");
    }
  };
}

// -------------------------
// Business Hours Check (NL time)
// -------------------------
function isBusinessHours(){
  const now = new Date();
  // Convert to NL time
  const utc = now.getTime() + now.getTimezoneOffset()*60000;
  const offset = -3.5*60*60000;
  const nltime = new Date(utc + offset);

  const hours = nltime.getHours();
  const minutes = nltime.getMinutes();
  const totalMinutes = hours*60 + minutes;

  // 10:30 AM -> 1:15 AM
  return (totalMinutes >= 10*60+30) || (totalMinutes <= 75);
}

// -------------------------
// Initial Load + Refresh
// -------------------------
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes,60000);
