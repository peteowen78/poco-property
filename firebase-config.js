/* ============================================================
   ⚙  FIREBASE SETUP — fill these in to go live (see the guide).
   Leave them as-is and the app runs in local DEMO mode instead
   (data stays on this device). Numbers in [ ] match the guide.
   ============================================================ */
const firebaseConfig = {
  apiKey:            "AIzaSyB6qnWsOxTyZqMGc4_I-8E-4I5uOuGRQ5A",
  authDomain:        "poco-property.firebaseapp.com",
  projectId:         "poco-property",
  storageBucket:     "poco-property.firebasestorage.app",
  messagingSenderId: "840047021503",
  appId:             "1:840047021503:web:c11a382b98a866ea83250a"
};
// [3] The Google email addresses allowed in — yours and your partner's.
const ALLOWED_EMAILS = ["pete@pocoproperty.co.uk", "caroline@pocoproperty.co.uk"];

const USE_FIREBASE = firebaseConfig.apiKey.indexOf("PASTE_") !== 0;
