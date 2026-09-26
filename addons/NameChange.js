const nameChangeAddon = () => {
  'use strict';

  const API_URL = 'https://api2.kirka.io/api/wwMmWW';

  let checkedForCurrentInventory = false;
  let hasNameChange = false;

  function hideEditIcon() {
    if (document.getElementById('namechange-hide-edit-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'namechange-hide-edit-style';
    style.textContent = `
      svg.edit.svg-icon--__edit__ {
        display: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function getWeaponsSubjects() {
    const tabBars = [...document.querySelectorAll('.tab-bar')];

    const weaponsTabBar = tabBars.find(tabBar =>
      [...tabBar.querySelectorAll('.tab')].some(
        tab =>
          tab.querySelector('.title')?.textContent.trim() === 'WEAPONS'
      )
    );

    if (!weaponsTabBar) {
      return null;
    }

    const subjects = weaponsTabBar.nextElementSibling;

    if (!subjects || !subjects.classList.contains('subjects')) {
      return null;
    }

    return subjects;
  }

  function updateNameChangeVisibility() {
    const item = document.querySelector('.subjects .NameChange');

    if (!item) {
      return;
    }

    const activeTab = document.querySelector('.tab.active .title');

    item.style.display =
      activeTab?.textContent.trim() === 'WEAPONS' ? '' : 'none';
  }

  function getRealUseButtonTemplate(subjects) {
    const realWeapon = [...subjects.querySelectorAll('.subject')]
      .find(subject => subject.querySelector('.take-btn'));

    return realWeapon?.querySelector('.take-btn') || null;
  }

  async function changeName(username, changeButton) {
    if (!username) {
      return;
    }

    const text = changeButton?.querySelector('.text');

    try {
      if (changeButton) {
        changeButton.disabled = true;
      }

      if (text) {
        text.textContent = ' Changing ';
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.token}`
        },
        body: JSON.stringify({
          wwMmWnW: username
        })
      });

      if (response.ok) {
        location.reload();
        return;
      }

      if (text) {
        text.textContent = ' Error ';
      }

      if (changeButton) {
        changeButton.disabled = false;
      }
    } catch (error) {
      if (text) {
        text.textContent = ' Error ';
      }

      if (changeButton) {
        changeButton.disabled = false;
      }
    }
  }

  function openNameChangeModal() {
    if (document.querySelector('#edit-name-modal')) {
      return;
    }

    const modal = document.createElement('div');

    modal.innerHTML = `
      <div data-v-99970ce6="" class="vm--container">
        <div
          data-modal="edit-name"
          aria-expanded="true"
          class="vm--overlay"
        >
          <div class="vm--top-right-slot"></div>
        </div>

        <div
          aria-expanded="true"
          wnmmnww="dialog"
          aria-modal="true"
          class="vm--modal"
          style="background:none;top:0px;left:5px;width:870px;height:1080px;"
        >
          <div
            data-v-a1eaaeac=""
            data-v-ef09383c=""
            data-v-99970ce6=""
            id="edit-name-modal"
            class="wrapper-modal"
          >
            <div
              data-v-a1eaaeac=""
              class="container-card"
              style="padding:2rem;background:var(--WwnNMw-1);border:3px solid rgb(3,4,5);border-radius:1.25rem;"
            >
              <div data-v-a1eaaeac="" class="close">
                <svg
                  data-v-2b44d870=""
                  data-v-a1eaaeac=""
                  xmlns="http://www.w3.org/2000/svg"
                  class="close-icon svg-icon svg-icon--__close__"
                >
                  <use
                    data-v-2b44d870=""
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                    xlink:href="/img/icons.3f174ec9.svg#__close__"
                  ></use>
                </svg>
              </div>

              <div
                data-v-ef09383c=""
                data-v-a1eaaeac=""
                class="edit-name-cont"
              >
                <div
                  data-v-ef09383c=""
                  data-v-a1eaaeac=""
                  class="head text-1"
                >
                  CHANGE NICKNAME
                </div>

                <div
                  data-v-ef09383c=""
                  data-v-a1eaaeac=""
                  class="description NameChange-description"
                >
                  You have the option to change your name.
                </div>

                <label
                  data-v-094f831c=""
                  data-v-ef09383c=""
                  class="wrapper-input input-wrapper"
                  placeholder="NICKNAME..."
                  data-v-a1eaaeac=""
                >
                  <input
                    data-v-094f831c=""
                    placeholder="NICKNAME..."
                    class="input"
                  >
                </label>

                <div
                  data-v-ef09383c=""
                  data-v-a1eaaeac=""
                  class="btns"
                >
                  <button
                    data-v-02ffe5dc=""
                    data-v-ef09383c=""
                    class="button send rectangle"
                    data-v-a1eaaeac=""
                    style="background-color:var(--blue-4);--hover-color:var(--blue-5);--top:var(--blue-5);--bottom:var(--blue-6);"
                  >
                    <div data-v-02ffe5dc="" class="triangle"></div>

                    <div data-v-02ffe5dc="" class="text">
                      Change
                    </div>

                    <div data-v-02ffe5dc="" class="WmWMwNwn">
                      <div data-v-02ffe5dc="" class="border-top border"></div>
                      <div data-v-02ffe5dc="" class="border-bottom border"></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const overlay = modal.querySelector('.vm--overlay');
    const close = modal.querySelector('.close');
    const input = modal.querySelector('.input');
    const changeButton = modal.querySelector('.send');
    const description = modal.querySelector('.NameChange-description');

    if (description) {
      description.style.setProperty('display', 'block', 'important');
      description.style.setProperty('width', '100%', 'important');
      description.style.setProperty('white-space', 'normal', 'important');
      description.style.setProperty('word-break', 'normal', 'important');
      description.style.setProperty('overflow-wrap', 'normal', 'important');
      description.style.setProperty('line-height', '1.4', 'important');
      description.style.setProperty('text-align', 'left', 'important');
      description.style.setProperty('color', '#ffffff', 'important');
    }

    const closeModal = () => {
      modal.remove();
    };

    close?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    changeButton?.addEventListener('click', () => {
      const username = input?.value.trim();

      if (!username) {
        input?.focus();
        return;
      }

      changeName(username, changeButton);
    });

    input?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();

      const username = input?.value.trim();

      if (!username) {
        input?.focus();
        return;
      }

      changeName(username, changeButton);
    });

    input?.focus();
  }

  function addUseButton(item, subjects) {
    const hoverGroup = item.querySelector('.hover-btns-group');

    if (!hoverGroup) {
      return;
    }

    if (hoverGroup.querySelector('.NameChange-use')) {
      return;
    }

    const realButton = getRealUseButtonTemplate(subjects);

    if (!realButton) {
      return;
    }

    const button = realButton.cloneNode(true);

    button.classList.add('NameChange-use');

    const text = button.querySelector('.text');

    if (text) {
      text.textContent = ' USE ';
    }

    const itemName = hoverGroup.querySelector('.item-name');

    if (itemName) {
      hoverGroup.insertBefore(button, itemName);
    } else {
      hoverGroup.appendChild(button);
    }

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openNameChangeModal();
    });
  }

  function addNameChange() {
    const subjects = getWeaponsSubjects();

    if (!subjects) {
      return false;
    }

    let item = subjects.querySelector('.NameChange');

    if (!item) {
      const shark = subjects.querySelector('.subject.Shark');

      if (!shark) {
        return false;
      }

      item = shark.cloneNode(true);

      item.classList.remove('Shark');
      item.classList.add('NameChange');

      const img = item.querySelector('.subj-img');

      if (img) {
        img.src = 'https://kirka.io/assets/img/render-mini.0ec8ea84.webp';
      }

      const name = item.querySelector('.item-name');

      if (name) {
        name.textContent = 'NameChange';
      }

      const count = item.querySelector('.count');

      if (count) {
        count.textContent = '1';
      }

      const rarity = item.querySelector('.rar-skin');

      if (rarity) {
        rarity.style.background =
          'linear-gradient(178.71deg, rgb(162, 45, 255) -2.57%, rgb(226, 45, 255) 106.96%)';
      }

      const hoverGroup = item.querySelector('.hover-btns-group');

      if (hoverGroup) {
        hoverGroup.querySelectorAll('button').forEach(button => {
          button.remove();
        });
      }

      subjects.appendChild(item);
    }

    addUseButton(item, subjects);
    updateNameChangeVisibility();

    return true;
  }

  async function checkAPI() {
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.token}`
        }
      });

      if (!response.ok) {
        hasNameChange = false;
        return;
      }

      const data = await response.json();

      hasNameChange = data.wWNnmw === true;

      if (hasNameChange) {
        const interval = setInterval(() => {
          if (addNameChange()) {
            clearInterval(interval);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
        }, 10000);
      }
    } catch (error) {
      hasNameChange = false;
    }
  }

  function checkPage() {
    hideEditIcon();

    if (location.pathname !== '/inventory') {
      checkedForCurrentInventory = false;
      return;
    }

    if (!checkedForCurrentInventory) {
      checkedForCurrentInventory = true;
      checkAPI();
    }

    if (hasNameChange) {
      addNameChange();
      updateNameChangeVisibility();
    }
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    checkPage();
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    checkPage();
    return result;
  };

  window.addEventListener('popstate', checkPage);

  const observer = new MutationObserver(() => {
    hideEditIcon();

    if (
      location.pathname === '/inventory' &&
      hasNameChange
    ) {
      addNameChange();
      updateNameChangeVisibility();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  hideEditIcon();
  checkPage();
};

module.exports = { nameChangeAddon };
