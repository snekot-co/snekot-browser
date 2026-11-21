# snekot.js

The browser script for [Snekot](https://snekot.co): cookieless page views, click and form tracking, newsletter signups and A/B tests, from one script tag with no build step.

This repository holds the source of the script exactly as it is served at `https://api.snekot.co/snekot.js`, and of the [feedback button](#the-feedback-button) beside it, so you can read what runs on your pages. You do not need to install anything from here.

## Use

```html
<script async src="https://api.snekot.co/snekot.js"></script>
<script>
  window.snekotq = window.snekotq || [];
  window.snekot = window.snekot || ((...args) => window.snekotq.push(args));
  window.snekot('setConfig', 'YOUR_PUBLIC_KEY', 'your-project');
</script>
```

Anything in a web page can be read by the people who open it, so use a **public** key (`pk_…`). A public key can only add events, and can be limited to the channels a page needs. See [Keys](https://snekot.co/docs/keys).

Calls made before the script has loaded wait in a queue and run in order when it arrives.

| Command | |
|---|---|
| `snekot('setConfig', key, project, options)` | Required once. Options: `remember`, `outbound`, `downloads`, `channel` and `endpoint`. |
| `snekot('setUserId', id)` | Who is signed in. Pass `null` when they sign out. Remembered in the browser. |
| `snekot('clearUserId')` | The same as `setUserId(null)`. |
| `snekot('track', { channel, event, … })` | Posts an event. |
| `snekot('identify', { properties })` | Sets properties on the signed-in user. |
| `snekot('experiment', name, variants, callback)` | Which variant of an A/B test this visitor gets. |
| `snekot('subscribe', email, properties)` | Puts an address on the project's newsletter list. |
| `snekot('remember', true)` | Keeps a visitor id on the device from now on; `false` stops and removes it. |
| `snekot('setDebug', true)` | Logs what would be sent to the console, and sends nothing. The console says so once. |

### Without code

A click on an element with `data-event` posts that event:

```html
<button data-event="Upgrade clicked" data-channel="billing" data-icon="💰" data-tag-plan="Pro">Upgrade</button>
```

A `<form>` with `data-event` posts on submit, with each filled-in field as a tag. Password fields are left out, and so are card fields and any field whose name contains `pass`, `secret`, `token`, `csrf`, `card`, `cvc`, `cvv`, `ssn` or `iban`. A `<form data-snekot-subscribe>` with an email field sends the address to the project's newsletter list.

## What it keeps on a visitor's device

Nothing, by default: no cookie and no id. Two things change that, and both are yours to turn on:

- `setUserId(id)` keeps the id you gave in local storage, so the signed-in person stays the same across pages.
- `remember: true` makes up a random visitor id and keeps it in local storage. `snekot('remember', false)` removes it.

Including the script twice is harmless: a second copy steps aside, so nothing is counted twice.

A link's query string is never sent with an outbound-link event, and a visitor id that arrives in the address from a Snekot link page is taken back out of it.

The full reference is at [snekot.co/docs/browser](https://snekot.co/docs/browser). For React, Next.js and Vue, [`@snekot/sdk`](https://github.com/snekot-co/snekot-js) wraps this script.

## The feedback button

`feedback.js` is a second, separate script, also here exactly as served at `https://api.snekot.co/feedback.js`. It turns any element marked `data-feedback` into a button that asks whether it is an issue, an idea or something else, takes a note, and posts it as an event named `Feedback Submitted`.

```html
<script type="module" src="https://api.snekot.co/feedback.js"></script>

<button data-feedback data-feedback-token="YOUR_PUBLIC_KEY" data-feedback-project="your-project">Send feedback</button>
```

Optional attributes: `data-feedback-channel` (`feedback` if left out), `data-feedback-user-id`, `data-feedback-notify="false"` and `data-feedback-tag-<name>`. With no button of your own, `EventsFeedback.init({ token, project })` adds a floating one.

## Check

```bash
node --check snekot.js && node --check feedback.js
```

## Licence

MIT
