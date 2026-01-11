// ------------------ Firebase Setup ------------------
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

// Anonymous login
auth.signInAnonymously().catch(console.error);

// DOM elements
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

// Open form
openFormBtn.addEventListener('click', () => {
  formSection.classList.remove('hidden');
  faqContent.classList.add('hidden'); // hide FAQ if open
});

// Cancel form
cancelBtn.addEventListener('click', () => {
  formSection.classList.add('hidden');
  resetForm();
});

// FAQ toggle
faqBtn.addEventListener('click', () => {
  faqContent.classList.toggle('hidden');
  formSection.classList.add('hidden'); // hide form if open
});

// Location selection
locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLocation = btn.dataset.type;
  });
});

// Submit
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) return alert("Select a location first!");
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + minutes;

  try {
    await db.collection('waitTimes').add({
      location: selectedLocation,
      minutes: totalMinutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Submitted! Thanks!");
    formSection.classList.add('hidden');
    resetForm();
    fetchLatestWaitTimes();
  } catch (err) {
    console.error(err);
    alert("Submission failed, try again.");
  }
});

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
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.location === 'drive') driveTimes.push(data.minutes);
      if (data.location === 'dine') dineTimes.push(data.minutes);
    });

    const calcAvg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const avgDrive = calcAvg(driveTimes);
    const avgDine = calcAvg(dineTimes);

    driveTimeEl.textContent = avgDrive ? `${avgDrive} min` : 'No data';
    dineTimeEl.textContent = avgDine ? `${avgDine} min` : 'No data';

    const formatDate = date => date ? new Date(date.seconds*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    driveUpdatedEl.textContent = snapshot.docs.length ? `Updated: ${formatDate(snapshot.docs[0].data().timestamp)}` : '';
    dineUpdatedEl.textContent = snapshot.docs.length ? `Updated: ${formatDate(snapshot.docs[0].data().timestamp)}` : '';

    // Warning if any over 120
    if (Math.max(...driveTimes, ...dineTimes) > 120) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }

  } catch (err) {
    console.error(err);
    driveTimeEl.textContent = 'Error';
    dineTimeEl.textContent = 'Error';
  }
}

// Initial fetch
fetchLatestWaitTimes();
setInterval(fetchLatestWaitTimes, 60000); // refresh every minute
