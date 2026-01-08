// ---------- FIREBASE CONFIG ----------
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
  return values.length % 2
    ? values[mid]
    : Math.round((values[mid - 1] + values[mid]) / 2);
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
  return diffHr === 1
    ? 'Updated 1 hour ago'
    : `Updated ${diffHr} hours ago`;
}

// ---------- DEVICE ID ----------
let anonId = localStorage.getItem('anonId');
if (!anonId) {
  anonId = Math.random().toString(36).substring(2, 12);
  localStorage.setItem('anonId', anonId);
}

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
    selectedLocation = btn.dataset.type; // drive | dine
  });
});

function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

function validateInput() {
  const h = parseInt(hoursInput.value);
  const m = parseInt(minutesInput.value);

  if (!selectedLocation) return alert('Select Drive-thru or Dine-in'), false;
  if (isNaN(h) || isNaN(m)) return alert('Enter valid numbers'), false;
  if (h < 0 || h > 4 || m < 0 || m > 59) return alert('Unrealistic time'), false;
  if (h === 0 && m === 0) return alert('Wait time cannot be 0'), false;

  const last = parseInt(localStorage.getItem(lastSubmitKey)) || 0;
  if (Date.now() - last < 15 * 60 * 1000)
    return alert('Please wait before submitting again'), false;

  return true;
}

// ---------- CACHE DISPLAY ----------
function fetchAndUpdateFromCache() {
  const cached = JSON.parse(localStorage.getItem('cachedMedians')) || {};

  if (cached.drive) {
    driveTimeEl.textContent = cached.drive.time || 'No data';
    driveUpdatedEl.textContent = timeAgo(cached.drive.updatedAt);
  } else {
    driveTimeEl.textContent = 'No data';
    driveUpdatedEl.textContent = '';
  }

  if (cached.dine) {
    dineTimeEl.textContent = cached.dine.time || 'No data';
    dineUpdatedEl.textContent = timeAgo(cached.dine.updatedAt);
  } else {
    dineTimeEl.textContent = 'No data';
    dineUpdatedEl.textContent = '';
  }

  warningEl.style.display = cached.warning ? 'block' : 'none';
}

// Initial cache display + update every minute
fetchAndUpdateFromCache();
setInterval(fetchAndUpdateFromCache, 60 * 1000);

// ---------- SUBMIT ----------
submitBtn.addEventListener('click', async () => {
  if (!validateInput()) return;

  const totalMinutes =
    parseInt(hoursInput.value) * 60 + parseInt(minutesInput.value);

  try {
    await db.collection('waitTimes').add({
      type: selectedLocation,
      minutesTotal: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      anonId
    });

    localStorage.setItem(lastSubmitKey, Date.now());

    const cached = JSON.parse(localStorage.getItem('cachedMedians')) || {};
    cached[selectedLocation] = {
      time: formatTime(totalMinutes),
      updatedAt: Date.now()
    };
    cached.warning = totalMinutes >= 120 || cached.warning;

    localStorage.setItem('cachedMedians', JSON.stringify(cached));
    fetchAndUpdateFromCache();

    alert('Thanks for submitting!');
    resetForm();
    formSection.classList.add('hidden');
  } catch (e) {
    console.error(e);
    alert('Submission failed');
  }
});

// ---------- HOURLY MEDIAN FETCH ----------
async function updateMediansFromFirestore() {
  const now = Date.now();
  const last = parseInt(localStorage.getItem(lastHourlyFetchKey)) || 0;
  if (now - last < 60 * 60 * 1000) return;

  try {
    const snap = await db.collection('waitTimes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const drive = [];
    const dine = [];
    let warning = false;

    snap.forEach(doc => {
      const d = doc.data();
      if (!d.minutesTotal || d.minutesTotal > 240) return;
      if (d.type === 'drive') drive.push(d.minutesTotal);
      if (d.type === 'dine') dine.push(d.minutesTotal);
      if (d.minutesTotal >= 120) warning = true;
    });

    const cached = {
      drive: drive.length
        ? { time: formatTime(median(drive)), updatedAt: now }
        : null,
      dine: dine.length
        ? { time: formatTime(median(dine)), updatedAt: now }
        : null,
      warning
    };

    localStorage.setItem('cachedMedians', JSON.stringify(cached));
    localStorage.setItem(lastHourlyFetchKey, now);
    fetchAndUpdateFromCache();
  } catch (e) {
    console.error('Firestore fetch error', e);
  }
}

updateMediansFromFirestore();
setInterval(updateMediansFromFirestore, 5 * 60 * 1000);
