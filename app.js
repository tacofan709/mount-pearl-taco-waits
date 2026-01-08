// -------------------------
// Firebase setup (compat)
// -------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB3ElBHMDJrCRPNW3MeR8YZWKR1HYyCgmo",
  authDomain: "mount-pearl-taco-waits.firebaseapp.com",
  projectId: "mount-pearl-taco-waits",
  storageBucket: "mount-pearl-taco-waits.firebasestorage.app",
  messagingSenderId: "182160934094",
  appId: "1:182160934094:web:a116715546f9364945fc9f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
let selectedLocation = null;

const hoursInput = document.getElementById("hours");
const minutesInput = document.getElementById("minutes");

// -------------------------
// Show / hide form
// -------------------------
openFormBtn.addEventListener("click", () => formSection.classList.remove("hidden"));
cancelBtn.addEventListener("click", () => {
  formSection.classList.add("hidden");
  resetForm();
});

// -------------------------
// Select location (drive / dine)
// -------------------------
locationButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    locationButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedLocation = btn.getAttribute("data-type");
  });
});

// -------------------------
// Submit wait time
// -------------------------
submitBtn.addEventListener("click", async () => {
  if (!selectedLocation) {
    alert("Please select a location first.");
    return;
  }

  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  let totalMinutes = hours * 60 + minutes;

  if (totalMinutes <= 0) {
    alert("Please enter a valid wait time.");
    return;
  }

  if (totalMinutes > 240) {
    alert("Maximum wait time is 4 hours.");
    return;
  }

  // 45-minute cooldown per location
  const lastSubmit = localStorage.getItem(`lastSubmit_${selectedLocation}`);
  const now = Date.now();
  if (lastSubmit && now - lastSubmit < 45 * 60 * 1000) {
    const minsLeft = Math.ceil((45 * 60 * 1000 - (now - lastSubmit)) / 60000);
    alert(`Please wait ${minsLeft} more minutes before submitting again.`);
    return;
  }

  try {
    await db.collection("waitTimes").add({
      location: selectedLocation,
      minutes: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.setItem(`lastSubmit_${selectedLocation}`, now);

    alert("Thanks! Your wait time has been submitted.");
    formSection.classList.add("hidden");
    resetForm();
    fetchLatestWaitTimes();
  } catch (error) {
    console.error("Error submitting wait time:", error);
    alert("Oops! Something went wrong. Please try again.");
  }
});

// -------------------------
// Reset form inputs
// -------------------------
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove("selected"));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// -------------------------
// Fetch latest average wait times safely
// -------------------------
async function fetchLatestWaitTimes() {
  try {
    const locations = ["drive", "dine"];
    let showWarning = false;

    for (const loc of locations) {
      const snapshot = await db.collection("waitTimes")
        .where("location", "==", loc)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      if (!snapshot.empty) {
        let totalMinutes = 0;
        let latestTimestamp = null;

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          totalMinutes += data.minutes;
          if (data.timestamp) { // ✅ Only if timestamp exists
            const tsDate = data.timestamp.toDate();
            if (!latestTimestamp || tsDate > latestTimestamp) {
              latestTimestamp = tsDate;
            }
          }
        });

        const avgMinutes = Math.round(totalMinutes / snapshot.size);
        const h = Math.floor(avgMinutes / 60);
        const m = avgMinutes % 60;
        const timeString = h > 0 ? `${h}h ${m}m` : `${m}m`;

        if (loc === "drive") {
          driveTimeEl.textContent = timeString;
          driveUpdatedEl.textContent = latestTimestamp ? `Updated: ${latestTimestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : "";
        } else {
          dineTimeEl.textContent = timeString;
          dineUpdatedEl.textContent = latestTimestamp ? `Updated: ${latestTimestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : "";
        }

        if (avgMinutes > 120) showWarning = true;
      } else {
        // No data yet
        if (loc === "drive") {
          driveTimeEl.textContent = "No data yet";
          driveUpdatedEl.textContent = "";
        } else {
          dineTimeEl.textContent = "No data yet";
          dineUpdatedEl.textContent = "";
        }
      }
    }

    if (showWarning) {
      warningEl.classList.remove("hidden");
    } else {
      warningEl.classList.add("hidden");
    }

  } catch (error) {
    console.error("Error fetching wait times:", error);
  }
}

// -------------------------
// Initial fetch + auto-refresh
// -------------------------
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000);
