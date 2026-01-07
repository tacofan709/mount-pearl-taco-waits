# Mount Pearl Taco Wait Times 🌮

Community-reported wait times for the first standalone Taco Bell in Newfoundland — Mount Pearl, NL.

This is a **mobile-first web app** where users can:

- See estimated wait times for:
  - 🚗 Drive-thru
  - 🍽️ Dine-in / Walk-in
- Submit their own wait times anonymously

---

## Features

- Mobile-first, single-page web app
- Live median-based wait time estimates (last 90 minutes)
- Light & playful “late-night taco vibes”
- Simple anonymous submission (no accounts, zero friction)
- Anti-spam:
  - 15-minute cooldown per device
  - Maximum allowed wait: 4 hours
- Warning banner when waits ≥2 hours
- GitHub Pages hosted
- Firebase Firestore used for storing submissions

---

## Tech Stack

- **Frontend:** HTML + CSS + Vanilla JS
- **Database:** Firebase Firestore
- **Hosting:** GitHub Pages
- **Fonts / Icons:** System UI + Lucide / Material icons

---

## How to Use

1. Open the [live site](https://tacofan709.github.io/mount-pearl-taco-waits/)
2. View the current wait times for Drive-thru and Dine-in / Walk-in
3. Tap **Submit your wait time** to add your own
4. Choose where you waited
5. Enter hours and minutes (0–4h max, 0–59m)
6. Tap Submit — thanks for contributing! ✅

> If no recent data exists (last 90 minutes), the cards will show:
> `"Be the first! 🌮"`

---

## Notes for Developers

- Firebase configuration is stored in `app.js` (replace with your own keys)
- Firestore collection: `waitTimes`
- Data model per submission:
  ```json
  {
    "type": "drive" | "dine",
    "minutesTotal": number,
    "timestamp": serverTimestamp(),
    "anonId": string
  }
