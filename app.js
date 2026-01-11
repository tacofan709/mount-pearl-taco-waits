// =========================
// Firebase Initialization
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyB3ElBHMDJrCRPNW3MeR8YZWKR1HYyCgmo",
  authDomain: "mount-pearl-taco-waits.firebaseapp.com",
  projectId: "mount-pearl-taco-waits",
  storageBucket: "mount-pearl-taco-waits.appspot.com",
  messagingSenderId: "182160934094",
  appId: "1:182160934094:web:a116715546f9364945fc9f"
};

firebase.initializeApp(firebaseConfig);

// 🔐 App Check (reCAPTCHA)
firebase.appCheck().activate(
  "6LcoyEYsAAAAAPAzUbsNpCuS_KlCBdMqgYhKOyGb",
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
// UI Handlers
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
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const openMinutes = 10 * 60 + 30; // 10:30 AM
  const closeMinutes = 25 * 60 + 15; // 1:15 AM next day = 25:15

  // For totalMinutes > 24h, adjust by adding 24h for times after midnight
  let adjustedMinutes = totalMinutes;
  if (totalMinutes < openMinutes) adjustedMinutes += 24 * 60;

  return adjustedMinutes >= openMinutes && adjustedMinutes <= closeMinutes;
}

// =========================
// Submit Wait Time
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
  const minutes = Number(minutesInput.value) || 0;

  if (hours < 0 || hours > 4 || minutes < 0 || minutes > 59) {
    alert("Hours must be 0–4 and minutes 0–59.");
    return;
  }

  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes <= 0) {
    alert("Wait time must be at least 1 minute.");
    return;
  }

  if (!isWithinBusinessHours()) {
    alert("Submissions can only be made during business hours: 10:30 AM – 1:15 AM.");
    return;
  }

  const uid = auth.currentUser.uid;
  const lockRef = db.collection("userLocks").doc(uid);

  try {
    const lockDoc = await lockRef.get();
    if (lockDoc.exists) {
      const lastSubmission = lockDoc.data().lastSubmission.toDate();
      const diffMs = new Date() - lastSubmission;
      const diffHours = diffMs / 1000 / 60 / 60;

      if (diffHours < 6) {
        alert(`You can submit only once every 6 hours. Try again in ${Math.ceil(6 - diffHours)} hour(s).`);
        return;
      }
    }

    // Update user lock
    await lockRef.set({
      lastSubmission: firebase.firestore.FieldValue.serverTimestamp()
    });

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

  } catch (err) {
    console.error("Submission error:", err);
    alert("Submission failed. Please try again.");
  }
};

// =========================
// Fetch Latest Wait Times
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
        const data = doc.data();
        total += data.minutes;
        if (data.timestamp) {
          const t = data.timestamp.toDate();
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
auth.onAuthStateChanged(user => {
  if (user) fetchLatestWaitTimes();
});

setInterval(fetchLatestWaitTimes, 60000); // refresh every minute
