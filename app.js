// ---------- DOM ELEMENTS ----------
const openFormBtn = document.getElementById('openFormBtn');
const formSection = document.getElementById('formSection');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');

const locationButtons = document.querySelectorAll('.location-choice button');
let selectedLocation = null;

const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');

// ---------- FUNCTIONS ----------

// Open form
openFormBtn.addEventListener('click', () => {
  formSection.classList.remove('hidden');
  window.scrollTo({ top: formSection.offsetTop - 20, behavior: 'smooth' });
});

// Cancel form
cancelBtn.addEventListener('click', () => {
  formSection.classList.add('hidden');
  resetForm();
});

// Select location button
locationButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    locationButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLocation = btn.getAttribute('data-type'); // 'drive' or 'dine'
  });
});

// Reset form fields
function resetForm() {
  selectedLocation = null;
  locationButtons.forEach(b => b.classList.remove('selected'));
  hoursInput.value = 0;
  minutesInput.value = 0;
}

// Validate input
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

  return true;
}

// Handle submit (UI only for now)
submitBtn.addEventListener('click', () => {
  if (!validateInput()) return;

  const hours = parseInt(hoursInput.value);
  const minutes = parseInt(minutesInput.value);
  const totalMinutes = hours * 60 + minutes;

  console.log('User submitted:', {
    location: selectedLocation,
    hours,
    minutes,
    totalMinutes,
  });

  alert('Thanks for submitting! ✅');

  // Reset and close form
  resetForm();
  formSection.classList.add('hidden');
});
