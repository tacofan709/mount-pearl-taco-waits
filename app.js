// Firebase config (replace with your own)
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

// DOM elements
const waitTimesContainer = document.getElementById('waitTimes');
const submitBtn = document.getElementById('submitBtn');
const locationButtons = document.querySelectorAll('.location-choice button');
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');

let selectedLocation = null;

// Handle location selection
locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedLocation = btn.dataset.location;
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Device ID for 6-hour lock (anonymous)
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('deviceId', deviceId);
}

// Submit wait time
submitBtn.addEventListener('click', async () => {
  if (!selectedLocation) {
    alert('Select a location first!');
    return;
  }

  const hours = parseInt(hoursInput.value, 10);
  const minutes = parseInt(minutesInput.value, 10);

  // Validation
  if (isNaN(hours) || hours < 0 || hours > 4) {
    alert('Hours must be 0-4');
    return;
  }
  if (isNaN(minutes) || minutes < 0 || minutes > 59) {
    alert('Minutes must be 0-59');
    return;
  }

  // Business hours: 10:30am - 1:00am
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const nowMinutes = hour * 60 + minute;
  const startMinutes = 10 * 60 + 30;
  const endMinutes = 25 * 60; // 1:00am next day = 25*60

  if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
    alert('Wait times can only be submitted between 10:30am - 1:00am');
    return;
  }

  // 6-hour lock
  const lastSubmit = localStorage.getItem('lastSubmit');
  if (lastSubmit && now.getTime() - parseInt(lastSubmit) < 6 * 60 * 60 * 1000) {
    alert('You can only submit once every 6 hours');
    return;
  }

  try {
    await db.collection('waitTimes').add({
      location: selectedLocation,
      hours,
      minutes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      deviceId
    });
    localStorage.setItem('lastSubmit', now.getTime());
    alert('Wait time submitted!');
    fetchWaitTimes();
  } catch (err) {
    console.error(err);
    alert('Submission failed. Try again.');
  }
});

// Fetch and display wait times
async function fetchWaitTimes() {
  waitTimesContainer.innerHTML = '';
  try {
    const snapshot = await db.collection('waitTimes')
      .orderBy('timestamp', 'desc')
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const card = document.createElement('div');
      card.classList.add('wait-card');
      card.innerHTML = `
        <h2>${data.location}</h2>
        <div class="time">${data.hours}h ${data.minutes}m</div>
        <div class="updated">${data.timestamp?.toDate().toLocaleTimeString() || 'Just now'}</div>
      `;
      waitTimesContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    waitTimesContainer.innerHTML = 'Error loading wait times.';
  }
}

// Initial load + refresh every 2 mins
fetchWaitTimes();
setInterval(fetchWaitTimes, 120000);
