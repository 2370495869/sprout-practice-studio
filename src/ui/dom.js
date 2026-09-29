import sproutImageUrl from '../../assets/sprout.svg';

export function element(tagName, { className, text, attrs = {}, children = [] } = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);

  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, String(value));
  }

  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function button(text, { className = 'button', onClick, type = 'button', attrs = {} } = {}) {
  const node = element('button', {
    className,
    text,
    attrs: { type, ...attrs },
  });
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

export function clear(node) {
  node.replaceChildren();
}

export function setStatus(node, message, tone = 'neutral') {
  node.textContent = message;
  node.dataset.tone = tone;
}

export function makeBrand() {
  const brand = element('a', {
    className: 'brand',
    attrs: { href: 'index.html', 'aria-label': '小芽练习室首页' },
  });
  brand.append(
    element('img', {
      className: 'brand__mark',
      attrs: { src: sproutImageUrl, alt: '', 'aria-hidden': 'true' },
    }),
  );
  const name = element('span', { className: 'brand__name' });
  name.append(
    element('strong', { text: '小芽练习室' }),
    element('span', { text: 'SPROUT PRACTICE STUDIO', attrs: { lang: 'en' } }),
  );
  brand.append(name);
  return brand;
}

export { sproutImageUrl };

export function makeStatus(className = 'status-message') {
  return element('p', {
    className,
    attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
}
