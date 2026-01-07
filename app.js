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
  if(values.length === 0) return 0;
  values.sort((a,b)=>a-b);
  const mid = Math.floor(values.length/2);
  if(values.length %2 ===0) return Math.round((values[mid-1]+values[mid])/2);
  return values[mid];
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h>0?h+'h ':''}${m}m`;
}

// Generate per-device anonymous ID
let anonId = localStorage.getItem('anonId');
if(!anonId) {
  anonId = Math.random().toString(36).substring(2, 12);
  localStorage.setItem('anonId', anonId);
}

// Cooldown key
const lastSubmitKey = 'lastSubmitTime';

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

  // Check cooldown
  const last = parseInt(localStorage.getItem(lastSubmitKey)) || 0;
  const now = Date.now();
  if(now - last < 15*60*1000) { // 15 min cooldown
    alert('You can submit again in a few minutes. ⏳');
    return false;
  }

  return true;
}

// ---------- FIREBASE SUBMIT ----------
submitBtn.addEventListener('click', async () => {
  if(!validateInput()) return;

  const hours = parseInt(hoursInput.value);
  const minutes = parseInt(minutesInput.value);
  const totalMinutes = hours*60 + minutes;

  try {
    await db.collection('waitTimes').add({
      type: selectedLocation, // 'drive' or 'dine'
      minutesTotal: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      anonId: anonId
    });

    localStorage.setItem(lastSubmitKey, Date.now());
    alert('Thanks for submitting! ✅');
    resetForm();
    formSection.classList.add('hidden');
    fetchAndUpdate(); // refresh estimates
  } catch(err) {
    console.error(err);
    alert('Error submitting. Try again later.');
  }
});

// ---------- FETCH & UPDATE ----------
async function fetchAndUpdate() {
  const now = Date.now();
  const cutoff = new Date(now - 90*60*1000); // last 90 minutes

  const snapshot = await db.collection('waitTimes')
    .where('timestamp', '>=', cutoff)
    .get();

  const driveTimes = [];
  const dineTimes = [];
  let anyOver2h = false;
  let latestTimestamp = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if(data.minutesTotal > 240) return; // ignore >4h
    if(data.type === 'drive') driveTimes.push(data.minutesTotal);
    else if(data.type === 'dine') dineTimes.push(data.minutesTotal);

    if(data.minutesTotal >= 120) anyOver2h = true;
    if(data.timestamp?.toDate()?.getTime() > latestTimestamp) {
      latestTimestamp = data.timestamp.toDate().getTime();
    }
  });

  driveTimeEl.textContent = driveTimes.length ? formatTime(median(driveTimes)) : 'No data';
  dineTimeEl.textContent = dineTimes.length ? formatTime(median(dineTimes)) : 'No data';

  const updatedText = latestTimestamp ? 
    `Updated ${Math.floor((now - latestTimestamp)/60000)} min ago` : '';
  driveUpdatedEl.textContent = updatedText;
  dineUpdatedEl.textContent = updatedText;

  warningEl.style.display = anyOver2h ? 'block' : 'none';
}

// Initial fetch
fetchAndUpdate();
