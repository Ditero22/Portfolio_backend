import { google } from "googleapis";
import path from "node:path";

const KEY_FILE = path.resolve(
  "src/config/google-service-account.json",
);

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: [
    "https://www.googleapis.com/auth/drive",
  ],
});

const drive = google.drive({
  version: "v3",
  auth,
});

export default drive;