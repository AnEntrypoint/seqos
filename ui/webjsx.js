console.log('webjsx.js loading...');

import { createDOMElement, Fragment } from '../node_modules/webjsx/dist/index.js';

console.log('webjsx imports successful');

export function h(tag, props = {}, ...children) {
  if (typeof tag === 'function') {
    return tag(props);
  }

  const element = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'string') {
        element.setAttribute('style', value);
      } else if (key === 'dangerouslySetInnerHTML') {
        element.innerHTML = value.__html;
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key !== 'children' && key !== 'key') {
        element.setAttribute(key, String(value));
      }
    }
  }

  const addChild = (child) => {
    if (!child && child !== 0 && child !== '') return;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    } else if (Array.isArray(child)) {
      child.forEach(addChild);
    }
  };

  children.forEach(addChild);

  return element;
}

export { Fragment, createDOMElement };

export function defineComponent(name, renderFn) {
  class Component extends HTMLElement {
    connectedCallback() {
      const props = this.getProps();
      const vdom = renderFn(props);
      this.innerHTML = '';
      if (vdom instanceof Node) {
        this.appendChild(vdom);
      } else if (Array.isArray(vdom)) {
        vdom.forEach(child => {
          if (child instanceof Node) this.appendChild(child);
          else if (typeof child === 'string') this.appendChild(document.createTextNode(child));
        });
      }
    }

    disconnectedCallback() {
      this.innerHTML = '';
    }

    getProps() {
      const props = {};
      for (const attr of this.attributes) {
        try {
          props[attr.name] = JSON.parse(attr.value);
        } catch {
          props[attr.name] = attr.value;
        }
      }
      return props;
    }
  }

  customElements.define(`seq-${name}`, Component);
  return Component;
}
