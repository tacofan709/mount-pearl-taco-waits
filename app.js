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

// ------------------ Submission with Global 6-Hour Cooldown ------------------
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) {
    alert("Please select Drive-thru or Dine-in.");
    return;
  }

  const hours = parseInt(hoursInput.value, 10);
  const minutes = parseInt(minutesInput.value, 10);
  const totalMinutes = hours * 60 + minutes;

  // ONE doc per user for all submissions
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

    // Save new entry
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

// ------------------ Reset Form ------------------
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// ------------------ Fetch Latest Wait Times (Median of Last 10, 90 min) ------------------
async function fetchLatestWaitTimes() {
  try {
    const now = new Date();
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

    // Get all entries in the last 90 minutes, newest first
    const snapshot = await db.collection('waitTimes')
      .where('timestamp', '>=', ninetyMinutesAgo)
      .orderBy('timestamp', 'desc')
      .get();

    let driveTimes = [];
    let dineTimes = [];
    let driveTimestamps = [];
    let dineTimestamps = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;

      if (data.location === 'drive' && driveTimes.length < 10) {
        driveTimes.push(data.minutes);
        driveTimestamps.push(data.timestamp);
      } else if (data.location === 'dine' && dineTimes.length < 10) {
        dineTimes.push(data.minutes);
        dineTimestamps.push(data.timestamp);
      }
    });

    // Median calculation
    const calcMedian = arr => {
      if (!arr.length) return 0;
      const sorted = arr.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
    };

    const medianDrive = calcMedian(driveTimes);
    const medianDine = calcMedian(dineTimes);

    driveTimeEl.textContent = medianDrive ? `${medianDrive} min` : 'No data';
    dineTimeEl.textContent = medianDine ? `${medianDine} min` : 'No data';

    const formatDate = ts =>
      ts ? new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const latestDrive = driveTimestamps[0];
    const latestDine = dineTimestamps[0];

    driveUpdatedEl.textContent = latestDrive ? `Updated: ${formatDate(latestDrive)}` : '';
    dineUpdatedEl.textContent = latestDine ? `Updated: ${formatDate(latestDine)}` : '';

    // Show warning if any times > 120 min
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
