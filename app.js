// ---------- Firebase Setup ----------
const firebaseConfig = {
  apiKey: "AIzaSyD1WpNflBgPf-ExN1gCo1y4m7TDjkBoci4",
  authDomain: "mount-pearl-taco-waits-7767e.firebaseapp.com",
  projectId: "mount-pearl-taco-waits-7767e",
  storageBucket: "mount-pearl-taco-waits-7767e.firebasestorage.app",
  messagingSenderId: "146084542686",
  appId: "1:146084542686:web:fd766ca0a465539d152a4f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ---------- Elements ----------
const driveTimeEl = document.getElementById("driveTime");
const dineTimeEl = document.getElementById("dineTime");
const driveUpdatedEl = document.getElementById("driveUpdated");
const dineUpdatedEl = document.getElementById("dineUpdated");

const openFormBtn = document.getElementById("openFormBtn");
const formSection = document.getElementById("formSection");
const cancelBtn = document.getElementById("cancelBtn");
const submitBtn = document.getElementById("submitBtn");

const locationButtons = document.querySelectorAll(".location-choice button");
let selectedLocation = null;

const hoursInput = document.getElementById("hours");
const minutesInput = document.getElementById("minutes");

const warningEl = document.getElementById("warning");

// ---------- Auth (Anonymous) ----------
auth.signInAnonymously().catch((err) => {
  console.error("Auth error:", err);
});

// ---------- Fetch Wait Times ----------
async function fetchWaitTimes() {
  try {
    const snapshot = await db.collection("waitTimes").get();
    let drive = null;
    let dine = null;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "drive") drive = data;
      if (data.type === "dine") dine = data;
    });

    if (drive) {
      driveTimeEl.textContent = `${drive.hours}h ${drive.minutes}m`;
      driveUpdatedEl.textContent = `Updated: ${new Date(drive.timestamp?.seconds * 1000).toLocaleTimeString()}`;
      if (drive.hours >= 2) warningEl.classList.remove("hidden");
    }

    if (dine) {
      dineTimeEl.textContent = `${dine.hours}h ${dine.minutes}m`;
      dineUpdatedEl.textContent = `Updated: ${new Date(dine.timestamp?.seconds * 1000).toLocaleTimeString()}`;
      if (dine.hours >= 2) warningEl.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

// Initial fetch
fetchWaitTimes();
// Refresh every 60 seconds
setInterval(fetchWaitTimes, 60000);

// ---------- Form Handling ----------
openFormBtn.addEventListener("click", () => {
  formSection.classList.remove("hidden");
});

cancelBtn.addEventListener("click", () => {
  formSection.classList.add("hidden");
  resetForm();
});

// Location buttons
locationButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    locationButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLocation = btn.dataset.type;
  });
});

function resetForm() {
  locationButtons.forEach((b) => b.classList.remove("selected"));
  selectedLocation = null;
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// ---------- Submission Lock ----------
const LOCK_HOURS = 6;

function canSubmit(lastTimestamp) {
  if (!lastTimestamp) return true;
  const now = Date.now();
  return now - lastTimestamp >= LOCK_HOURS * 60 * 60 * 1000;
}

// ---------- Submit Data ----------
submitBtn.addEventListener("click", async () => {
  if (!selectedLocation) {
    alert("Please select a location!");
    return;
  }

  const hours = parseInt(hoursInput.value);
  const minutes = parseInt(minutesInput.value);

  if (isNaN(hours) || isNaN(minutes)) {
    alert("Please enter a valid time!");
    return;
  }

  try {
    const uid = auth.currentUser.uid;
    const lastSubmission = localStorage.getItem(`lastSubmission_${selectedLocation}`);
    if (!canSubmit(lastSubmission)) {
      alert(`You must wait ${LOCK_HOURS} hours between submissions for this location.`);
      return;
    }

    const docRef = db.collection("waitTimes").doc(selectedLocation);
    await docRef.set({
      type: selectedLocation,
      hours,
      minutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.setItem(`lastSubmission_${selectedLocation}`, Date.now());
    formSection.classList.add("hidden");
    resetForm();
    fetchWaitTimes();
  } catch (err) {
    console.error("Submission error:", err);
    alert("Submission failed. Please try again.");
  }
});
