// =========================
// Firebase Initialization
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyCrdBiON0lPk3bgA-fH0AU0hSjzWiXmncI",
  authDomain: "mount-pear-taco-waits.firebaseapp.com",
  projectId: "mount-pear-taco-waits",
  storageBucket: "mount-pear-taco-waits.firebasestorage.app",
  messagingSenderId: "298827823692",
  appId: "1:298827823692:web:85b95c19d1d3ec8b3092e9"
};

firebase.initializeApp(firebaseConfig);

// 🔐 App Check (replace with your site key)
firebase.appCheck().activate(
  "6LcoyEYsAAAAAPAzUbsNpCuS_KlCBdMqgYhKOyGb",
  true // auto-refresh
);

window.addEventListener("load", () => {
  firebase.appCheck().activate('YOUR_RECAPTCHA_SITE_KEY', true);
});

// =========================
// Firebase Services
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

const openFaqBtn = document.getElementById("openFaqBtn");
const faqModal = document.getElementById("faqModal");
const closeFaqBtn = document.getElementById("closeFaqBtn");

let selectedLocation = null;

// =========================
// UI Handlers
// =========================
openFormBtn.onclick = () => formSection.classList.remove("hidden");
cancelBtn.onclick = () => { formSection.classList.add("hidden"); resetForm(); };

locationButtons.forEach(btn => {
  btn.onclick = () => {
    locationButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLocation = btn.dataset.type;
  };
});

openFaqBtn.onclick = () => faqModal.classList.remove("hidden");
closeFaqBtn.onclick = () => faqModal.classList.add("hidden");

// =========================
// Reset Form
// =========================
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove("selected"));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// =========================
// Business Hours Check
// =========================
function isWithinBusinessHours() {
  const now = new Date();

  // Newfoundland time offset: UTC-3:30
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const nstOffset = -3.5 * 60; // in minutes
  const nst = new Date(utc + nstOffset * 60000);

  const hours = nst.getHours();
  const minutes = nst.getMinutes();

  // Business hours: 10:30 → 1:15 (next day)
  const start = 10 * 60 + 30;
  const end = 25 * 60 + 15; // 1:15 AM next day as 25:15
  const current = hours * 60 + minutes + (hours < 2 ? 24 * 60 : 0);

  return current >= start && current <= end;
}

// =========================
// Submit Wait Time
// =========================
submitBtn.onclick = async () => {
  if (!auth.currentUser) {
    alert("Please wait a moment and try again.");
    return;
  }

  if (!isWithinBusinessHours()) {
    alert("Submissions are only accepted during business hours (10:30 AM → 1:15 AM NL).");
    return;
  }

  if (!selectedLocation) {
    alert("Select Drive-thru or Dine-in.");
    return;
  }

  const hours = Number(hoursInput.value) || 0;
  const mins = Number(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + mins;

  if (totalMinutes <= 0 || totalMinutes > 299) { // 4h59m = 299 min
    alert("Wait time must be between 1 minute and 4 hours 59 minutes.");
    return;
  }

  const uid = auth.currentUser.uid;
  const lockRef = db.collection("userLocks").doc(uid);

  try {
    // 🔒 Check last submission
    const lockDoc = await lockRef.get();
    const now = new Date();

    if (lockDoc.exists && lockDoc.data().lastSubmission) {
      const last = lockDoc.data().lastSubmission.toDate();
      const diffMs = now - last;
      const diffHours = diffMs / 1000 / 60 / 60;

      if (diffHours < 6) {
        alert(`You can only submit once every 6 hours. Try again in ${Math.ceil(6 - diffHours)} hour(s).`);
        return;
      }
    }

    // 🔒 Update lock
    await lockRef.set({
      lastSubmission: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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
    console.error("Submission error:", err);
    alert("Submission failed. Please try again.");
  }
};

// =========================
// Fetch & Display Wait Times
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
// Initial Load + Refresh
// =========================
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000); // refresh every 60 sec
