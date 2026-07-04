/** Barrel re-export — Jack & Jill inbox + kanban automation. */
export {
  JACK_EMAIL,
  JACK_INBOX,
  JACK_KANBAN,
  JACK_LOGGED_IN,
  ensureLoggedIn,
  verifyAccess,
} from "./jack/auth.js";
export { fillInbox, getInboxCount, reviewInbox } from "./jack/inbox.js";
export { emptySavedColumn, openKanban, savedCount, type EmptyResult } from "./jack/kanban.js";
