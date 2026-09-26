/**
  * Adds a live search bar to the General settings page.
  *
  * - Adds a "Search..." input at the top of .general-content
  * - Uses the game's own markup (filter-name / wrapper-input /
  *   keybind-input / input) so it inherits component styling
  * - Filters settings rows by:
  *     - the row label            (e.g. "FOV")
  *     - the row value text       (e.g. "90", "Show", "Yes")
  *     - the section/header name  (e.g. "Weapon ADS", "Camera")
  *     - the box name             (e.g. "Players", "map", "skybox")
  * - Supports both flat layouts
  *     (.general-content > .header + .element)
  *   and boxed layouts
  *     (.general-content > .box > .header + .element)
  * - Hides empty headers and empty .box wrappers
  * - Hides associated content (preview containers, skybox
  *   wraps, canvases) when their owning section is hidden
  * - Skips rows injected by the Crosshair/Hitmarker addon
  * - Survives Vue re-renders via MutationObserver
  * - Uses a stable marker so it is only injected once
  *
  * Electron 10.4.7 / Chromium 85 compatible.
  */

const settingsSearchAddon = () => {
  'use strict';

  const MARKER = 'data-settings-search';

  // Scope attributes copied from the game's own markup so the
  // injected nodes inherit the correct component styles.
  const SCOPE_FILTER_NAME = '77926024';
  const SCOPE_WRAPPER_INPUT = '094f831c';

  let observer = null;
  let renderTimeout = null;
  let isRendering = false;
  let currentQuery = '';

  // ============================================================
  // HELPERS
  // ============================================================

  const getText = element => {
    if (!element) {
      return '';
    }

    return (element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getLabelText = row => {
    if (!row) {
      return '';
    }

    const label = row.querySelector('.label');

    if (!label) {
      return '';
    }

    // Only direct text nodes so info icons and popovers do not
    // pollute the searchable text.
    const parts = [];

    label.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      }
    });

    const direct = parts
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (direct) {
      return direct;
    }

    return getText(label);
  };

  // Collect every header name that applies to a row, by walking
  // up the DOM. Includes the row's own preceding .header in its
  // parent, plus any .header at the top of the .box container.
  const getSectionNames = row => {
    const names = [];

    // 1. Walk backwards through siblings for any preceding
    //    .header (flat layout).
    let node = row ? row.previousElementSibling : null;

    while (node) {
      if (node.classList.contains('header')) {
        names.push(getText(node));
        break;
      }

      node = node.previousElementSibling;
    }

    // 2. Walk up through ancestors. For each parent that is a
    //    .box, find its own .header child and include it.
    let parent = row ? row.parentElement : null;

    while (parent && parent !== document.body) {
      if (parent.classList.contains('box')) {
        const boxHeader = parent.querySelector(
          ':scope > .header'
        );

        if (boxHeader) {
          names.push(getText(boxHeader));
        }
      }

      if (parent.classList.contains('general-content')) {
        break;
      }

      parent = parent.parentElement;
    }

    return names;
  };

  // ============================================================
  // SEARCH BAR — GAME MARKUP (IDENTICAL)
  // ============================================================

  const buildSearchBar = () => {
    const wrapper = document.createElement('div');

    wrapper.setAttribute(MARKER, 'bar');
    wrapper.setAttribute(
      'data-v-' + SCOPE_FILTER_NAME,
      ''
    );
    wrapper.className = 'filter-name';

    wrapper.style.cssText = [
      'margin: 0 0 10px 0',
      'display: flex',
      'align-items: center'
    ].join(';');

    const label = document.createElement('label');

    label.setAttribute(
      'data-v-' + SCOPE_WRAPPER_INPUT,
      ''
    );
    label.setAttribute(
      'data-v-' + SCOPE_FILTER_NAME,
      ''
    );
    label.className = 'wrapper-input keybind-input';
    label.setAttribute('placeholder', 'Search...');

    label.style.cssText = [
      'flex: 1 1 auto',
      'min-width: 0'
    ].join(';');

    const input = document.createElement('input');

    input.setAttribute(
      'data-v-' + SCOPE_WRAPPER_INPUT,
      ''
    );
    input.type = 'text';
    input.className = 'input';
    input.placeholder = 'Search...';

    input.addEventListener('input', () => {
      currentQuery = input.value;
      applyFilter(currentQuery);
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        input.value = '';
        currentQuery = '';
        applyFilter('');
      }
    });

    label.appendChild(input);
    wrapper.appendChild(label);

    wrapper.__searchInput = input;

    return wrapper;
  };

  // ============================================================
  // FILTER LOGIC
  // ============================================================

  const applyFilter = query => {
    const container = document.querySelector(
      '.general-content'
    );

    if (!container) {
      return;
    }

    const needle = String(query || '')
      .trim()
      .toLowerCase();

    // Collect every node type that can belong to a section.
    // Non-.element nodes are handled as "associated content".
    const allHeaders = [
      ...container.querySelectorAll('.header')
    ];

    const allRows = [
      ...container.querySelectorAll('.element')
    ];

    const allBoxes = [
      ...container.querySelectorAll('.box')
    ];

    const allAssoc = [
      ...container.querySelectorAll(
        '.crosshair-preview-container, .skybox-wrap, canvas'
      )
    ];

    // Reset first — idempotent.
    allRows.forEach(row => {
      row.style.display = '';
    });

    allHeaders.forEach(header => {
      header.style.display = '';
    });

    allBoxes.forEach(box => {
      box.style.display = '';
    });

    allAssoc.forEach(node => {
      node.style.display = '';
    });

    if (!needle) {
      return;
    }

    // ----------------------------------------------------------
    // PASS 1 — HIDE ROWS THAT DO NOT MATCH
    // ----------------------------------------------------------

    allRows.forEach(row => {
      const labelText = getLabelText(row).toLowerCase();

      const rightText = getText(
        row.querySelector('.right')
      ).toLowerCase();

      const sections = getSectionNames(row)
        .join(' ')
        .toLowerCase();

      const haystack =
        labelText + ' ' + rightText + ' ' + sections;

      if (!haystack.includes(needle)) {
        row.style.display = 'none';
      }
    });

    // ----------------------------------------------------------
    // PASS 2 — HIDE EMPTY HEADERS, BOXES, AND ASSOCIATED BITS
    // ----------------------------------------------------------

    // Does a given parent contain any visible real row?
    const hasVisibleRow = parent => {
      const rows = parent.querySelectorAll('.element');

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];

        if (
          row.style.display !== 'none' &&
          !row.hasAttribute('data-settings-ubuntu')
        ) {
          return true;
        }
      }

      return false;
    };

    // Hide boxes whose rows are all hidden.
    allBoxes.forEach(box => {
      if (!hasVisibleRow(box)) {
        box.style.display = 'none';
      }
    });

    // Hide flat headers whose section has no visible real rows.
    // Walk the container's direct children in document order,
    // treating each .header as the start of a new section that
    // extends until the next .header or .box.
    let currentHeader = null;
    let visibleUnderHeader = 0;

    const flushHeader = () => {
      if (!currentHeader) {
        return;
      }

      if (visibleUnderHeader === 0) {
        currentHeader.style.display = 'none';
      }
    };

    let node = container.firstElementChild;

    while (node) {
      if (node.hasAttribute(MARKER)) {
        // Skip the search bar itself.
      } else if (node.classList.contains('header')) {
        flushHeader();
        currentHeader = node;
        visibleUnderHeader = 0;
      } else if (node.classList.contains('box')) {
        // Boxes are handled separately above.
        flushHeader();
        currentHeader = null;
        visibleUnderHeader = 0;
      } else if (
        node.classList.contains('element') &&
        node.style.display !== 'none' &&
        !node.hasAttribute('data-settings-ubuntu')
      ) {
        visibleUnderHeader += 1;
      }

      node = node.nextElementSibling;
    }

    flushHeader();

    // Hide associated content (previews, skybox, canvases) whose
    // owning header or box has been hidden.
    allAssoc.forEach(assoc => {
      let owner = assoc.previousElementSibling;
      let owningHeader = null;

      while (owner) {
        if (owner.classList.contains('header')) {
          owningHeader = owner;
          break;
        }

        owner = owner.previousElementSibling;
      }

      // Prefer the nearest .box ancestor if there is no sibling
      // header.
      const owningBox = assoc.closest('.box');

      const headerHidden =
        owningHeader &&
        owningHeader.style.display === 'none';

      const boxHidden =
        owningBox &&
        owningBox.style.display === 'none';

      if (headerHidden || boxHidden) {
        assoc.style.display = 'none';
        return;
      }

      // If no owner was found at all, hide it when a query is
      // active so orphan content doesn't float on its own.
      if (!owningHeader && !owningBox) {
        assoc.style.display = 'none';
      }
    });
  };

  // ============================================================
  // INJECT
  // ============================================================

  const removeExisting = () => {
    document
      .querySelectorAll('[' + MARKER + '="bar"]')
      .forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
  };

  const inject = () => {
    const container = document.querySelector(
      '.general-content'
    );

    if (!container) {
      return false;
    }

    if (container.querySelector('[' + MARKER + '="bar"]')) {
      return true;
    }

    removeExisting();

    const bar = buildSearchBar();

    container.insertBefore(bar, container.firstChild);

    const input = bar.__searchInput;

    if (input && currentQuery) {
      input.value = currentQuery;
      applyFilter(currentQuery);
    }

    return true;
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
      inject();
    } finally {
      isRendering = false;
      startObserver();
    }
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

      let relevant = false;

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
            node.hasAttribute &&
            node.hasAttribute(MARKER)
          ) {
            continue;
          }

          if (
            node.matches &&
            node.matches(
              '.general-content, .tabs, .tab-content'
            )
          ) {
            relevant = true;
            break;
          }

          if (
            node.querySelector &&
            node.querySelector(
              '.general-content, .tabs, .tab-content'
            )
          ) {
            relevant = true;
            break;
          }
        }

        if (relevant) {
          break;
        }
      }

      if (!relevant) {
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

    removeExisting();
  });

  // ============================================================
  // DEBUG API
  // ============================================================

  window.SettingsSearch = {
    marker: MARKER,

    render: renderAll,

    clear: () => {
      const input = document.querySelector(
        '[' + MARKER + '="bar"] input'
      );

      if (input) {
        input.value = '';
      }

      currentQuery = '';
      applyFilter('');
    },

    filter: value => {
      const input = document.querySelector(
        '[' + MARKER + '="bar"] input'
      );

      if (input) {
        input.value = value;
      }

      currentQuery = value;
      applyFilter(value);
    },

    destroy: () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      clearTimeout(renderTimeout);

      removeExisting();

      const container = document.querySelector(
        '.general-content'
      );

      if (container) {
        container
          .querySelectorAll(
            '.element, .header, .box, ' +
              '.crosshair-preview-container, ' +
              '.skybox-wrap, canvas'
          )
          .forEach(el => {
            el.style.display = '';
          });
      }

      currentQuery = '';

      delete window.SettingsSearch;

      console.log('[Settings Search] Removed.');
    }
  };

  console.log(
    '[Settings Search] Live search bar set up.'
  );
};

// Export for use in main file
module.exports = {
  settingsSearchAddon
};