// ------------------ Firebase Setup ------------------
const firebaseConfig = {
  apiKey: "AIzaSyD1WpNflBgPf-ExN1gCo1y4m7TDjkBoci4",
  authDomain: "mount-pearl-taco-waits-7767e.firebaseapp.com",
  projectId: "mount-pearl-taco-waits-7767e",
  storageBucket: "mount-pearl-taco-waits-7767e.firebasestorage.app",
  messagingSenderId: "146084542686",
  appId: "1:146084542686:web:fd766ca0a465539d152a4f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ------------------ DOM Elements ------------------
const openFormBtn = document.getElementById('openFormBtn');
const formSection = document.getElementById('formSection');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');

const locationButtons = document.querySelectorAll('.location-choice button');
let selectedLocation = null;

const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');

const driveTimeEl = document.getElementById('driveTime');
const dineTimeEl = document.getElementById('dineTime');
const driveUpdatedEl = document.getElementById('driveUpdated');
const dineUpdatedEl = document.getElementById('dineUpdated');

const warningEl = document.getElementById('warning');

const faqBtn = document.getElementById('faqBtn');
const faqContent = document.getElementById('faqContent');

// ------------------ Event Listeners ------------------

// Open form
openFormBtn.addEventListener('click', () => {
  formSection.classList.remove('hidden');
});

// Cancel form
cancelBtn.addEventListener('click', () => {
  formSection.classList.add('hidden');
  resetForm();
});

// Select location
locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLocation = btn.dataset.type;
  });
});

// Toggle FAQ
faqBtn.addEventListener('click', () => {
  faqContent.classList.toggle('hidden');
});

// Submit form
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) {
    alert('Please select a location.');
    return;
  }

  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes === 0) {
    alert('Please enter a wait time.');
    return;
  }

  try {
    await db.collection('waitTimes').add({
      location: selectedLocation,
      minutes: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('Thank you! Your wait time has been submitted.');
    formSection.classList.add('hidden');
    resetForm();
    fetchLatestWaitTimes();
  } catch (err) {
    console.error(err);
    alert('Submission failed. Please try again.');
  }
});

// ------------------ Functions ------------------
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// Fetch latest wait times
async function fetchLatestWaitTimes() {
  try {
    const snapshot = await db.collection('waitTimes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    let driveTimes = [];
    let dineTimes = [];
    let latestDrive = null;
    let latestDine = null;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.location === 'drive') {
        driveTimes.push(data.minutes);
        if (!latestDrive) latestDrive = data;
      } else if (data.location === 'dine') {
        dineTimes.push(data.minutes);
        if (!latestDine) latestDine = data;
      }
    });

    driveTimeEl.textContent = driveTimes.length ? Math.round(average(driveTimes)) + ' min' : 'No data';
    dineTimeEl.textContent = dineTimes.length ? Math.round(average(dineTimes)) + ' min' : 'No data';

    driveUpdatedEl.textContent = latestDrive ? formatTimestamp(latestDrive.timestamp) : '';
    dineUpdatedEl.textContent = latestDine ? formatTimestamp(latestDine.timestamp) : '';

    // Show warning if any wait >= 120 min
    const anyLong = driveTimes.some(m => m >= 120) || dineTimes.some(m => m >= 120);
    warningEl.classList.toggle('hidden', !anyLong);

  } catch (err) {
    console.error(err);
    driveTimeEl.textContent = 'Error';
    dineTimeEl.textContent = 'Error';
  }
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = ts.toDate();
  return `Updated ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
}

// ------------------ Initial Fetch ------------------
fetchLatestWaitTimes();

// Refresh every 2 minutes
setInterval(fetchLatestWaitTimes, 120000);
