// ------------------ Firebase Setup ------------------
const firebaseConfig = {
  apiKey: "AIzaSyD1WpNflBgPf-ExN1gCo1y4m7TDjkBoci4",
  authDomain: "mount-pearl-taco-waits-7767e.firebaseapp.com",
  projectId: "mount-pearl-taco-waits-7767e",
  storageBucket: "mount-pearl-taco-waits-7767e.appspot.com",
  messagingSenderId: "146084542686",
  appId: "1:146084542686:web:fd766ca0a465539d152a4f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Anonymous login
auth.signInAnonymously().catch(console.error);

// ------------------ DOM Elements ------------------
const openFormBtn = document.getElementById('openFormBtn');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');
const formSection = document.getElementById('formSection');
const faqBtn = document.getElementById('faqBtn');
const faqContent = document.getElementById('faqContent');

const driveTimeEl = document.getElementById('driveTime');
const dineTimeEl = document.getElementById('dineTime');
const driveUpdatedEl = document.getElementById('driveUpdated');
const dineUpdatedEl = document.getElementById('dineUpdated');

const locationButtons = document.querySelectorAll('.location-choice button');
let selectedLocation = null;

const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const warningEl = document.getElementById('warning');

// ------------------ Helper Functions ------------------
function formatMinutesToHours(minutes) {
  if (!minutes || minutes === 0) return 'No recent reports';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// ------------------ Form & FAQ ------------------
openFormBtn.addEventListener('click', () => {
  formSection.classList.remove('hidden');
  if (faqContent) faqContent.classList.add('hidden');
});

cancelBtn.addEventListener('click', () => {
  formSection.classList.add('hidden');
  resetForm();
});

if (faqBtn && faqContent) {
  faqBtn.addEventListener('click', () => {
    faqContent.classList.toggle('hidden');
    formSection.classList.add('hidden');
  });
}

// ------------------ Location Selection ------------------
locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLocation = btn.dataset.type;
  });
});

// ------------------ Submission with 6-Hour Cooldown ------------------
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) {
    alert("Please select Drive-thru or Dine-in.");
    return;
  }

  // --- Off-hour restriction (Newfoundland Time) ---
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const nlOffset = -3.5; // Newfoundland = UTC-3:30
  const nlTime = new Date(utc + nlOffset * 3600000);
  const hoursNL = nlTime.getHours() + nlTime.getMinutes() / 60;

  // 10.5 = 10:30 AM, 1.25 = 1:15 AM next day
  const isOpen = (hoursNL >= 10.5) || (hoursNL <= 1.25);

  if (!isOpen) {
    alert("Submissions are only accepted between 10:30 AM and 1:15 AM Newfoundland Time.");
    return;
  }

 // --- Validate Inputs ---
const hours = parseInt(hoursInput.value, 10);
const minutes = parseInt(minutesInput.value, 10);

if (isNaN(hours) || isNaN(minutes)) {
  alert("Please enter valid numbers for hours and minutes.");
  return;
}

// Validate individual ranges
if (hours < 0 || hours > 4) {
  alert("Hours must be between 0 and 4.");
  return;
}

if (minutes < 0 || minutes > 59) {
  alert("Minutes must be between 0 and 59.");
  return;
}

const totalMinutes = hours * 60 + minutes;

if (totalMinutes <= 0) {
  alert("Please enter a wait time greater than 0 minutes.");
  return;
}

if (totalMinutes > 299) {
  alert("Please enter a wait time under 5 hours.");
  return;
}

  // --- One doc per user ---
  const docId = auth.currentUser.uid;
  const docRef = db.collection('waitTimes').doc(docId);

  try {
    const docSnap = await docRef.get();
    const now = new Date();

    if (docSnap.exists && docSnap.data().timestamp) {
      const lastTimestamp = docSnap.data().timestamp.toDate();
      const diffMs = now - lastTimestamp;
      const hoursSinceLast = diffMs / (1000 * 60 * 60);

      if (hoursSinceLast < 6) {
        const remaining = Math.ceil(6 - hoursSinceLast);
        alert(`You can only submit once every 6 hours. Please try again in ~${remaining} hour(s).`);
        return;
      }
    }

    await docRef.set({
      location: selectedLocation,
      minutes: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Thank you! Your wait time was submitted.");
    formSection.classList.add('hidden');
    resetForm();
    fetchLatestWaitTimes();

  } catch (err) {
    console.error("❌ Submission failed:", err);
    alert("Submission failed, try again.");
  }
});

// ------------------ Weighted Median Calculation ------------------
function calcWeightedMedian(times, timestamps) {
  if (!times.length) return 0;

  const now = new Date();
  const weights = timestamps.map(ts => {
    const ageMin = (now - ts.toDate()) / 60000;
    // Recent data = more weight; older = less weight
    return Math.max(0.2, 1 - ageMin / 90);
  });

  const combined = times
    .map((t, i) => ({ t, w: weights[i] }))
    .filter(x => typeof x.t === "number" && !isNaN(x.t))
    .sort((a, b) => a.t - b.t);

  const totalWeight = combined.reduce((sum, x) => sum + x.w, 0);
  let cumulative = 0;
  for (const item of combined) {
    cumulative += item.w;
    if (cumulative >= totalWeight / 2) return Math.round(item.t);
  }
  return Math.round(combined[combined.length - 1].t);
}

// ------------------ Fetch Latest Wait Times (Weighted Median of Last 10, 90 min) ------------------
async function fetchLatestWaitTimes() {
  try {
    const now = new Date();
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

    const snapshot = await db.collection('waitTimes')
      .where('timestamp', '>=', ninetyMinutesAgo)
      .orderBy('timestamp', 'desc')
      .get();

    let driveTimes = [], dineTimes = [];
    let driveTimestamps = [], dineTimestamps = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp || typeof data.minutes !== "number" || isNaN(data.minutes)) return;

      if (data.location === 'drive' && driveTimes.length < 10) {
        driveTimes.push(data.minutes);
        driveTimestamps.push(data.timestamp);
      } else if (data.location === 'dine' && dineTimes.length < 10) {
        dineTimes.push(data.minutes);
        dineTimestamps.push(data.timestamp);
      }
    });

    const medianDrive = calcWeightedMedian(driveTimes, driveTimestamps);
    const medianDine = calcWeightedMedian(dineTimes, dineTimestamps);

    driveTimeEl.textContent = formatMinutesToHours(medianDrive);
    dineTimeEl.textContent = formatMinutesToHours(medianDine);

    const formatDate = ts =>
      ts ? new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const latestDrive = driveTimestamps[0];
    const latestDine = dineTimestamps[0];

    driveUpdatedEl.textContent = latestDrive ? `Updated: ${formatDate(latestDrive)}` : '';
    dineUpdatedEl.textContent = latestDine ? `Updated: ${formatDate(latestDine)}` : '';

    // Show warning if any wait time > 120 minutes
    const allTimes = [...driveTimes, ...dineTimes];
    if (allTimes.length && Math.max(...allTimes) > 120) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }

  } catch (err) {
    console.error("❌ Fetch failed:", err);
    driveTimeEl.textContent = 'Error';
    dineTimeEl.textContent = 'Error';
  }
}

// ------------------ Initial Fetch & Auto-Refresh ------------------
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000);
