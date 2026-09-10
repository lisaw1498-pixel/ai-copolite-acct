export const SECTIONS = [
  { img: "01-dashboard.png", title: "Dashboard", sub: "Your starting point",
    body: "Everything opens here. The top row shows how ready you are: verified facts pulled from your resume, career stories on file, transferable skills, and anything still needing your confirmation. Upcoming interviews appear as cards with a match score and two buttons - Prepare, or Launch Copilot if the interview is happening now.",
    tips: ["Launch Live Interview is the big blue button - use it when a real interview is starting.", "The readiness numbers update on their own as you add material."] },

  { img: "02-resume-manager.png", title: "Resume Manager", sub: "My Profile - Resume",
    body: "Drag in a PDF, DOCX or TXT, or paste the text. Analysis runs in the background and takes a minute or two, so you can carry on using the app while it works - the card updates itself from Analyzing to Resume Successfully Analyzed. If something goes wrong it tells you exactly what, and offers a retry.",
    tips: ["You can keep several resumes and mark one as Default.", "Re-analysing refreshes what was extracted without duplicating it."] },

  { img: "03-verified-experience.png", title: "Verified Experience", sub: "My Profile - Verified Experience",
    body: "This is the heart of the product. Every fact the Copilot is allowed to say about you lives here, each traced back to where it came from. Green means it came straight from your resume or a story you wrote. Blue means transferable - related experience, not the exact thing asked for. Amber means unverified, and those are deliberately kept out of live answers until you confirm them.",
    tips: ["Filter by status using the tabs.", "Anything marked Unverified will never appear in a live interview answer."] },

  { img: "04-career-stories.png", title: "Career Story Library", sub: "My Profile - Career Stories",
    body: "Your STAR stories - situation, task, action, result. The system suggests these from your resume, and you can edit them or write your own. In an interview these are what the Copilot reaches for first, because a story you wrote is stronger evidence than a bullet point.",
    tips: ["Add metrics where you have them; they make an answer land harder.", "Stories you edit are never overwritten when a resume is re-analysed."] },

  { img: "05-skills-tools.png", title: "Skills & Tools", sub: "My Profile - Skills & Tools",
    body: "Platforms, systems and skills with a proficiency level and where you used each one. This is what lets the Copilot answer a question about a tool honestly - naming what you have used directly, and what is only comparable.",
    tips: [] },

  { img: "06-job-opportunities.png", title: "Job Opportunities", sub: "Jobs - Job Opportunities",
    body: "Every role you are pursuing, with its stage and match score. Add a job by pasting the posting; the requirements are extracted automatically and matched against your background.",
    tips: ["The match score only appears once analysis finishes."] },

  { img: "07-job-analysis.png", title: "Job Match Analysis", sub: "Jobs - Job Analysis",
    body: "How you actually line up against a posting, requirement by requirement. Each one is sorted into verified matches, transferable matches, things needing your confirmation, and true gaps - with the evidence quoted underneath. This is the honest picture, not a keyword count.",
    tips: ["True gaps are worth preparing for - they are the questions most likely to catch you out.", "Re-run match after adding new experience."] },

  { img: "08-question-library.png", title: "Question Library", sub: "Prepare - Question Library",
    body: "Questions predicted for this specific job and this specific resume, tagged by category, likelihood and difficulty. They include the uncomfortable ones - gaps in your history, claims worth challenging, dates that invite a question.",
    tips: ["Sort by difficulty and rehearse the hard ones first."] },

  { img: "09-answer-preparation.png", title: "Answer Preparation", sub: "Prepare - Answer Library",
    body: "A grounded answer for any question, at three lengths - roughly 15, 30 and 60 seconds. Underneath, the cue cards you would actually glance at, and a note of how many verified facts the answer rests on. Approve one and it is saved.",
    tips: ["Saved answers load instantly - it will not regenerate unless you ask.", "Regenerating replaces a saved answer and clears its approval."] },

  { img: "10-mock-setup.png", title: "Mock Interview Setup", sub: "Practice - Mock Interview",
    body: "Choose the job, the interview type, the difficulty, and how long you want to go. Leave Use Job Description and Use My Resume on - they are what make the interviewer ask about your actual background rather than generic questions.",
    tips: ["Verified Experience Only keeps the interviewer to evidence you can defend.", "Challenging and Aggressive Follow-Up press much harder on gaps."] },

  { img: "11-mock-session.png", title: "Mock Interview", sub: "Practice - in session",
    body: "The interviewer asks each question out loud in a female voice, and questions come back in under three seconds so the conversation keeps its rhythm. Coaching On shows a suggested answer under the conversation, grounded in your verified experience, for you to read and practise aloud. Answer by typing or by microphone.",
    tips: ["Repeat Question plays it again without regenerating.", "The speaker icon mutes the voice.", "Say it in your own words - do not recite the suggestion.", "Your microphone mutes automatically while the interviewer is speaking."] },

  { img: "12-live-launch.png", title: "Live Interview Launch", sub: "Live - before you start",
    body: "A pre-flight check before a real interview: which job, how many facts are verified, and anything unresolved. Unconfirmed items are simply left out of your answers. Pick a response length and display mode, confirm you understand the recording and consent note, and launch.",
    tips: ["Compact and Discreet modes are for sitting beside a video call.", "Use a desktop browser for live interviews."] },

  { img: "13-live-copilot.png", title: "Live Interview Copilot", sub: "Live - during the interview",
    body: "The screen that matters. It listens, detects the question, and starts writing an answer within a few seconds. SAY THIS is what you say. REMEMBER THIS is what you glance at while speaking - the story in play, the key points, each tagged with where it came from. The green line confirms how many verified facts the answer rests on. If it ever strips an unsupported claim, it tells you before you say it.",
    tips: ["Type a question instead if the audio misses one.", "Switch Story if you would rather use a different example.", "It warns you when a story has already been used in this interview."] },

  { img: "14-post-interview-report.png", title: "Post-Interview Report", sub: "History - after the interview",
    body: "Generated in the background as soon as you end the interview. It covers what went well, what an employer might be concerned about, themes that kept coming up, and anything the employer revealed about the role. A thank-you email is drafted from what was actually discussed. If something was not discussed, it says so rather than inventing it.",
    tips: ["The email can be regenerated in a warmer or more concise tone."] },

  { img: "15-interview-history.png", title: "Interview History", sub: "History",
    body: "Every practice and live session, with scores and outcomes, so you can see whether you are improving. You can delete any session and its transcript.",
    tips: [] },
];
