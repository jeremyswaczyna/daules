# Firebase Storage CORS Setup

File uploads (avatars, trade screenshots, certificates) require CORS to be configured on your Firebase Storage bucket.

## One-time setup

```bash
# Install gsutil if you don't have it (part of Google Cloud SDK)
# https://cloud.google.com/sdk/docs/install

# Apply the cors.json to your bucket (replace YOUR_BUCKET with NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET value)
gsutil cors set cors.json gs://YOUR_BUCKET
```

Your storage bucket name is in `.env.local` as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.

## Verify
```bash
gsutil cors get gs://YOUR_BUCKET
```

## Firebase Storage Rules (also required)
In Firebase Console → Storage → Rules, make sure you have rules that allow authenticated writes:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid}.jpg {
      allow read: if true;
      allow write: if request.auth.uid == uid;
    }
    match /trades/{uid}/{allPaths=**} {
      allow read, write: if request.auth.uid == uid;
    }
    match /certificates/{uid}/{allPaths=**} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```
