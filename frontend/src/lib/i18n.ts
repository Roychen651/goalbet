// GoalBet i18n — English & Hebrew
// All UI strings in one place

export type Language = 'en' | 'he';

export const translations = {
  en: {
    // App
    appName: 'GoalBet',
    appTagline: 'Predict. Compete. Win.',
    appDescription: 'The football prediction game for you and your friends. Free. Fun. No real money.',

    // Login
    continueWithGoogle: 'Continue with Google',
    signingIn: 'Signing in...',
    multiTierPredictions: 'Multi-tier\nPredictions',
    liveLeaderboard: 'Live\nLeaderboard',
    cornersFeature: 'Corners\nPrediction',

    // Setup modal
    setupRequired: 'Setup Required',
    setupDescription: 'To use GoalBet, you need to connect a Supabase project. Follow these steps:',
    setupStep1: '1. Create a free project at supabase.com',
    setupStep2: '2. Run the 3 SQL migration files in the SQL Editor',
    setupStep3: '3. Enable Google OAuth in Auth → Providers',
    setupStep4: '4. Replace .env.local with your real Supabase URL and anon key',
    setupStep5: '5. Restart the dev server',
    viewReadme: 'View README for full instructions',
    gotIt: 'Got it',

    // Nav
    matches: 'Matches',
    standings: 'Standings',
    profile: 'Profile',
    settings: 'Settings',
    leaderboard: 'Leaderboard',
    myProfile: 'My Profile',

    // Home
    matchDay: 'Match Day',
    noGroupTitle: 'Welcome to GoalBet',
    noGroupDesc: 'Join or create a group with friends to start predicting matches and competing on the leaderboard.',
    createGroup: 'Create Group',
    joinGroup: 'Join Group',
    all: 'All',
    upcoming: 'Upcoming',
    live: 'Live',
    results: 'Results',

    // Match
    noLiveMatches: 'No live matches right now',
    noMatches: 'No matches found',
    noUpcomingDesc: 'No upcoming matches in your selected leagues. Try adding more leagues in Settings.',
    noLiveDesc: 'Check back when matches are in progress.',
    noMatchesDesc: 'No matches to show. Matches are synced daily.',
    predicted: '✓ Predicted',
    halfTime: 'HT',
    startingNow: 'Starting now',

    // Prediction form
    fullTimeResult: 'Full Time Result',
    exactScore: 'Exact Score',
    totalCorners: 'Total Corners',
    cornersUnder9: '≤ 9',
    cornersTen: '10',
    cornersOver11: '≥ 11',
    bothTeamsToScore: 'Both Teams to Score',
    totalGoals: 'Total Goals',
    lockInPrediction: 'Lock In Prediction',
    predictionSaved: '✓ Prediction Saved — Update',
    predictionLocked: 'No prediction made for this match',
    result: 'Result',
    score: 'Score',
    corners: 'Corners',
    btts: 'BTTS',
    goals: 'Goals',
    home: 'Home',
    draw: 'Draw',
    away: 'Away',
    yes: 'Yes',
    no: 'No',
    over25: 'Over 2.5',
    under25: 'Under 2.5',
    ptsEarned: 'pts earned',
    noPoints: 'No points this time',
    pts: 'pts',
    editPrediction: 'tap to edit',

    // Leaderboard
    allTime: 'All Time',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    yourRank: 'Your Rank',
    points: 'Points',
    accuracy: 'Accuracy',
    picks: 'picks',
    accurate: 'accurate',
    noLeaderboardData: 'No data yet',
    noLeaderboardDesc: 'Start predicting matches to appear on the leaderboard.',

    // Stats labels & sublabels
    hitRate: 'Result Picks',
    ftResultCorrect: 'Win / Draw / Loss correct',
    resolvedLabel: 'resolved',
    allTimeLabel: 'all time',
    pastWeekLabel: 'past week',
    avgLabel: 'avg',
    perMatch: '/ match',
    allTimeGroup: 'all time · this group',
    liveNow: 'Live Now',
    you: 'you',
    ptsLiveLabel: 'pts live',

    // Info tips
    infoRank: 'Your position in the standings, sorted by points.',
    infoPoints: 'Total points this period. Max 19 pts per match.',
    infoHitRate: 'How many times you correctly predicted the final result (Home win / Draw / Away win). The #1 stat in football prediction.',
    infoTotalPoints: 'Sum of all points from resolved matches. FT Result (3), Exact Score (+7), Corners (4), BTTS (2), Over/Under (3). Max 19 pts.',
    infoPredictions: 'Total predictions placed. "Resolved" = match finished and points calculated.',

    // Personal Analytics
    analyticsTitle: 'Personal Analytics',
    bestTier: 'Best Tier',
    scorePrecision: 'Score Precision',
    recentForm: 'Recent Form',
    infoBestTier: 'The prediction tier you hit most accurately. Only tiers with ≥3 attempts are shown, so the stat is statistically meaningful. The % shows how often you earned points from that tier.',
    infoScorePrecision: 'How close your exact-score predictions are. For each resolved match, we sum the goal difference on each side: |predicted home − actual home| + |predicted away − actual away|. 0 = perfect guess. Lower average = sharper predictor.',
    infoRecentForm: 'Your last 5 finished matches where you predicted the full-time result (Home / Draw / Away). Green = correct, red = wrong. The number shows your current correct-result streak.',
    tierResult: 'Result',
    tierScore: 'Exact Score',
    tierCorners: 'Corners',
    tierBTTS: 'BTTS',
    tierOU: 'Over/Under',
    noAnalyticsYet: 'Resolve more predictions to unlock your analytics.',
    goalsOff: 'avg goals off',
    exactScoreHits: 'exact score',
    exactScoreHitsPlural: 'exact scores',
    formStreak: 'streak',
    formOf: 'last 5',
    formStreakOf: 'of last 5',
    noScorePreds: 'no score predictions yet',

    // Settings — admin controls
    renameGroup: 'Rename group',
    syncMatchesTitle: 'Sync Matches',
    adminOnly: 'admin only',
    onlyAdminLeagues: 'Only the group admin can change active leagues',
    dangerZone: 'Danger Zone',
    resetAllScores: 'Reset All Scores',
    resetScoresDesc: 'Resets all leaderboard points and stats for everyone in this group to zero. Prediction history is kept.',
    resetScoresWarning: '⚠️ This will wipe all points and stats for every member. This cannot be undone.',
    yesResetAll: 'Yes, Reset Everything',
    resetBtn: 'Reset',

    // Profile
    totalPoints: 'Total Points',
    predictions: 'Predictions',
    correct: 'Correct',
    predictionHistory: 'Prediction History',
    noPredictions: 'No predictions yet. Start on the Matches tab!',
    signOut: 'Sign Out',

    // Settings
    inviteFriends: 'Invite Friends',
    inviteCode: 'Invite Code',
    copyAndShare: '📋 Copy & Share',
    copied: '✓ Copied',
    switchGroup: 'Switch Group',
    leagues: 'leagues',
    activeLeagues: 'Active Leagues',
    save: 'Save',
    moreGroups: 'More Groups',
    newGroup: '+ New Group',
    joinGroupShort: '→ Join Group',
    noGroupYet: "You're not in any group yet.",

    // Group modals
    createGroupTitle: 'Create Group',
    createGroupDesc: 'Create a private group and share the invite code with friends',
    groupName: 'Group Name',
    groupNamePlaceholder: 'e.g. The Boys, Office League...',
    selected: 'selected',
    cancel: 'Cancel',
    joinGroupTitle: 'Join Group',
    joinGroupDesc: 'Enter the 8-character invite code from your friend',
    join: 'Join Group',

    // Group members
    groupMembers: 'Group Members',
    noMembers: 'No members yet',
    leaveGroup: 'Leave Group',
    leaveGroupConfirm: 'Are you sure you want to leave this group?',
    confirmLeave: 'Yes, Leave',
    deleteGroup: 'Delete Group',

    // Avatar
    chooseAvatar: 'Choose Avatar',
    googlePhoto: 'Google Photo',
    saveAvatar: 'Save Avatar',
    avatarSaved: 'Avatar updated!',

    // Toasts
    groupCreated: 'created! Invite code:',
    joinedGroup: 'Joined',
    leftGroup: 'You left the group',
    leaguesSaved: 'League preferences saved',
    predictionSavedToast: 'Prediction saved!',
    copySuccess: 'Invite link copied!',
    failedLoadMatches: 'Failed to load matches',
    retry: 'Retry',

    // Status
    upcoming_status: 'Upcoming',
    live_status: 'Live',
    halfTime_status: 'Half Time',
    fullTime_status: 'Full Time',
    postponed_status: 'Postponed',
    cancelled_status: 'Cancelled',

    // Theme
    appearance: 'Appearance',
    darkMode: 'Dark',
    lightMode: 'Light',

    // Policy
    policyTerms: 'Policy & Terms',

    // Guide buttons
    scoringBtn: 'Scoring',
    coinsBtn: 'Coins',

    // Match breakdown labels (used in resolved tier rows)
    overUnder: 'Over/Under',
    matchStats: 'Match stats',
    matchTimeline: 'Match Timeline',
    lockedAt90: 'Locked at 90′',

    // Coin summary labels
    coinsLabel: 'Coins',
    stakedLabel: 'Staked',
    backLabel: 'Back',
    profitLabel: 'Profit',

    // Head to Head
    h2hTitle: 'Head to Head',
    h2hLocked: 'Locked',
    h2hNoData: 'No predictions this week',
    h2hTied: 'Tied',

    // User Guide
    userGuide: 'User Guide',
  },

  he: {
    // App
    appName: 'GoalBet',
    appTagline: 'נבא. התחרה. נצח.',
    appDescription: 'משחק ניבוי כדורגל לך ולחברים שלך. בחינם. כיפי. ללא כסף אמיתי.',

    // Login
    continueWithGoogle: 'כניסה עם Google',
    signingIn: 'מתחבר...',
    multiTierPredictions: 'ניבויים\nמרובי שלבים',
    liveLeaderboard: 'טבלה\nבזמן אמת',
    cornersFeature: 'ניבוי\nקרנות',

    // Setup modal
    setupRequired: 'נדרשת הגדרה',
    setupDescription: 'כדי להשתמש ב-GoalBet, יש לחבר פרויקט Supabase. עקוב אחר השלבים הבאים:',
    setupStep1: '1. צור פרויקט חינמי בsupabase.com',
    setupStep2: '2. הרץ את 3 קבצי ה-SQL במעבד השאילתות',
    setupStep3: '3. הפעל Google OAuth בAuthentication → Providers',
    setupStep4: '4. החלף את .env.local עם ה-URL המאת שלך',
    setupStep5: '5. הפעל מחדש את שרת הפיתוח',
    viewReadme: 'הצג README להוראות מלאות',
    gotIt: 'הבנתי',

    // Nav
    matches: 'משחקים',
    standings: 'טבלה',
    profile: 'פרופיל',
    settings: 'הגדרות',
    leaderboard: 'דירוג',
    myProfile: 'הפרופיל שלי',

    // Home
    matchDay: 'יום משחק',
    noGroupTitle: 'ברוך הבא ל-GoalBet',
    noGroupDesc: 'הצטרף או צור קבוצה עם חברים כדי להתחיל לנבא משחקים ולהתחרות בטבלת הדירוג.',
    createGroup: 'צור קבוצה',
    joinGroup: 'הצטרף לקבוצה',
    all: 'הכל',
    upcoming: 'עתידיים',
    live: 'חי',
    results: 'תוצאות',

    // Match
    noLiveMatches: 'אין משחקים חיים כרגע',
    noMatches: 'לא נמצאו משחקים',
    noUpcomingDesc: 'אין משחקים עתידיים בליגות שבחרת. נסה להוסיף ליגות נוספות בהגדרות.',
    noLiveDesc: 'חזור כשמשחקים יתקיימו.',
    noMatchesDesc: 'אין משחקים להצגה. המשחקים מסונכרנים מדי יום.',
    predicted: '✓ נובא',
    halfTime: 'הפסקה',
    startingNow: 'מתחיל עכשיו',

    // Prediction form
    fullTimeResult: 'תוצאה סופית',
    exactScore: 'תוצאה מדויקת',
    totalCorners: 'סה"כ קרנות',
    cornersUnder9: '≤ 9',
    cornersTen: '10',
    cornersOver11: '≥ 11',
    bothTeamsToScore: 'שתי הקבוצות מבקיעות',
    totalGoals: 'סה"כ שערים',
    lockInPrediction: 'נעל ניבוי',
    predictionSaved: '✓ ניבוי נשמר — עדכן',
    predictionLocked: 'לא בוצע ניבוי למשחק זה',
    result: 'תוצאה',
    score: 'סקור',
    corners: 'קרנות',
    btts: 'שתיים מבקיעות',
    goals: 'שערים',
    home: 'בית',
    draw: 'תיקו',
    away: 'חוץ',
    yes: 'כן',
    no: 'לא',
    over25: 'מעל 2.5',
    under25: 'מתחת ל-2.5',
    ptsEarned: 'נק׳ הושגו',
    noPoints: 'אין נקודות הפעם',
    pts: 'נק׳',
    editPrediction: 'לחץ לעריכה',

    // Leaderboard
    allTime: 'כל הזמנים',
    thisWeek: 'השבוע',
    lastWeek: 'שבוע שעבר',
    yourRank: 'הדירוג שלך',
    points: 'נקודות',
    accuracy: 'דיוק',
    picks: 'ניבויים',
    accurate: 'מדויקים',
    noLeaderboardData: 'אין נתונים עדיין',
    noLeaderboardDesc: 'התחל לנבא משחקים כדי להופיע בטבלת הדירוג.',

    // Stats labels & sublabels
    hitRate: 'ניחוש תוצאה',
    ftResultCorrect: 'ניצחון / תיקו / ניצחון חוץ',
    resolvedLabel: 'נפתרו',
    allTimeLabel: 'כל הזמנים',
    pastWeekLabel: 'שבוע שעבר',
    avgLabel: 'ממוצע',
    perMatch: '/ משחק',
    allTimeGroup: 'כל הזמנים · קבוצה זו',
    liveNow: 'חי עכשיו',
    you: 'אני',
    ptsLiveLabel: 'נק׳ חי',

    // Info tips
    infoRank: 'המיקום שלך בטבלה, לפי נקודות.',
    infoPoints: 'סה"כ נקודות בתקופה זו. מקסימום 19 נק׳ למשחק.',
    infoHitRate: 'כמה פעמים ניחשת נכון את תוצאת המשחק (ניצחון בית / תיקו / ניצחון חוץ). הסטטיסטיקה הכי חשובה בניבוי כדורגל.',
    infoTotalPoints: 'סכום כל הנקודות ממשחקים שנפתרו. תוצאה (3), מדויק (+7), קרנות (4), שתיים מבקיעות (2), מעל/מתחת (3). מקס׳ 19 נק׳.',
    infoPredictions: 'סה"כ ניבויים שביצעת. "נפתרו" = המשחק הסתיים והנקודות חושבו.',

    // Personal Analytics
    analyticsTitle: 'אנליטיקה אישית',
    bestTier: 'טייר מוביל',
    scorePrecision: 'דיוק בסקור',
    recentForm: 'פורמה אחרונה',
    infoBestTier: 'הטייר שאתה מנחש הכי טוב. מוצג רק אם ניסית ≥3 פעמים, כך שהנתון מהימן סטטיסטית. האחוז מראה כמה פעמים הרווחת נקודות מאותו טייר.',
    infoScorePrecision: 'כמה קרוב הסקור שניחשת לאמיתי. לכל משחק מחשבים את הפרש השערים: |בית שניחשת − בית בפועל| + |חוץ שניחשת − חוץ בפועל|. 0 = מדויק לחלוטין. ממוצע נמוך = ניחוש חד יותר.',
    infoRecentForm: '5 המשחקים האחרונים שנגמרו שבהם ניחשת את תוצאת 90 הדקות (ניצחון בית / תיקו / ניצחון חוץ). ירוק = צדקת, אדום = טעית. המספר מראה רצף הצלחות עוכשווי.',
    tierResult: 'תוצאה',
    tierScore: 'מדויק',
    tierCorners: 'קרנות',
    tierBTTS: 'שתיים מבקיעות',
    tierOU: 'מעל/מתחת',
    noAnalyticsYet: 'פתור עוד ניבויים כדי לפתוח את האנליטיקה שלך.',
    goalsOff: 'ממוצע שגיאת שערים',
    exactScoreHits: 'סקור מדויק',
    exactScoreHitsPlural: 'סקורים מדויקים',
    formStreak: 'רצף',
    formOf: '5 אחרונים',
    formStreakOf: 'מתוך 5 אחרונים',
    noScorePreds: 'עדיין אין ניבויי סקור',

    // Settings — admin controls
    renameGroup: 'שנה שם קבוצה',
    syncMatchesTitle: 'סנכרן משחקים',
    adminOnly: 'אדמין בלבד',
    onlyAdminLeagues: 'רק מנהל הקבוצה יכול לשנות ליגות פעילות',
    dangerZone: 'אזור סכנה',
    resetAllScores: 'אפס את כל הניקוד',
    resetScoresDesc: 'מאפס את כל הנקודות והסטטיסטיקות של כולם בקבוצה לאפס. היסטוריית הניבויים נשמרת.',
    resetScoresWarning: '⚠️ פעולה זו תמחק את כל הנקודות והסטטיסטיקות של כל החברים. לא ניתן לבטל.',
    yesResetAll: 'כן, אפס הכל',
    resetBtn: 'אפס',

    // Profile
    totalPoints: 'סה"כ נקודות',
    predictions: 'ניבויים',
    correct: 'נכון',
    predictionHistory: 'היסטוריית ניבויים',
    noPredictions: 'אין ניבויים עדיין. התחל בלשונית המשחקים!',
    signOut: 'התנתק',

    // Settings
    inviteFriends: 'הזמן חברים',
    inviteCode: 'קוד הזמנה',
    copyAndShare: '📋 העתק ושתף',
    copied: '✓ הועתק',
    switchGroup: 'החלף קבוצה',
    leagues: 'ליגות',
    activeLeagues: 'ליגות פעילות',
    save: 'שמור',
    moreGroups: 'קבוצות נוספות',
    newGroup: '+ קבוצה חדשה',
    joinGroupShort: '→ הצטרף לקבוצה',
    noGroupYet: 'אתה עדיין לא בשום קבוצה.',

    // Group modals
    createGroupTitle: 'צור קבוצה',
    createGroupDesc: 'צור קבוצה פרטית ושתף את קוד ההזמנה עם חברים',
    groupName: 'שם הקבוצה',
    groupNamePlaceholder: 'לדוגמה: החבר\'ה, ליגת המשרד...',
    selected: 'נבחרו',
    cancel: 'ביטול',
    joinGroupTitle: 'הצטרף לקבוצה',
    joinGroupDesc: 'הזן את קוד ההזמנה בן 8 תווים מהחבר שלך',
    join: 'הצטרף לקבוצה',

    // Group members
    groupMembers: 'חברי הקבוצה',
    noMembers: 'אין חברים עדיין',
    leaveGroup: 'עזוב קבוצה',
    leaveGroupConfirm: 'האם אתה בטוח שאתה רוצה לעזוב?',
    confirmLeave: 'כן, עזוב',
    deleteGroup: 'מחק קבוצה',

    // Avatar
    chooseAvatar: 'בחר אווטר',
    googlePhoto: 'תמונת Google',
    saveAvatar: 'שמור אווטר',
    avatarSaved: 'האווטר עודכן!',

    // Toasts
    groupCreated: 'נוצרה! קוד הזמנה:',
    joinedGroup: 'הצטרפת ל-',
    leftGroup: 'עזבת את הקבוצה',
    leaguesSaved: 'העדפות הליגה נשמרו',
    predictionSavedToast: 'הניבוי נשמר!',
    copySuccess: 'קישור ההזמנה הועתק!',
    failedLoadMatches: 'טעינת משחקים נכשלה',
    retry: 'נסה שוב',

    // Status
    upcoming_status: 'עתידי',
    live_status: 'חי',
    halfTime_status: 'הפסקה',
    fullTime_status: 'סיום',
    postponed_status: 'נדחה',
    cancelled_status: 'בוטל',

    // Theme
    appearance: 'מראה',
    darkMode: 'כהה',
    lightMode: 'בהיר',

    // Policy
    policyTerms: 'מדיניות ותנאים',

    // Guide buttons
    scoringBtn: 'ניקוד',
    coinsBtn: 'מטבעות',

    // Match breakdown labels (used in resolved tier rows)
    overUnder: 'מעל/מתחת',
    matchStats: 'נתוני משחק',
    matchTimeline: 'ציר זמן',
    lockedAt90: 'נעול ב-90′',

    // Coin summary labels
    coinsLabel: 'מטבעות',
    stakedLabel: 'הימור',
    backLabel: 'החזר',
    profitLabel: 'רווח',

    // Head to Head
    h2hTitle: 'ראש בראש',
    h2hLocked: 'נעול',
    h2hNoData: 'אין ניבויים השבוע',
    h2hTied: 'שוויון',

    // User Guide
    userGuide: 'מדריך משתמש',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
