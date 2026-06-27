# Getting POCO online — step-by-step

This turns the POCO tool into a real, private website that you and your partner both log into with Google, sharing the same deals and contacts live.

You don't need to write any code. You'll be copying a few values from one screen and pasting them into the app file, plus clicking through some Google settings. Take it slowly — it's about 20–30 minutes the first time.

**Two things you'll edit in the file** `poco-deal-tool.html`. Open it in any plain text editor (TextEdit, Notepad, or VS Code). Near the very top you'll see a block that starts with `⚙ FIREBASE SETUP`. That's the only part you touch.

Until you fill that block in, the app runs in **Demo mode** (a yellow badge shows top-right) and data stays only on your device. Once it's filled in, it becomes the real shared app.

---

## Step 1 — Create a Firebase project
1. Go to **console.firebase.google.com** and sign in with the Google account you want to own this.
2. Click **Add project**. Name it something like `poco-property`. 
3. Turn **off** Google Analytics (you don't need it). Click **Create project**, wait, then **Continue**.

## Step 2 — Add a Web app and copy the config
1. On the project home, click the **`</>`** (web) icon.
2. Give it a nickname like `poco-web`. **Don't** tick "Firebase Hosting". Click **Register app**.
3. You'll see a `const firebaseConfig = { … }` block with six values (apiKey, authDomain, etc.).
4. Copy each value into the matching line in the app file's setup block, replacing the `PASTE_…` text. Keep the quote marks. Example:

   ```
   apiKey: "AIzaSyB....your real key....",
   authDomain: "poco-property.firebaseapp.com",
   projectId: "poco-property",
   ...
   ```

## Step 3 — Add your two emails
In the same block, set the two Google email addresses allowed in:

```
const ALLOWED_EMAILS = ["yourname@gmail.com", "yourpartner@gmail.com"];
```

Only these accounts will be able to open the app. (This is your first lock; Step 5 adds the real one.)

## Step 4 — Turn on Google sign-in
1. In Firebase, left menu → **Build → Authentication** → **Get started**.
2. Open the **Sign-in method** tab → click **Google** → toggle **Enable** → pick a support email → **Save**.

## Step 5 — Create the database and lock it down
1. Left menu → **Build → Firestore Database** → **Create database**.
2. Choose **Production mode** → pick a location (e.g. `europe-west2` for the UK) → **Enable**.
3. Open the **Rules** tab, delete what's there, and paste this in — **swapping in your two real emails**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function allowed() {
         return request.auth != null &&
           request.auth.token.email in ['yourname@gmail.com','yourpartner@gmail.com'];
       }
       match /workspace/{doc} {
         allow read, write: if allowed();
       }
     }
   }
   ```
4. Click **Publish**. This is what actually keeps everyone else out — only your two Google accounts can read or write your data.

## Step 6 — Put the app online (drag-and-drop)
The easiest host for a designer, no command line:
1. Go to **app.netlify.com/drop**.
2. Drag your `poco-deal-tool.html` file onto the page. It uploads and gives you a web address like `https://something-random.netlify.app`.
3. (Optional) In Netlify you can rename the site or add your own domain later.

## Step 7 — Let your site talk to Google sign-in
Google only allows sign-in from web addresses you've approved:
1. Back in Firebase → **Authentication → Settings** tab → **Authorized domains**.
2. Click **Add domain** and paste your Netlify address **without** the `https://` (e.g. `something-random.netlify.app`). Save.

## Step 8 — Go live
1. Open your Netlify web address. You should see the **Sign in with Google** screen (no yellow demo badge).
2. Sign in. Send the same link to your partner; they sign in with their Google account.
3. You're now both looking at the same workspace — add a deal on one device and it appears on the other.

---

## Good to know

- **It starts empty.** Your real workspace begins with no deals (the Demo-mode example doesn't carry over). Just add your live deals fresh.
- **If you change the file later**, re-drag the new version onto Netlify Drop to update the site. Your data lives in Firebase, so it's untouched by re-uploads.
- **Cost.** Firebase's free tier is very generous and two users will almost certainly stay inside it at £0. It only asks for a card if you deliberately upgrade — you don't need to.
- **Editing at the same time.** The whole workspace is saved as one shared record, so if you both edit the *exact same* thing in the same few seconds, the last save wins. For two people dipping in and out, this is rarely an issue — but it's worth knowing.
- **Keep your details private.** The config values and the link are for the two of you. The security rules in Step 5 are the real protection, so make sure those emails are correct.

If you get stuck on any single step, tell me which number and what you see on screen, and I'll talk you through it.
