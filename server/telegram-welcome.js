/**
 * After someone logs in with Telegram, the bot sends them one welcome message with a "Join channel" button.
 *
 * Telegram doesn't let bots add people to channels, so this is the closest thing: the login button asks the user to
 * allow messages from the bot (data-request-access="write"), and if they allow it the invite lands in their Telegram.
 * Each user gets the message once; the ids already welcomed are saved to DATA_DIR. If the user declined messages,
 * Telegram refuses the send and we try again on their next login.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN – required (same bot as the login).
 *   TELEGRAM_CHANNEL   – channel username without @; defaults to fplhouseapp.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'telegram-welcomed.json');

/** Telegram user ids that have already been sent the welcome message. */
let welcomed = null;
/** Ids with a send in progress, so two logins at once don't send twice. */
const sending = new Set();

function load() {
  if (welcomed) return;
  try {
    welcomed = new Set(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Telegram welcome store load error:', err.message);
    welcomed = new Set();
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...welcomed]), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

/** Send the channel invite to this user if they haven't had it yet. Never throws. */
export async function sendChannelInvite(user) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  load();
  if (welcomed.has(user.id) || sending.has(user.id)) return;
  sending.add(user.id);
  const channel = (process.env.TELEGRAM_CHANNEL || 'fplhouseapp').replace(/^@/, '');
  const firstName = user.name.split(' ')[0];
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.id,
        text:
          `Hi ${firstName}, thanks for logging in to FPL House! ⚽\n\n` +
          `Join our channel @${channel} for deadline reminders, price changes and FPL tips.`,
        reply_markup: { inline_keyboard: [[{ text: 'Join channel', url: `https://t.me/${channel}` }]] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      welcomed.add(user.id);
      save();
    } else if (res.status !== 403) {
      // 403 = the user didn't allow messages from the bot (or blocked it): expected, try again next login.
      console.error('Telegram welcome message failed:', res.status, (await res.text()).slice(0, 200));
    }
  } catch (err) {
    console.error('Telegram welcome message error:', err.message);
  } finally {
    sending.delete(user.id);
  }
}
