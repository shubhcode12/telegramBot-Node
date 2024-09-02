require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { create } = require("@open-wa/wa-automate");
const readline = require("readline");
const express = require("express");
const server = express();
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const PORT = process.env.PORT || 3000
const phone = process.env.TELGRAM_PHONE_NO;
const fs = require("fs");
const TELEGRAM_CHANNEL_IDS = [2235774451, 1001319825657]; 
const { NewMessage } = require("telegram/events/NewMessage");

let sessionString = "";

if (fs.existsSync("session.txt")) {
  sessionString = fs.readFileSync("session.txt", "utf8");
}

const stringSession = new StringSession(sessionString);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let telegramClient;

(async () => {
  telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  if (!sessionString) {
    await telegramClient.start({
      phoneNumber: phone,
      password: async () =>
        new Promise((resolve) =>
          rl.question("Please enter your password: ", resolve)
        ),
      phoneCode: async () =>
        new Promise((resolve) =>
          rl.question("Please enter the code you received: ", resolve)
        ),
      onError: (err) => console.log(err),
    });
    fs.writeFileSync("session.txt", telegramClient.session.save());
    console.log("Session saved to session.txt");
  } else {
    await telegramClient.connect();
    console.log("Connected using saved session.");
  }

  const SESSION_FILE_PATH = "./session.data.txt";  // Store as text

  function loadSessionData() {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      return fs.readFileSync(SESSION_FILE_PATH, "utf8");
    }
    return null;
  }

  const sessionData = loadSessionData();

  const waClient = await create({
    sessionData: sessionData,  // Use session data as a string
    qrTimeout: 0,
    cacheEnabled: false,
    headless: true,
  });

  waClient.onStateChanged(async (state) => {
    console.log("STATE:", state);
    if (state === "CONNECTED") {
      const sessionData = await waClient.getSessionToken();
      fs.writeFileSync(SESSION_FILE_PATH, sessionData);  // Save as a string
      console.log("WhatsApp session saved to session.data.txt");
    }
  });

  const groups = await waClient.getAllGroups();
  groups.forEach((group) => {
    console.log(`Group Name: ${group.name}, Group ID: ${group.id}`);
  });

  telegramClient.addEventHandler(async (event) => {
    if (event.isChannel) {
      const message = event.message;
      const chat = await message.getChat();

      const chatName = chat?.title || chat?.username || "Private Chat";
      const chatId = chat?.id;
      const messageContent = message.message;

      console.log(
        `New message received in chat "${chatName}" (ID: ${chatId}), "Message : ${messageContent}"`
      );
      sendMessageToWhatsappGroup(waClient, messageContent);
    } else {
      console.log("message is from private chat");
    }
  }, new NewMessage({ chats: TELEGRAM_CHANNEL_IDS }));
})();

async function sendMessageToWhatsappGroup(waClient, messageContent) {
  const groupId = "120363311365526415@g.us"; // Replace with your WhatsApp group ID

  try {
    await waClient.sendText(groupId, messageContent);
    console.log(`Message sent to WhatsApp group: ${messageContent}`);
  } catch (error) {
    console.error("Failed to send message to WhatsApp group:", error);
  }
}

server.use(express.static("public"));
server.listen(PORT, () => console.log(`> Listening on http://localhost:${PORT}`));
