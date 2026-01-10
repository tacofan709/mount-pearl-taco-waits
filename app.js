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

// 🔐 App Check (replace with your real key)
firebase.appCheck().activate(
  "6LcXXXXXXXXXXXXXXX",
  true
);

// =========================
// Firebase services
// =========================
const db = firebase.firestore();
const auth = firebase.auth();

// =========================
// Anonymous Auth
// =========================
auth.signInAnonymously().catch(err => {
  console.error("Auth error:", err);
});

// =========================
// DOM Elements
// =========================
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

let selectedLocation = null;

// =========================
// UI handlers
// =========================
openFormBtn.onclick = () => formSection.classList.remove("hidden");

cancelBtn.onclick = () => {
  formSection.classList.add("hidden");
  resetForm();
};

locationButtons.forEach(btn => {
  btn.onclick = () => {
    locationButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLocation = btn.dataset.type;
  };
});

// =========================
// Submit wait time
// =========================
submitBtn.onclick = async () => {
  if (!auth.currentUser) {
    alert("Please wait a moment and try again.");
    return;
  }

  if (!selectedLocation) {
    alert("Select drive-thru or dine-in.");
    return;
  }

  const hours = Number(hoursInput.value) || 0;
  const mins = Number(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + mins;

  if (totalMinutes <= 0 || totalMinutes > 240) {
    alert("Wait time must be between 1 minute and 4 hours.");
    return;
  }

  const uid = auth.currentUser.uid;
  const lockRef = db.collection("userLocks").doc(uid);

  try {
    // 🔒 Update lock FIRST (enforced by rules)
    await lockRef.set(
      { lastSubmission: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    // 📝 Submit wait time
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

  } catch (err) {
    if (err.code === "permission-denied") {
      alert("You can only submit once every 45 minutes.");
    } else {
      console.error("Submission error:", err);
      alert("Submission failed. Please try again.");
    }
  }
};

// =========================
// Reset form
// =========================
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove("selected"));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// =========================
// Fetch & display wait times
// =========================
async function fetchLatestWaitTimes() {
  const locations = ["drive", "dine"];
  let showWarning = false;

  for (const loc of locations) {
    try {
      const snap = await db.collection("waitTimes")
        .where("location", "==", loc)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      if (snap.empty) {
        setDisplay(loc, "No data yet", "");
        continue;
      }

      let total = 0;
      let latest = null;

      snap.forEach(doc => {
        const d = doc.data();
        total += d.minutes;
        if (d.timestamp) {
          const t = d.timestamp.toDate();
          if (!latest || t > latest) latest = t;
        }
      });

      const avg = Math.round(total / snap.size);
      const h = Math.floor(avg / 60);
      const m = avg % 60;
      const label = h ? `${h}h ${m}m` : `${m}m`;

      if (avg > 120) showWarning = true;

      setDisplay(
        loc,
        label,
        latest
          ? `Updated: ${latest.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : ""
      );

    } catch (err) {
      console.error("Fetch error:", err);
    }
  }

  warningEl.classList.toggle("hidden", !showWarning);
}

function setDisplay(loc, time, updated) {
  if (loc === "drive") {
    driveTimeEl.textContent = time;
    driveUpdatedEl.textContent = updated;
  } else {
    dineTimeEl.textContent = time;
    dineUpdatedEl.textContent = updated;
  }
}

// =========================
// Initial load + refresh
// =========================
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000);
