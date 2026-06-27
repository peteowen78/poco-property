/* ============================================================
   ⚙  FIREBASE SETUP — fill these in to go live (see the guide).
   Leave them as-is and the app runs in local DEMO mode instead
   (data stays on this device). Numbers in [ ] match the guide.
   ============================================================ */
const firebaseConfig = {
  apiKey:            "PASTE_apiKey",            // [2] from your Firebase web-app config
  authDomain:        "PASTE_authDomain",        //     e.g. poco-xxxx.firebaseapp.com
  projectId:         "PASTE_projectId",
  storageBucket:     "PASTE_storageBucket",
  messagingSenderId: "PASTE_messagingSenderId",
  appId:             "PASTE_appId"
};
// [3] The Google email addresses allowed in — yours and your partner's.
const ALLOWED_EMAILS = ["you@gmail.com", "partner@gmail.com"];

const USE_FIREBASE = firebaseConfig.apiKey.indexOf("PASTE_") !== 0;
