(() => {
  const API = "https://api.snekot.co";
  const TYPES = [['issue', '⚠️', 'Issue'], ['idea', '💡', 'Idea'], ['other', '💬', 'Other']];
  const CSS = `
    .snekot-fb-backdrop{position:fixed;inset:0;background:rgb(0 0 0/.4);display:grid;place-items:center;z-index:2147483000;font:15px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
    .snekot-fb-card{width:min(360px,calc(100vw - 32px));min-height:252px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;padding:20px;border-radius:20px;background:#fff;color:#121212;box-shadow:0 20px 100px rgb(0 0 0/.12);border:1px solid #ececec}
    .snekot-fb-card h2{margin:0;font-size:17px;font-weight:600}
    .snekot-fb-types{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .snekot-fb-type{min-height:76px;display:grid;place-items:center;gap:4px;padding:10px;border-radius:12px;border:1px solid #ececec;background:#fafafa;color:inherit;font:inherit;cursor:pointer}
    .snekot-fb-type[aria-pressed=true]{border-color:#171717;background:#f4f4f4}
    .snekot-fb-card textarea{flex:1;min-height:120px;resize:none;box-sizing:border-box;width:100%;padding:12px;border-radius:12px;border:1px solid #ececec;background:#fafafa;color:inherit;font:inherit;font-size:16px}
    .snekot-fb-card textarea:focus-visible,.snekot-fb-type:focus-visible,.snekot-fb-go:focus-visible{outline:2px solid #171717;outline-offset:2px}
    .snekot-fb-go{margin-top:auto;min-height:44px;border:0;border-radius:9999px;background:#171717;color:#fff;font:inherit;font-weight:500;cursor:pointer}
    .snekot-fb-go:disabled{opacity:.4;cursor:default}
    .snekot-fb-thanks{flex:1;display:grid;place-items:center;text-align:center;gap:8px;font-size:17px;font-weight:600}
    .snekot-fb-float{position:fixed;bottom:16px;left:16px;width:48px;height:48px;border-radius:9999px;border:1px solid #ececec;background:#fff;font-size:20px;cursor:pointer;box-shadow:0 3px 16px rgb(0 0 0/.1);z-index:2147482999}
    .snekot-fb-float.right{left:auto;right:16px}
    @media (prefers-color-scheme:dark){.snekot-fb-card{background:#151515;color:#f5f5f5;border-color:#242424}.snekot-fb-type,.snekot-fb-card textarea{background:#1b1b1b;border-color:#242424}.snekot-fb-type[aria-pressed=true]{border-color:#f5f5f5;background:#242424}.snekot-fb-go{background:#f5f5f5;color:#121212}.snekot-fb-float{background:#151515;border-color:#242424}.snekot-fb-card textarea:focus-visible,.snekot-fb-type:focus-visible,.snekot-fb-go:focus-visible{outline-color:#f5f5f5}}
  `;
  let styled = false;
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    children.forEach((child) => node.append(child));
    return node;
  };

  function open(trigger) {
    if (!styled) { document.head.append(el('style', { textContent: CSS })); styled = true; }
    const data = read(trigger);
    if (!data.token || !data.project) console.error('[snekot] feedback: missing token or project');
    let type = 'idea';
    const card = el('div', { className: 'snekot-fb-card', role: 'dialog', ariaModal: 'true' });
    const backdrop = el('div', { className: 'snekot-fb-backdrop' }, [card]);
    let closeTimer = null;
    const close = () => { clearTimeout(closeTimer); backdrop.remove(); removeEventListener('keydown', onKey); trigger.focus && trigger.focus(); };
    const onKey = (event) => event.key === 'Escape' && close();
    backdrop.addEventListener('click', (event) => event.target === backdrop && close());
    addEventListener('keydown', onKey);

    // Each step replaces the card's content in place; the card keeps one size throughout.
    const show = (...nodes) => { card.replaceChildren(...nodes); const focus = card.querySelector('textarea,button'); focus && focus.focus(); };
    const stepType = () => {
      const buttons = TYPES.map(([value, icon, label]) => {
        const button = el('button', { className: 'snekot-fb-type', type: 'button', ariaPressed: String(value === type) }, [el('span', { textContent: icon }), el('span', { textContent: label })]);
        button.addEventListener('click', () => { type = value; buttons.forEach((other) => (other.ariaPressed = String(other === button))); });
        return button;
      });
      const next = el('button', { className: 'snekot-fb-go', type: 'button', textContent: 'Next' });
      next.addEventListener('click', stepNote);
      show(el('h2', { textContent: 'What is this about?' }), el('div', { className: 'snekot-fb-types' }, buttons), next);
    };
    const stepNote = () => {
      const note = el('textarea', { placeholder: 'Tell us more', ariaLabel: 'Your feedback' });
      const submit = el('button', { className: 'snekot-fb-go', type: 'button', textContent: 'Submit', disabled: true });
      note.addEventListener('input', () => (submit.disabled = note.value.trim() === ''));
      submit.addEventListener('click', () => { send(note.value.trim()); stepThanks(); });
      show(el('h2', { textContent: 'Your feedback' }), note, submit);
    };
    const stepThanks = () => {
      const done = el('button', { className: 'snekot-fb-go', type: 'button', textContent: 'Close' });
      done.addEventListener('click', close);
      show(el('div', { className: 'snekot-fb-thanks' }, [el('div', { textContent: '🙏🏻' }), el('div', { textContent: 'Thank you!' })]), done);
      closeTimer = setTimeout(close, 5000);
    };
    const send = (description) => {
      const tags = { type };
      Object.assign(tags, data.tags);
      const body = {
        event: 'Feedback Submitted',
        project: data.project,
        channel: data.channel || 'feedback',
        description,
        tags,
        notify: data.notify !== 'false',
        icon: TYPES.find(([value]) => value === type)[1],
      };
      if (data.userId) body.user_id = data.userId;
      fetch(API + '/v1/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
        body: JSON.stringify(body),
      }).catch((error) => console.error('[snekot]', error));
    };

    document.body.append(backdrop);
    stepType();
  }

  /**
   * What a trigger says about itself: `data-feedback-token`, `-project`, `-channel`, `-user-id`, `-notify`
   * and `data-feedback-tag-<name>`.
   */
  const read = (trigger) => {
    const set = trigger.dataset;
    const pick = (name) => set['feedback' + name];
    const tags = {};
    for (const [key, value] of Object.entries(set)) {
      const match = key.match(/^feedbackTag(.+)$/);
      if (match) tags[match[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()] = value;
    }
    return { token: pick('Token'), project: pick('Project'), channel: pick('Channel'), userId: pick('UserId'), notify: pick('Notify'), tags };
  };

  const mount = () => document.querySelectorAll('[data-feedback]').forEach((trigger) => {
    if (trigger.dataset.snekotMounted) return;
    trigger.dataset.snekotMounted = 'true';
    trigger.addEventListener('click', () => open(trigger));
  });
  window.EventsFeedback = {
    /** Adds a floating button, or turns `config.element` into the trigger. */
    init(config = {}, style = {}) {
      if (!styled) { document.head.append(el('style', { textContent: CSS })); styled = true; }
      const trigger = config.element || el('button', { className: 'snekot-fb-float' + (style.position === 'right' ? ' right' : ''), type: 'button', textContent: '💬', ariaLabel: 'Send feedback' });
      trigger.dataset.feedback = '';
      for (const [key, name] of [['token', 'feedbackToken'], ['project', 'feedbackProject'], ['channel', 'feedbackChannel'], ['userId', 'feedbackUserId']]) {
        if (config[key]) trigger.dataset[name] = config[key];
      }
      if (config.notify === false) trigger.dataset.feedbackNotify = 'false';
      if (!config.element) document.body.append(trigger);
      mount();
    },
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
  addEventListener('load', mount);
})();
