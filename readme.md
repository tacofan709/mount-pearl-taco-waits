# Mount Pearl Taco Bell Wait Times

A simple, unofficial community tool for checking and sharing current wait times at the Mount Pearl Taco Bell.

**Live site:** [https://tacofan709.github.io/mount-pearl-taco-waits/](https://tacofan709.github.io/mount-pearl-taco-waits/)

---

## How It Works

- Users can submit wait times for Drive-thru or Dine-in / Walk-in.  
- Wait times are anonymously submitted — no personal information is collected.  
- Each user can submit once every 6 hours, regardless of location.  
- Submissions are accepted only between 10:30 AM and 1:15 AM Newfoundland Time.  
- The displayed time is the weighted median of up to the 10 most recent valid reports from the past 90 minutes, giving greater weight to newer submissions.  
- When no reports have been received in the past 90 minutes, the display shows “No recent reports.”  
- Wait times over 2 hours trigger a community warning banner.  
- Below each wait time, a note shows how many reports were included (for example: “Based on 6 reports in the last 90 minutes.”)

---

## FAQ

**How do I submit a wait time?**  
Tap “Submit your wait time,” choose Drive-thru or Dine-in, enter your wait duration, and submit.

**How often can I submit?**  
Once every 6 hours total (both locations share the cooldown).

**When can I submit?**  
Between 10:30 AM and 1:15 AM Newfoundland Time.

**What does the number mean?**  
It’s the median wait time, weighted toward newer reports from the last 90 minutes to keep results current and stable.

**Why do I see “No recent reports”?**  
No valid submissions have been made in the past 90 minutes.

**Who made this?**  
Created by Jeff Hillyard, Mount Pearl resident and nonprofit program coordinator. Web development is a hobby project.

**Is this official or commercial?**  
No — this site is completely free and unofficial, with no ads or affiliation with Taco Bell.

---

## Disclaimer

- Unofficial, community-reported wait times.  
- Data may be inaccurate, incomplete, or delayed.  
- Use for general guidance only.

---

## Tech Stack

- HTML, CSS, JavaScript  
- Firebase Firestore (for data)  
- Firebase Auth (anonymous sign-in)  
- GitHub Pages (hosting)
