// ---------- FIREBASE CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyB3ElBHMDJrCRPNW3MeR8YZWKR1HYyCgmo",
  authDomain: "mount-pearl-taco-waits.firebaseapp.com",
  projectId: "mount-pearl-taco-waits",
  storageBucket: "mount-pearl-taco-waits.firebasestorage.app",
  messagingSenderId: "182160934094",
  appId: "1:182160934094:web:a116715546f9364945fc9f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---------- DOM ELEMENTS ----------
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

// ---------- UTILS ----------
function median(values) {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Updated just now';
  if (diffMin === 1) return 'Updated 1 min ago';
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return diffHr === 1 ? 'Updated 1 hour ago' : `Updated ${diffHr} hours ago`;
}

// ---------- DEVICE ID ----------
let anonId = localStorage.getItem('anonId');
if (!anonId) {
  anonId = Math.random().toString(36).substring(2, 12);
  localStorage.setItem('anonId', anonId);
}

// Cooldown keys
const lastSubmitKey = 'lastSubmitTime';
const lastHourlyFetchKey = 'lastHourlyFetch';

// ---------- FORM LOGIC ----------
openFormBtn.addEventListener('click', () => {
  formSection.classList.remove('hidden');
  window.scrollTo({ top: formSection.offsetTop - 20, behavior: 'smooth' });
});

cancelBtn.addEventListener('click', () => {
  formSection.classList.add('hidden');
  resetForm();
});

locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLocation = btn.getAttribute('data-type'); // 'drive' or 'dine'
  });
});

function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

function validateInput() {
  const hours = parseInt(hoursInput.value);
  const minutes = parseInt(minutesInput.value);

  if (!selectedLocation) {
    alert('Please select Drive-thru or Dine-in / Walk-in.');
    return false;
  }

  if (isNaN(hours) || isNaN(minutes)) {
    alert('Please enter valid numbers.');
    return false;
  }

  if (hours < 0 || hours > 4 || minutes < 0 || minutes > 59) {
    alert('Please enter a realistic wait time (0-4 hours, 0-59 minutes).');
    return false;
  }

  if (hours === 0 && minutes === 0) {
    alert('Wait time cannot be 0.');
    return false;
  }

  const last = parseInt(localStorage.getItem(lastSubmitKey)) || 0;
  if (Date.now() - last < 15 * 60 * 1000) { // 15 min cooldown
    alert('You can submit again in a few minutes. ⏳');
    return false;
  }

  return true;
}

// ---------- LOCALSTORAGE FETCH & UPDATE ----------
function fetchAndUpdateFromCache() {
  const cached = JSON.parse(localStorage.getItem('cachedMedians')) || {};

  if (cached.drive) {
    driveTimeEl.textContent = cached.drive.time;
    driveUpdatedEl.textContent = cached.drive.updated;
  } else {
    driveTimeEl.textContent = 'No data';
    driveUpdatedEl.textContent = '';
  }

  if (cached.dine) {
    dineTimeEl.textContent = cached.dine.time;
    dineUpdatedEl.textContent = cached.dine.updated;
  } else {
    dineTimeEl.textContent = 'No data';
    dineUpdatedEl.textContent = '';
  }

  warningEl.style.display = cached.warning ? 'block' : 'none';
}

// Initial load
fetchAndUpdateFromCache();

// ---------- SUBMIT ----------
submitBtn.addEventListener('click', async () => {
  if (!validateInput()) return;

  const hours = parseInt(hoursInput.value);
  const minutes = parseInt(minutesInput.value);
  const totalMinutes = hours * 60 + minutes;

  try {
    await db.collection('waitTimes').add({
      type: selectedLocation,
      minutesTotal: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      anonId: anonId
    });

    localStorage.setItem(lastSubmitKey, Date.now());
    alert('Thanks for submitting! ✅');
    resetForm();
    formSection.classList.add('hidden');

    const cached = JSON.parse(localStorage.getItem('cachedMedians')) || {};

    if (selectedLocation === 'drive') {
      driveTimeEl.textContent = formatTime(totalMinutes);
      driveUpdatedEl.textContent = 'Updated 0 min ago';
      cached.drive = { time: formatTime(totalMinutes), updated: 'Updated 0 min ago' };
    } else if (selectedLocation === 'dine') {
      dineTimeEl.textContent = formatTime(totalMinutes);
      dineUpdatedEl.textContent = 'Updated 0 min ago';
      cached.dine = { time: formatTime(totalMinutes), updated: 'Updated 0 min ago' };
    }

    cached.warning = totalMinutes >= 120 || cached.warning;
    localStorage.setItem('cachedMedians', JSON.stringify(cached));

  } catch (err) {
    console.error(err);
    alert('Error submitting. Try again later.');
  }
});

// ---------- HOURLY MEDIAN FETCH ----------
async function updateMediansFromFirestore() {
  const now = Date.now();
  const lastFetch = parseInt(localStorage.getItem(lastHourlyFetchKey)) || 0;
  if (now - lastFetch < 60 * 60 * 1000) return;

  try {
    const snapshot = await db.collection('waitTimes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const driveTimes = [];
    const dineTimes = [];
    let warning = false;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.minutesTotal || data.minutesTotal > 240) return;

      if (data.type === 'drive') driveTimes.push(data.minutesTotal);
      if (data.type === 'dine') dineTimes.push(data.minutesTotal);
      if (data.minutesTotal >= 120) warning = true;
    });

    const cached = {
      drive: driveTimes.length ? { time: formatTime(median(driveTimes)), updated: 'Updated just now' } : null,
      dine: dineTimes.length ? { time: formatTime(median(dineTimes)), updated: 'Updated just now' } : null,
      warning
    };

    localStorage.setItem('cachedMedians', JSON.stringify(cached));
    localStorage.setItem(lastHourlyFetchKey, now);

    fetchAndUpdateFromCache();

  } catch (err) {
    console.error('Error updating medians from Firestore:', err);
  }
}

// Run on page load
updateMediansFromFirestore();
setInterval(updateMediansFromFirestore, 5 * 60 * 1000);
