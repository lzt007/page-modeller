import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import dom from './dom';
import profiles from '../profiles/profiles';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

export default class ModelBuilder {
  deDupeName(name) {
    let returnName = name;

    if (name in this.model.usedNames) {
      this.model.usedNames[name] += 1;
      returnName = `${name}${this.model.usedNames[name]}`;
    } else {
      this.model.usedNames[name] = 1;
    }
    return returnName;
  }

  static maxNameLength(name) {
    return name.substring(0, 20);
  }

  replaceSymbols(name) {
    let ret = name;
    const matches = name.match(/[-!$%^&*()+|~=`{}\[\]:";'<>?,.\/\\]/g);
    if (matches === null) {
      return name;
    }
    const replacements = {
      '-': '_dash',
      '!': '_exclamation',
      $: '_dollar',
      '%': '_percent',
      '^': '_caret',
      '&': '_ampersand',
      '*': '_asterisk',
      '(': '_lBracket',
      ')': '_rBracket',
      '+': '_plus',
      '|': '_pipe',
      '~': '_tilde',
      '=': '_equals',
      '`': '_backtick',
      '{': '_lbrace',
      '}': '_rbrace',
      '[': '_lSquareBracket',
      ']': '_rSquareBracket',
      ':': '_colon',
      '"': '_quote',
      ';': '_semicolon',
      "'": '_singleQuote',
      '<': '_lt',
      '>': '_gt',
      '?': '_questionMark',
      ',': '_comma',
      '.': '_dot',
      '/': '_forwardSlash',
      '\\': '_backSlash',
    };
    matches.forEach(m => {
      ret = ret.split(m).join(replacements[m]);
    });
    return ret;
  }

  cleanName(name) {
    const ret = this.replaceSymbols(name);
    const cc = camelCase(ret) || ret; // accommodate for weird bug which results in empty string for single character!
    return this.deDupeName(upperFirst(ModelBuilder.maxNameLength(cc)));
  }

  generateName(element) {
    const id = dom.getId(element);
    const name = dom.getName(element);
    const textContent = dom.getTextContent(element);
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'PROGRESS', 'METER'].includes(tagName)) {
      const label = dom.getLabel(element);
      const labelName = label ? label.textContent.trim() : '';

      if (labelName) {
        return this.cleanName(labelName);
      }

      if (tagName === 'BUTTON' || ['submit', 'reset'].includes(element.type)) {
        const val = element.value.trim();
        if (val) {
          return this.cleanName(val);
        }
      }
    }

    if (name) {
      return this.cleanName(name);
    }
    if (id) {
      return this.cleanName(id);
    }

    if (tagName === 'A' && element.href && element.href.startsWith('mailto:')) {
      return this.cleanName(`${element.href.replace('mailto:', '').split('@')[0]}EmailLink`);
    }

    if (textContent) {
      let n = this.cleanName(textContent);
      if (!n.match(/^\w+$/)) {
        n = `${tagName}${n}`;
      }
      return n;
    }

    return this.cleanName(`${tagName}${tagIndex}`);
  }

  static createEmptyModel() {
    return {
      usedNames: {},
      entities: [],
    };
  }

  createModel({ element, activeProfile, appOptions, existingModel = null }) {
    console.log('createModel');

    this.model = existingModel || ModelBuilder.createEmptyModel();
    this.activeProfile = activeProfile;
    if (existingModel) {
      this.model.entities.push(this.createEntity(element));
      return this.model;
    }

    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (dom.isVisible(node) || appOptions.modelHiddenElements) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT; // node and children
        },
      },
      true
    );
    while (walker.nextNode()) {
      const childElement = walker.currentNode;
      if (INTERACTIVE_ELEMENTS.includes(childElement.tagName)) {
        this.model.entities.push(this.createEntity(childElement));
      }
    }
    return this.model.entities.length === 0 ? null : this.model;
  }

  createEntity(element) {
    return {
      name: this.generateName(element),
      locators: this.getLocators(element),
      tagName: dom.getTagName(element),
      type: dom.getTagType(element),
    };
  }

  getLocators(element) {
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    const possibleLocators = [
      {
        name: 'id',
        locator: dom.getId(element),
      },
      {
        name: 'linkText',
        locator: dom.getLinkText(element),
      },
      {
        name: 'partialLinkText',
        locator: dom.getLinkText(element),
      },
      {
        name: 'name',
        locator: dom.getName(element),
      },
      {
        name: 'css',
        locator: dom.getCssSelector(element),
      },
      {
        name: 'xpath',
        locator: dom.getXPath(element),
      },
      {
        name: 'className',
        locator: dom.getClassName(element),
      },
      {
        name: 'tagName',
        locator: tagName,
      },
      {
        name: 'tagIndex',
        locator: `${tagName}${tagIndex}`,
        selected: true,
        always: true,
        hidden: true,
      },
    ];
    const profile = profiles.find(p => p.name === this.activeProfile);

    const locators = [];
    possibleLocators.forEach(l => {
      if (profile.locators.includes(l.name) || l.always) {
        locators.push(l);
      }
    });
    console.log('locators');
    for (let selectedLocator = locators[locators.length - 1], currentLocator, i = 0; i < locators.length; i += 1) {
      currentLocator = locators[i];
      console.log(`current: ${currentLocator.name} : ${currentLocator.locator}`);
      if (currentLocator.locator) {
        delete selectedLocator.selected;
        currentLocator.selected = true;
        console.log(`selected: ${currentLocator.name} : ${currentLocator.locator}`);
        break;
      }
    }

    return locators;
  }
}
