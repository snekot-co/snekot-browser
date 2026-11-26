/* Snekot browser script: page views and snekot('track', ...). Docs: https://snekot.co/docs/browser
   For assistants: https://snekot.co/llms.txt. With snekot('setDebug', true) nothing is sent; calls are logged to the console instead. */
(() => {
  // A page that includes the script twice, or a framework that adds it again, would otherwise count every page
  // view and click twice. The first copy is the one that runs; a later one steps aside.
  if (window.snekot && window.snekot.loaded) return;
  const API = "https://api.snekot.co";
  const USER_KEY = 'events:user-id';
  // `api` is where everything is sent. A site that passes the script and the API through its own domain names that
  // address as `endpoint`, so its visitors' browsers only ever talk to the site itself.
  const state = { token: null, project: null, debug: false, remember: false, api: API, outbound: false, downloads: false, channel: 'web' };
  const FILES = /\.(pdf|zip|gz|tar|rar|7z|dmg|pkg|exe|msi|apk|deb|rpm|iso|csv|xls|xlsx|doc|docx|ppt|pptx|txt|rtf|epub|mp3|wav|mp4|mov|avi|mkv)$/i;
  // Form fields that are never sent as tags, by what they are called. Password fields and fields the browser
  // knows hold a card or a password are left out too, whatever their name.
  const PRIVATE = /pass|secret|token|csrf|card|cvc|cvv|ssn|iban/i;
  const isPrivate = (form, name) => {
    if (PRIVATE.test(name)) return true;
    const field = form.elements.namedItem(name);
    if (!field || !('type' in field)) return false;
    return field.type === 'password' || /^cc-|password/.test(field.autocomplete || '');
  };
  // A visitor the site chose to remember: an id made up here and kept on this device, so the same person is
  // the same visitor tomorrow and from another network. Nothing is kept unless the site asks for it.
  const VISITOR_KEY = 'snekot:visitor';
  const visitor = () => {
    if (!state.remember) return undefined;
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = 'r_' + Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch { return undefined; }
  };
  const log = (...args) => state.debug && console.log('[snekot]', ...args);
  // Said once, whether or not debug is on: a page that never calls setConfig sends nothing, and should not do so silently.
  let warned = false;
  const unconfigured = () => { if (!warned) { warned = true; console.warn("[snekot] not configured: nothing is sent until snekot('setConfig', 'PUBLIC_KEY', 'project-slug') is called."); } };
  const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
  const stored = () => { try { return localStorage.getItem(USER_KEY) || undefined; } catch { return undefined; } };
  const seconds = (value) => {
    if (!value) return undefined;
    if (value instanceof Date) return Math.floor(value.getTime() / 1000);
    return value > 1e11 ? Math.floor(value / 1000) : value;
  };
  const send = (path, body) => {
    if (!state.token || !state.project) return unconfigured();
    const payload = { ...body, project: state.project };
    for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
    if (state.debug) return log(path, payload);
    fetch(state.api + path, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };
  const tagsOf = (element) => {
    const tags = {};
    for (const [key, value] of Object.entries(element.dataset)) {
      if (key.startsWith('tag') && key.length > 3) tags[kebab(key.slice(3)).replace(/^-/, '')] = value;
    }
    return tags;
  };
  const fromElement = (element, extraTags) => {
    const tags = { ...tagsOf(element), ...extraTags };
    return {
      channel: element.dataset.channel || 'events',
      event: element.dataset.event,
      description: element.dataset.description,
      icon: element.dataset.icon || '👆',
      user_id: element.dataset.userId || stored(),
      visitor_id: visitor(),
      tags: Object.keys(tags).length ? tags : undefined,
    };
  };

  let lastPage = null;
  // The variant each experiment answered with on this page, so asking twice sends one request.
  const assigned = {};
  // Whether each flag asked for on this page is on, for the same reason.
  const flags = {};
  const commands = {
    setConfig(token, project, options) {
      state.token = token; state.project = project;
      if (!options) return;
      if (options.remember) state.remember = true;
      if (options.endpoint) { try { state.api = new URL(options.endpoint, location.href).href.replace(/\/$/, ''); } catch {} }
      if (options.outbound) state.outbound = true;
      if (options.downloads) state.downloads = true;
      if (typeof options.channel === 'string' && options.channel) state.channel = options.channel;
    },
    // For a site that asks its visitors first: remember(true) once they agree, remember(false) to stop and forget.
    remember(flag = true) {
      state.remember = flag !== false;
      if (!state.remember) { try { localStorage.removeItem(VISITOR_KEY); } catch {} }
    },
    // The id this device keeps for its visitor, for a page to hand to its own server: what the server then posts
    // with it as "visitor_id" belongs to the same visitor as the page views. Undefined while nothing is remembered.
    visitorId(callback) {
      const id = visitor();
      if (typeof callback === 'function') callback(id);
      return id;
    },
    setDebug(flag = true) {
      state.debug = flag !== false;
      // Said once, out loud, so nobody wonders where their events went.
      if (state.debug) console.info('[snekot] debug is on: nothing is sent to Snekot. Each call is logged here instead. Turn it off to send.');
    },
    setUserId(id) {
      // A visitor who arrived through a tracked link and has now signed in: what they did as a visitor joins what they do as themselves.
      const before = stored();
      if (id && before && /^v_/.test(before) && String(id) !== before) send('/v1/alias', { user_id: String(id), previous_id: before });
      try { id ? localStorage.setItem(USER_KEY, String(id)) : localStorage.removeItem(USER_KEY); } catch {}
    },
    clearUserId() { commands.setUserId(null); },
    track(options) {
      const body = { ...options };
      body.user_id = body.user_id || stored();
      body.visitor_id = visitor();
      body.timestamp = seconds(body.timestamp);
      send('/v1/log', body);
    },
    // Who is signed in and what the site says about them, in one call: with a user_id it also remembers them, as
    // setUserId does, so their page views and events carry the id from here on. Nothing is read off the page;
    // a person has only the details the site passes here.
    identify(options) {
      if (options && options.user_id) commands.setUserId(options.user_id);
      const user = (options && options.user_id) || stored();
      if (user) send('/v1/identify', { ...options, user_id: String(user) });
    },
    group(options) { send('/v1/group', { ...options, user_id: (options && options.user_id) || stored() }); },
    // Which variant of an A/B test this visitor gets. The server works it out from who is asking, so the same
    // visitor gets the same answer on every page with nothing kept here, and it notes the exposure once a visit.
    // The answer comes to the callback and as a promise. If it cannot be had, it is the first variant.
    experiment(name, variants, callback) {
      const fallback = Array.isArray(variants) ? variants[0] : undefined;
      if (!assigned[name]) {
        assigned[name] = !state.token || !state.project || state.debug
          ? Promise.resolve(fallback)
          : fetch(state.api + '/v1/experiment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
              body: JSON.stringify({ project: state.project, experiment: name, variants, user_id: stored(), visitor_id: visitor() }),
            }).then((response) => (response.ok ? response.json() : null)).then((answer) => (answer && answer.variant) || fallback).catch(() => fallback);
        if (state.debug) log('/v1/experiment', { experiment: name, variants });
      }
      if (typeof callback === 'function') assigned[name].then(callback);
      return assigned[name];
    },
    // Whether a feature flag is on for this visitor: true or false, to the callback and as a promise. The server
    // works it out from who is asking, as it does a variant, so nothing is kept here. Asking twice on a page sends
    // one request. If the answer cannot be had, the flag is off.
    flag(key, callback) {
      if (!flags[key]) {
        flags[key] = !state.token || !state.project || state.debug
          ? Promise.resolve(false)
          : fetch(state.api + '/v1/flag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
              body: JSON.stringify({ project: state.project, flag: key, user_id: stored(), visitor_id: visitor() }),
            }).then((response) => (response.ok ? response.json() : null)).then((answer) => !!answer && answer.on === true).catch(() => false);
        if (state.debug) log('/v1/flag', { flag: key });
      }
      if (typeof callback === 'function') flags[key].then(callback);
      return flags[key];
    },
    // Puts an address on the project's newsletter list. The answer comes to the callback and as a promise: true
    // once the server has it, false when it was refused or could not be reached, so a form can say which.
    // The language and the time zone are the browser's own unless the page says otherwise, so a list knows who
    // reads what, and when their morning is.
    subscribe(email, properties, options, callback) {
      let zone;
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (error) { /* A browser too old to say. */ }
      const body = { project: state.project, email, properties: properties || undefined, name: (options && options.name) || undefined, language: (options && options.language) || navigator.language || undefined, timezone: (options && options.timezone) || zone || undefined, source: location.pathname.slice(0, 500), visitor_id: visitor() };
      let result;
      if (!state.token || !state.project) { unconfigured(); result = Promise.resolve(false); }
      else if (state.debug) { log('/v1/subscribe', body); result = Promise.resolve(true); }
      else result = fetch(state.api + '/v1/subscribe', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
        body: JSON.stringify(body),
      }).then((response) => response.ok).catch(() => false);
      if (typeof callback === 'function') result.then(callback);
      return result;
    },
    // The id to hand a checkout, so the payment it reports lands on whoever is on this page: the person's own id
    // when the site has said who they are, else the visitor their page views carry. It is made only of letters,
    // digits, dashes and underscores, which is all a payment link's address lets through. Nothing is kept here
    // for it. The answer comes to the callback and as a promise; with nothing to go by it is undefined, and the
    // checkout goes on without it.
    checkoutId(callback) {
      const user = stored();
      const kept = visitor();
      let id;
      if (user) {
        if (/^[A-Za-z0-9_-]+$/.test(user)) id = 'snekot-u-' + user;
        else { try { id = 'snekot-b-' + btoa(String.fromCharCode(...new TextEncoder().encode(user))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch {} }
        // A payment service takes 200 characters at most, and refuses the whole checkout for one more.
        if (id && id.length > 200) id = undefined;
      }
      if (!id && kept) id = 'snekot-v-' + kept;
      let result;
      if (id) result = Promise.resolve(id);
      else if (!state.token || !state.project) { unconfigured(); result = Promise.resolve(undefined); }
      else if (state.debug) { log('/v1/visitor', { project: state.project }); result = Promise.resolve(undefined); }
      else result = fetch(state.api + '/v1/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token },
        body: JSON.stringify({ project: state.project }),
      }).then((response) => (response.ok ? response.json() : null)).then((answer) => (answer && answer.checkout_id) || undefined).catch(() => undefined);
      if (typeof callback === 'function') result.then(callback);
      return result;
    },
    trackPageView() {
      // A visitor nobody has named is counted too, with no id and nothing kept in the browser.
      const user = stored();
      lastPage = location.href;
      const params = new URLSearchParams(location.search);
      const utm = params.get('utm_source') || undefined;
      send('/v1/page', {
        user_id: user,
        visitor_id: visitor(),
        version: '0.0.1',
        payload: { path: location.pathname, title: document.title, user_agent: navigator.userAgent, referrer: document.referrer || undefined, utm_source: utm, utm_medium: params.get('utm_medium') || undefined, utm_campaign: params.get('utm_campaign') || undefined, utm_term: params.get('utm_term') || undefined, utm_content: params.get('utm_content') || undefined, host: location.host, language: navigator.language || undefined, screen_width: window.innerWidth || undefined, ref: params.get('ref') || params.get('utm_referrer') || undefined },
      });
    },
  };

  // A tracked link hands its visitor over in the address. Keep the id, unless someone is already signed in
  // here, and take it back out of the address so it is not bookmarked or shared.
  try {
    const here = new URL(location.href);
    const visitor = here.searchParams.get('ev_vid');
    if (visitor) {
      if (/^v_[A-Za-z0-9_-]{16,}$/.test(visitor) && !stored()) localStorage.setItem(USER_KEY, visitor);
      here.searchParams.delete('ev_vid');
      history.replaceState(history.state, '', here.pathname + here.search + here.hash);
    }
  } catch {}

  // The script counts a page by itself when the address changes. A site whose router hides its navigation from
  // this script calls snekot('trackPageView') itself; the address it counted is remembered, so no page is counted twice.
  let pageTimer = null;
  const pageSoon = () => { clearTimeout(pageTimer); pageTimer = setTimeout(() => { if (location.href !== lastPage) commands.trackPageView(); }, 500); };
  const pushState = history.pushState;
  history.pushState = function (...args) { const result = pushState.apply(this, args); pageSoon(); return result; };
  addEventListener('popstate', pageSoon);
  addEventListener('hashchange', pageSoon);
  if (document.readyState === 'complete') pageSoon(); else addEventListener('load', pageSoon);

  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target.closest('[data-event]') : null;
    if (element && element.tagName !== 'FORM') send('/v1/log', fromElement(element));
  });
  // Links that leave the site, and links to files, for a site that asked for them. The event is sent as the
  // click happens and the browser is not held back: the request is marked to outlive the page it was sent from.
  const followed = (event) => {
    if (!state.outbound && !state.downloads) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    const common = { channel: state.channel, user_id: stored(), visitor_id: visitor() };
    const name = (() => { try { return decodeURIComponent(url.pathname.split('/').pop() || ''); } catch { return url.pathname.split('/').pop() || ''; } })();
    const type = (FILES.exec(url.pathname) || [])[1];
    if (state.downloads && (type || link.hasAttribute('download'))) {
      const tags = { file: (name || url.host).slice(0, 200), host: url.host, page: location.pathname.slice(0, 500) };
      if (type) tags.type = type.toLowerCase();
      send('/v1/log', { ...common, event: "File downloaded", icon: '📥', tags });
    } else if (state.outbound && url.host !== location.host) {
      // The address is kept without its query string, which is where a link carries what is private to the visitor.
      send('/v1/log', { ...common, event: "Outbound link clicked", icon: '↗️', tags: { host: url.host, url: (url.origin + url.pathname).slice(0, 500), page: location.pathname.slice(0, 500) } });
    }
  };
  document.addEventListener('click', followed, true);
  // A middle click opens a link in a new tab, and is no click as far as the page is told.
  document.addEventListener('auxclick', (event) => { if (event.button === 1) followed(event); }, true);

  // A signup form needs no code: <form data-snekot-subscribe> with an email field in it. The page stays where it
  // is; the form is marked with how it went, and anything inside it marked data-snekot-success or
  // data-snekot-error is shown when that is the outcome, so the site words its own thanks.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-snekot-subscribe')) return;
    event.preventDefault();
    if (form.dataset.snekotState === 'sending') return;
    const field = form.querySelector('input[type=email], input[name=email]');
    const email = field ? field.value.trim() : '';
    const named = form.querySelector('input[name=name]');
    const show = (state) => {
      form.dataset.snekotState = state;
      form.querySelectorAll('[data-snekot-success]').forEach((element) => { element.hidden = state !== 'done'; });
      form.querySelectorAll('[data-snekot-error]').forEach((element) => { element.hidden = state !== 'error'; });
    };
    if (!email) return show('error');
    show('sending');
    const tags = tagsOf(form);
    commands.subscribe(email, Object.keys(tags).length ? tags : undefined, { name: (named && named.value.trim()) || undefined, language: form.getAttribute('data-snekot-language') || undefined }).then((ok) => {
      show(ok ? 'done' : 'error');
      if (ok) form.reset();
      form.dispatchEvent(new CustomEvent(ok ? 'snekot:subscribed' : 'snekot:subscribe-failed', { bubbles: true, detail: { email } }));
    });
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.event) return;
    const fields = {};
    for (const [name, value] of new FormData(form).entries()) {
      if (typeof value === 'string' && value !== '' && !isPrivate(form, name)) fields[kebab(name)] = value;
    }
    send('/v1/log', fromElement(form, fields));
  });

  const run = (args) => { const [name, ...rest] = args; if (typeof commands[name] === 'function') return commands[name](...rest); };
  // Calls made before the script arrived wait in a queue.
  const queued = Array.isArray(window.snekotq) ? window.snekotq : [];
  window.snekotq = { push: run };
  window.snekot = (...args) => run(args);
  window.snekot.loaded = true;
  queued.forEach((args) => run(Array.from(args)));
})();
