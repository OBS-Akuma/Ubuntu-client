/**
 * Adds persistent Crosshair and Hitmarker presets to the
 * General settings page.
 *
 * Electron 10.4.7 / Chromium 85 compatible.
 *
 * - Adds "Save Crosshair" above Crosshair settings
 * - Adds "Save Hitmarker" above Hitmarker settings
 * - Saves the exact preview SVG currently displayed
 * - Saves all Crosshair/Hitmarker settings
 * - Displays saved preset image before its name
 * - Adds Use and Remove buttons
 * - Auto-names presets "<type> #N"
 * - Restores presets after leaving/reopening settings
 * - Uses Settings_ubuntu as the localStorage key
 * - Avoids continuously rebuilding the UI
 *
 * Chromium 85 compatibility notes:
 * - window.prompt / alert / confirm are NOT supported in Electron.
 * - Uses document-level event delegation so Vue re-renders
 *   cannot orphan per-button listeners.
 * - Avoids structuredClone, Array.prototype.at, Object.hasOwn,
 *   replaceAll, and :has() which are not in Chromium 85.
 */

const settingsUbuntuAddon = () => {
  'use strict';

  const STORAGE_KEY = 'Settings_ubuntu';

  let observer = null;
  let renderTimeout = null;
  let isRendering = false;
  let delegationInstalled = false;

  // ============================================================
  // STORAGE
  // ============================================================

  const getStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return {
          crosshair: {},
          hitmarker: {}
        };
      }

      const data = JSON.parse(raw);

      return {
        crosshair: data.crosshair || {},
        hitmarker: data.hitmarker || {}
      };
    } catch (err) {
      console.error(
        '[Settings Ubuntu] Failed to read storage:',
        err
      );

      return {
        crosshair: {},
        hitmarker: {}
      };
    }
  };

  const setStorage = data => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error(
        '[Settings Ubuntu] Failed to save storage:',
        err
      );
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const getText = element => {
    if (!element) {
      return '';
    }

    const raw = element.textContent || '';

    return raw
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getLabel = row => {
    if (!row) {
      return '';
    }

    const label = row.querySelector('.label');

    if (!label) {
      return '';
    }

    const parts = [];

    label.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      }
    });

    return parts
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // ============================================================
  // AUTO NAME
  //
  // Produces "<type> #N" where N is the smallest positive
  // integer not already used in the storage bucket for that
  // type. Example: crosshair #1, crosshair #2, crosshair #3...
  // ============================================================

  const buildAutoName = (type, existing) => {
    const used = {};

    Object.keys(existing || {}).forEach(name => {
      used[name] = true;
    });

    let n = 1;

    while (used[type + ' #' + n]) {
      n += 1;
    }

    return type + ' #' + n;
  };

  // ============================================================
  // FIND CROSSHAIR / HITMARKER SECTIONS
  // ============================================================

  const getSection = name => {
    const headers = [
      ...document.querySelectorAll(
        '.general-content .header'
      )
    ];

    const header = headers.find(
      element => getText(element) === name
    );

    if (!header) {
      return null;
    }

    const rows = [];
    const previews = [];

    let node = header.nextElementSibling;

    while (node) {
      if (node.classList.contains('header')) {
        break;
      }

      if (node.classList.contains('element')) {
        rows.push(node);
      }

      if (
        node.classList.contains(
          'crosshair-preview-container'
        )
      ) {
        previews.push(node);
      }

      node = node.nextElementSibling;
    }

    return {
      header: header,
      rows: rows,
      previews: previews
    };
  };

  // ============================================================
  // GET EXACT CURRENT PREVIEW IMAGE
  // ============================================================

  const getCurrentImage = section => {
    if (!section) {
      return null;
    }

    const preview = section.previews[0];

    if (!preview) {
      return null;
    }

    return (
      preview.querySelector('img.crosshair-preview') ||
      preview.querySelector('img')
    );
  };

  // ============================================================
  // READ SETTINGS
  // ============================================================

  const readSettings = section => {
    const settings = {};

    if (!section) {
      return settings;
    }

    section.rows.forEach(row => {
      if (row.hasAttribute('data-settings-ubuntu')) {
        return;
      }

      const label = getLabel(row);

      if (!label) {
        return;
      }

      const color = row.querySelector(
        'input[type="color"]'
      );

      if (color) {
        settings[label] = {
          type: 'color',
          value: color.value
        };

        return;
      }

      const range = row.querySelector(
        'input[type="range"]'
      );

      if (range) {
        settings[label] = {
          type: 'range',
          value: range.value
        };

        return;
      }

      const select = row.querySelector(
        '.wrapper-input.select'
      );

      if (select) {
        const selected = select.querySelector('.selected');

        settings[label] = {
          type: 'select',
          value: select.getAttribute('value'),
          text: getText(selected)
        };
      }
    });

    return settings;
  };

  // ============================================================
  // SET INPUT VALUE
  // ============================================================

  const setInputValue = (input, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    );

    const setter = descriptor && descriptor.set;

    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(
      new Event('input', { bubbles: true })
    );

    input.dispatchEvent(
      new Event('change', { bubbles: true })
    );
  };

  // ============================================================
  // RESTORE SAVED SETTINGS
  // ============================================================

  const restoreSettings = (section, preset) => {
    if (!section || !preset || !preset.settings) {
      return;
    }

    section.rows.forEach(row => {
      if (row.hasAttribute('data-settings-ubuntu')) {
        return;
      }

      const label = getLabel(row);

      if (!label) {
        return;
      }

      const saved = preset.settings[label];

      if (!saved) {
        return;
      }

      if (saved.type === 'color') {
        const input = row.querySelector(
          'input[type="color"]'
        );

        if (input) {
          setInputValue(input, saved.value);
        }

        return;
      }

      if (saved.type === 'range') {
        const input = row.querySelector(
          'input[type="range"]'
        );

        if (input) {
          setInputValue(input, saved.value);
        }

        return;
      }

      if (saved.type === 'select') {
        const select = row.querySelector(
          '.wrapper-input.select'
        );

        if (!select) {
          return;
        }

        const options = [
          ...select.querySelectorAll('.items > div')
        ];

        const option = options.find(
          item => getText(item) === saved.text
        );

        if (option) {
          option.click();
        }
      }
    });
  };

  // ============================================================
  // CREATE GAME-STYLE BUTTON
  // ============================================================

  const createButton = label => {
    const template = document.querySelector('#import');

    if (!template) {
      console.warn(
        '[Settings Ubuntu] #import template not found.'
      );

      return null;
    }

    const button = template.cloneNode(true);

    button.removeAttribute('id');
    button.type = 'button';

    button.style.pointerEvents = 'auto';
    button.style.position = 'relative';
    button.style.zIndex = '10';
    button.style.cursor = 'pointer';
    button.style.color = '#ffffff';
    button.style.textShadow = 'none';
    button.style.filter = 'none';

    const overlays = button.querySelectorAll(
      '.WmWMwNwn, .triangle'
    );

    overlays.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    const text = button.querySelector('.text');

    if (text) {
      text.textContent = ' ' + label + ' ';
      text.style.fontSize = '16px';
      text.style.fontWeight = '600';
      text.style.color = '#ffffff';
      text.style.textShadow = 'none';
      text.style.filter = 'none';
      text.style.pointerEvents = 'none';
    }

    return button;
  };

  // ============================================================
  // SAVE PRESET (AUTO-NAMED)
  // ============================================================

  const savePreset = (type, section) => {
    const image = getCurrentImage(section);

    if (!image) {
      console.error(
        '[Settings Ubuntu] Could not find the ' +
          type +
          ' preview image.'
      );

      return;
    }

    const imageSrc = image.getAttribute('src');

    if (!imageSrc) {
      console.error(
        '[Settings Ubuntu] ' + type + ' preview has no src.'
      );

      return;
    }

    const storage = getStorage();

    if (!storage[type]) {
      storage[type] = {};
    }

    const cleanName = buildAutoName(type, storage[type]);

    storage[type][cleanName] = {
      imageSrc: imageSrc,
      settings: readSettings(section),
      savedAt: Date.now()
    };

    setStorage(storage);

    console.log(
      '[Settings Ubuntu] Saved ' + type + ': ' + cleanName
    );

    renderAll();
  };

  // ============================================================
  // CREATE SAVE ROW
  // ============================================================

  const createSaveRow = (type, section) => {
    const template = section.rows.find(
      row => !row.hasAttribute('data-settings-ubuntu')
    );

    if (!template) {
      return null;
    }

    const row = template.cloneNode(true);

    row.setAttribute(
      'data-settings-ubuntu',
      type + '-save'
    );

    const label = row.querySelector('.label');
    const right = row.querySelector('.right');

    if (!label || !right) {
      return null;
    }

    label.textContent = 'Save';

    right.innerHTML = '';

    const button = createButton(
      type === 'crosshair'
        ? 'Save Crosshair'
        : 'Save Hitmarker'
    );

    if (!button) {
      return null;
    }

    button.setAttribute(
      'data-settings-ubuntu-action',
      'save'
    );

    button.setAttribute(
      'data-settings-ubuntu-type',
      type
    );

    right.appendChild(button);

    return row;
  };

  // ============================================================
  // CREATE SAVED PRESET ROW
  // ============================================================

  const createSavedRow = (type, section, name, preset) => {
    const template = section.rows.find(
      row => !row.hasAttribute('data-settings-ubuntu')
    );

    if (!template) {
      return null;
    }

    const row = template.cloneNode(true);

    row.setAttribute(
      'data-settings-ubuntu',
      type + '-saved'
    );

    row.setAttribute(
      'data-settings-ubuntu-preset',
      name
    );

    const label = row.querySelector('.label');
    const right = row.querySelector('.right');

    if (!label || !right) {
      return null;
    }

    // ==========================================================
    // IMAGE -> NAME
    // ==========================================================

    label.innerHTML = '';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '10px';

    if (preset.imageSrc) {
      const image = document.createElement('img');

      image.src = preset.imageSrc;

      image.style.width = '25px';
      image.style.height = '25px';
      image.style.minWidth = '25px';
      image.style.minHeight = '25px';
      image.style.maxWidth = '25px';
      image.style.maxHeight = '25px';
      image.style.objectFit = 'contain';
      image.style.display = 'block';
      image.style.flexShrink = '0';

      label.appendChild(image);
    }

    const nameElement = document.createElement('span');

    nameElement.textContent = name;

    label.appendChild(nameElement);

    // ==========================================================
    // BUTTON CONTAINER
    // ==========================================================

    right.innerHTML = '';
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.justifyContent = 'flex-end';
    right.style.gap = '8px';

    // ==========================================================
    // USE BUTTON
    // ==========================================================

    const useButton = createButton('Use');

    if (useButton) {
      useButton.style.minWidth = '70px';
      useButton.style.height = '34px';

      useButton.setAttribute(
        'data-settings-ubuntu-action',
        'use'
      );

      useButton.setAttribute(
        'data-settings-ubuntu-type',
        type
      );

      useButton.setAttribute(
        'data-settings-ubuntu-preset',
        name
      );

      right.appendChild(useButton);
    }

    // ==========================================================
    // REMOVE BUTTON
    // ==========================================================

    const removeButton = createButton('Remove');

    if (removeButton) {
      removeButton.style.minWidth = '85px';
      removeButton.style.height = '34px';

      removeButton.style.backgroundColor =
        'var(--red-5)';

      removeButton.style.setProperty(
        '--hover-color',
        'var(--red-1)'
      );

      removeButton.style.setProperty(
        '--top',
        'var(--red-1)'
      );

      removeButton.style.setProperty(
        '--bottom',
        'var(--red-3)'
      );

      removeButton.style.color = '#ffffff';
      removeButton.style.textShadow = 'none';
      removeButton.style.filter = 'none';

      removeButton.setAttribute(
        'data-settings-ubuntu-action',
        'remove'
      );

      removeButton.setAttribute(
        'data-settings-ubuntu-type',
        type
      );

      removeButton.setAttribute(
        'data-settings-ubuntu-preset',
        name
      );

      right.appendChild(removeButton);
    }

    return row;
  };

  // ============================================================
  // RENDER SECTION
  // ============================================================

  const renderSection = (type, headerName) => {
    const section = getSection(headerName);

    if (!section) {
      return;
    }

    const selector =
      '[data-settings-ubuntu^="' + type + '-"]';

    document.querySelectorAll(selector).forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    const freshSection = getSection(headerName);

    if (!freshSection || !freshSection.rows.length) {
      return;
    }

    const saveRow = createSaveRow(type, freshSection);

    if (!saveRow) {
      return;
    }

    freshSection.rows[0].before(saveRow);

    const storage = getStorage();
    const presets = storage[type] || {};

    let previous = saveRow;

    Object.keys(presets).forEach(name => {
      const preset = presets[name];

      const row = createSavedRow(
        type,
        freshSection,
        name,
        preset
      );

      if (!row) {
        return;
      }

      if (previous.nextSibling) {
        previous.parentNode.insertBefore(
          row,
          previous.nextSibling
        );
      } else {
        previous.parentNode.appendChild(row);
      }

      previous = row;
    });
  };

  // ============================================================
  // RENDER EVERYTHING
  // ============================================================

  const renderAll = () => {
    if (isRendering) {
      return;
    }

    isRendering = true;

    if (observer) {
      observer.disconnect();
    }

    try {
      renderSection('crosshair', 'Crosshair');
      renderSection('hitmarker', 'Hitmarker');
    } finally {
      isRendering = false;
      startObserver();
    }
  };

  // ============================================================
  // EVENT DELEGATION (DOCUMENT LEVEL)
  // ============================================================

  const installDelegation = () => {
    if (delegationInstalled) {
      return;
    }

    delegationInstalled = true;

    document.addEventListener(
      'click',
      event => {
        const target = event.target;

        if (
          !target ||
          typeof target.closest !== 'function'
        ) {
          return;
        }

        const button = target.closest(
          'button[data-settings-ubuntu-action]'
        );

        if (!button) {
          return;
        }

        const action = button.getAttribute(
          'data-settings-ubuntu-action'
        );

        const type = button.getAttribute(
          'data-settings-ubuntu-type'
        );

        if (!action || !type) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const headerName =
          type === 'crosshair'
            ? 'Crosshair'
            : 'Hitmarker';

        const section = getSection(headerName);

        if (action === 'save') {
          console.log(
            '[Settings Ubuntu] Delegated save: ' + type
          );

          savePreset(type, section);

          return;
        }

        if (action === 'use') {
          const presetName = button.getAttribute(
            'data-settings-ubuntu-preset'
          );

          if (!presetName) {
            return;
          }

          const storage = getStorage();
          const preset =
            storage[type] && storage[type][presetName];

          if (!preset) {
            return;
          }

          if (observer) {
            observer.disconnect();
          }

          restoreSettings(section, preset);

          setTimeout(() => {
            startObserver();
          }, 150);

          return;
        }

        if (action === 'remove') {
          const presetName = button.getAttribute(
            'data-settings-ubuntu-preset'
          );

          if (!presetName) {
            return;
          }

          const storage = getStorage();

          if (
            storage[type] &&
            storage[type][presetName]
          ) {
            delete storage[type][presetName];
            setStorage(storage);
          }

          renderAll();

          return;
        }
      },
      true
    );
  };

  // ============================================================
  // MUTATION OBSERVER
  // ============================================================

  const startObserver = () => {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(mutations => {
      if (isRendering) {
        return;
      }

      let settingsChanged = false;

      for (let i = 0; i < mutations.length; i += 1) {
        const mutation = mutations[i];

        if (mutation.type !== 'childList') {
          continue;
        }

        const added = mutation.addedNodes;

        for (let j = 0; j < added.length; j += 1) {
          const node = added[j];

          if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          if (
            node.matches &&
            node.matches(
              '.general-content, .tabs, .tab-content'
            )
          ) {
            settingsChanged = true;
            break;
          }

          if (
            node.querySelector &&
            node.querySelector(
              '.general-content, .tabs, .tab-content'
            )
          ) {
            settingsChanged = true;
            break;
          }
        }

        if (settingsChanged) {
          break;
        }
      }

      if (!settingsChanged) {
        return;
      }

      clearTimeout(renderTimeout);

      renderTimeout = setTimeout(() => {
        if (
          document.querySelector('.general-content')
        ) {
          renderAll();
        }
      }, 150);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // ============================================================
  // INITIAL SETUP
  // ============================================================

  const init = () => {
    installDelegation();

    if (document.querySelector('.general-content')) {
      renderAll();
    }

    startObserver();
  };

  init();

  // ============================================================
  // CLEANUP
  // ============================================================

  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
    }

    clearTimeout(renderTimeout);
  });

  // ============================================================
  // DEBUG API
  // ============================================================

  window.SettingsUbuntu = {
    storageKey: STORAGE_KEY,

    getStorage: getStorage,

    render: renderAll,

    inspectCrosshair: () => {
      const section = getSection('Crosshair');
      const image = getCurrentImage(section);

      console.log(
        '[Settings Ubuntu] Crosshair image:',
        image
      );

      console.log(
        '[Settings Ubuntu] Crosshair src:',
        image && image.getAttribute('src')
      );

      console.log(
        '[Settings Ubuntu] Crosshair settings:',
        readSettings(section)
      );
    },

    inspectHitmarker: () => {
      const section = getSection('Hitmarker');
      const image = getCurrentImage(section);

      console.log(
        '[Settings Ubuntu] Hitmarker image:',
        image
      );

      console.log(
        '[Settings Ubuntu] Hitmarker src:',
        image && image.getAttribute('src')
      );

      console.log(
        '[Settings Ubuntu] Hitmarker settings:',
        readSettings(section)
      );
    }
  };

  console.log(
    '[Settings Ubuntu] Crosshair + Hitmarker presets set up.'
  );
};

// Export for use in main file
module.exports = {
  settingsUbuntuAddon: settingsUbuntuAddon
};