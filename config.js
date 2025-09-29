
// © 2025 KyuuRzy. All Rights Reserved.
// respect the work, don’t just copy-paste.

import fs from 'fs';
import { fileURLToPath } from "url";
import { dirname } from "path";

const config = {
    owner: "6283892787563",
    botNumber: "6283142864960",
    message: {
        owner: "*Command For Owner Only",
        group: "*Command For Gruop Only*",
        admin: "*Command For Admin Only*",
        private: "Command For Private Only*"
    },
    mediaProperty: {
      mp4ThumbnailOne: "https://raw.githubusercontent.com/RullzFuqi/db/main/shanks_img/VID-20250922-WA0032.mp4",
      thumbnailOne: "https://raw.githubusercontent.com/RullzFuqi/db/main/shanks_img/17992020-a784-435f-8c77-b5f18676cd7b.jpeg",
      thumbanilTwo: "https://raw.githubusercontent.com/RullzFuqi/db/main/shanks_img/(2)%20WRE%20%EC%99%93%EC%8A%A8%26Whatson%20on%20X_%20_%E2%80%A2%20One%20Piece%20-%20FILM%20RED%20Shanks%20Banner%20%E2%80%A2%20%23ONEPIECE%20%23Shanks%20%23FILMRED%20%23gear5%20%23Twitch%20https___t_co_0XfH3UVoDe_%20_%20X.jpeg",
      thumbnailThree: "https://raw.githubusercontent.com/RullzFuqi/db/main/shanks_img/Shanks.jpeg"
    }
}

export default config;


let __filename = fileURLToPath(import.meta.url);
let __dirname = dirname(__filename);
fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  console.log(`\x1b[0;32m${__filename} \x1b[1;32mupdated!\x1b[0m`);
  import(`${__filename}?update=${Date.now()}`);
});
