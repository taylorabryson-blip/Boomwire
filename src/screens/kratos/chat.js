/** Ask Kratos — chat with the coach (secondary to the button-driven dashboard). */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { kratosAvatar } from '../../components/brand.js';
import { NavHeader, IconButton } from '../../components/primitives.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { listMessages, sendToKratos, ensureGreeting, getPlan } from '../../services/coach.js';
import { PlanCard } from './plan-card.js';

const SUGGESTIONS = [
  'What’s today?',
  'When do I eat?',
  'What should I train?',
  'I don’t feel like it',
  'Rebuild my plan',
  'I work 7 to 3 on weekdays',
];

export async function mount(root) {
  root.classList.add('screen--chat');
  await ensureGreeting();
  const chat = h('div', { class: 'chat' });
  root.append(
    NavHeader({ title: 'Ask Kratos', back: { href: '#/kratos', label: 'Kratos' } }),
    chat);

  const input = h('textarea', { rows: 1, placeholder: 'Tell Kratos your schedule…', enterkeyhint: 'send', 'aria-label': 'Message Kratos' });
  const send = h('button', { class: 'composer__send', type: 'button', 'aria-label': 'Send', disabled: true }, icon('send', 18));
  const chips = h('div', { class: 'chips chips--scroll' }, SUGGESTIONS.map((t) => h('button', { class: 'chip', type: 'button', onClick: () => submit(t) }, t)));
  const composer = h('div', { class: 'composer' }, h('div', { class: 'composer__inner' }, chips, h('div', { class: 'composer__bar' }, input, send)));
  document.body.append(composer);

  const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; send.disabled = !input.value.trim(); };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); } });
  send.addEventListener('click', () => submit(input.value));

  let busy = false;
  async function submit(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true; haptic();
    input.value = ''; grow();
    chat.append(h('div', { class: 'msg msg--user' }, text));
    const typing = h('div', { class: 'msg-row' }, kratosAvatar(28), h('div', { class: 'msg msg--kratos typing' }, h('i'), h('i'), h('i')));
    chat.append(typing);
    scrollDown();
    const [_] = await Promise.all([sendToKratos(text), new Promise((r) => setTimeout(r, 650))]);
    typing.remove();
    await draw();
    haptic('success');
    busy = false;
  }

  async function draw() {
    const [msgs, plan] = await Promise.all([listMessages(), getPlan()]);
    const lastPlanIdx = msgs.map((m) => m.card?.type).lastIndexOf('plan');
    let lastDate = null;
    const nodes = [];
    msgs.forEach((m, i) => {
      if (m.date !== lastDate) {
        lastDate = m.date;
        nodes.push(h('div', { class: 'msg-time' }, new Date(m.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })));
      }
      if (m.role === 'user') nodes.push(h('div', { class: 'msg msg--user selectable' }, m.text));
      else {
        nodes.push(h('div', { class: 'msg-row' }, kratosAvatar(28), h('div', { class: 'msg msg--kratos selectable' }, m.text)));
        if (m.card?.type === 'plan' && i === lastPlanIdx && plan) nodes.push(PlanCard(plan));
      }
    });
    chat.replaceChildren(...nodes);
    scrollDown();
  }
  const scrollDown = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));

  await draw();
  const off = repo.onChange(({ store }) => { if (store === 'coach' && !busy) draw(); });
  return () => { off(); composer.remove(); };
}
