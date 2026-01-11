// ------------------ Firebase Setup ------------------
const firebaseConfig = {
  apiKey: "AIzaSyD1WpNflBgPf-ExN1gCo1y4m7TDjkBoci4",
  authDomain: "mount-pearl-taco-waits-7767e.firebaseapp.com",
  projectId: "mount-pearl-taco-waits-7767e",
  storageBucket: "mount-pearl-taco-waits-7767e.appspot.com", // ✅ fixed ".app" -> ".appspot.com"
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

// ------------------ Submission ------------------
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) {
    alert("Please select Drive-thru or Dine-in.");
    return;
  }

  const hours = parseInt(hoursInput.value, 10);
  const minutes = parseInt(minutesInput.value, 10);
  const totalMinutes = hours * 60 + minutes;

  const docRef = db.collection('waitTimes').doc(auth.currentUser.uid);
  const now = new Date();

  // Save flat data
  const updateData = {
    location: selectedLocation,
    minutes: totalMinutes,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await docRef.set(updateData);
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

// ------------------ Fetch Latest Wait Times ------------------
async function fetchLatestWaitTimes() {
  try {
    const snapshot = await db.collection('waitTimes').get();

    let driveTimes = [];
    let dineTimes = [];
    let driveTimestamps = [];
    let dineTimestamps = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.location === 'drive') {
        driveTimes.push(data.minutes);
        if (data.timestamp) driveTimestamps.push(data.timestamp);
      }
      if (data.location === 'dine') {
        dineTimes.push(data.minutes);
        if (data.timestamp) dineTimestamps.push(data.timestamp);
      }
    });

    const calcAvg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const avgDrive = calcAvg(driveTimes);
    const avgDine = calcAvg(dineTimes);

    driveTimeEl.textContent = avgDrive ? `${avgDrive} min` : 'No data';
    dineTimeEl.textContent = avgDine ? `${avgDine} min` : 'No data';

    const latestDrive = driveTimestamps.sort((a, b) => b.seconds - a.seconds)[0];
    const latestDine = dineTimestamps.sort((a, b) => b.seconds - a.seconds)[0];

    const formatDate = ts =>
      ts ? new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    driveUpdatedEl.textContent = latestDrive ? `Updated: ${formatDate(latestDrive)}` : '';
    dineUpdatedEl.textContent = latestDine ? `Updated: ${formatDate(latestDine)}` : '';

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

// ------------------ Initial Fetch ------------------
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000); // refresh every minute
