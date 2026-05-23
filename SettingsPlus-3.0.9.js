// ==UserScript==
// @name         SettingsPlus
// @namespace    SettingsPlus
// @version      3.0.9
// @description  check ingame settings menu.
// @author       6ixDivine
// @match        https://orteil.dashnet.org/cookieclicker/*
// @match        https://cookieclicker.ee/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    let destroyed = false;
    let masterLoop = null;
    let buyLoop = null;

    const STORAGE_KEY = 'SettingsPlus_Config';
    const BUY_INTERVAL_OPTIONS = [1, 2, 4, 6, 12, 24];

    const config = {
        autoclick: false,
        autoGolden: false,
        cps: 30,
        autoBuyBuildings: false,
        autoBuyUpgrades: false,
        buyBuilding: 'Cursor',
        buyInterval: 1
    };

    let originalUpdateMenu = null;

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved && typeof saved === 'object') Object.assign(config, saved);
        } catch (e) {}
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    function notify(title, message) {
        if (!Game || !Game.Notify) return;
        Game.Notify(title, message, [16, 5]);
    }

    function waitForGame() {
        if (typeof Game !== 'undefined' && Game.ready) init();
        else setTimeout(waitForGame, 1000);
    }

    function init() {
        if (destroyed) return;

        loadSettings();
        hookMenu();
        bindKeys();

        startMasterLoop();
        startBuyLoop();

        notify('Settings Plus https://github.com/6ixDivine', 'Loaded');
    }

    function hookMenu() {
        if (!Game || !Game.UpdateMenu) return;
        if (originalUpdateMenu) return;

        originalUpdateMenu = Game.UpdateMenu;
        const previous = Game.UpdateMenu;

        Game.UpdateMenu = function (...args) {
            previous.apply(this, args);

            if (destroyed) return;
            if (Game.onMenu === 'prefs') injectUI();
        };
    }

    function injectUI() {
        if (destroyed) return;

        const menu = document.getElementById('menu');
        if (!menu) return;

        if (document.getElementById('settingsPlus')) return;

        const section = document.createElement('div');
        section.id = 'settingsPlus';
        section.className = 'subsection';

        const buildings = Object.keys(Game.Objects || {});

        section.innerHTML = `
            <div class="title">Settings Plus</div>

            <div class="listing">
                <a class="option" id="autoClickToggle">Auto Clicker (OFF) [F6]</a>
                <a class="option" id="goldenToggle">Auto Golden Cookies (OFF)</a>
                <a class="option" id="autoBuyBuildingsToggle">Auto Buy Buildings (OFF)</a>
                <a class="option" id="autoBuyUpgradesToggle">Auto Buy Upgrades (OFF)</a>
            </div>

            <div class="listing">
                <div class="option">
                    <span>Building:</span>
                    <select id="buildingSelect"></select>
                    <span id="buildingLabel"></span>
                </div>

                <div class="option">
                    <span>Interval:</span>
                    <select id="intervalSelect">
                        ${BUY_INTERVAL_OPTIONS.map(v => `<option value="${v}">${v}s</option>`).join('')}
                    </select>
                    <span id="intervalLabel"></span>
                </div>
            </div>

            <div class="listing">
                <a class="option" id="UnloadBtn">Unload</a>
            </div>
        `;

        const sections = menu.getElementsByClassName('section');
        if (sections.length > 0) {
            sections[sections.length - 1].appendChild(section);
        } else {
            menu.appendChild(section);
        }

        const buildingSelect = document.getElementById('buildingSelect');
        const intervalSelect = document.getElementById('intervalSelect');

        buildings.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            buildingSelect.appendChild(opt);
        });

        buildingSelect.value = config.buyBuilding;
        intervalSelect.value = config.buyInterval;

        function updateLabels() {
            const bl = document.getElementById('buildingLabel');
            const il = document.getElementById('intervalLabel');

            if (bl) bl.textContent = ` → ${config.buyBuilding}`;
            if (il) il.textContent = ` → every ${config.buyInterval}s`;
        }

        updateLabels();

        buildingSelect.addEventListener('change', e => {
            config.buyBuilding = e.target.value;
            saveSettings();
            updateLabels();
        });

        intervalSelect.addEventListener('change', e => {
            config.buyInterval = parseInt(e.target.value);
            saveSettings();
            restartBuyLoop();
            updateLabels();
        });

        document.getElementById('autoClickToggle').addEventListener('click', toggleAutoclick);
        document.getElementById('goldenToggle').addEventListener('click', toggleGolden);
        document.getElementById('autoBuyBuildingsToggle').addEventListener('click', toggleAutoBuyBuildings);
        document.getElementById('autoBuyUpgradesToggle').addEventListener('click', toggleAutoBuyUpgrades);
        document.getElementById('UnloadBtn').addEventListener('click', unload);

        updateUI();
    }

    function updateUI() {
        const a = document.getElementById('autoClickToggle');
        const g = document.getElementById('goldenToggle');
        const b = document.getElementById('autoBuyBuildingsToggle');
        const u = document.getElementById('autoBuyUpgradesToggle');

        if (a) a.textContent = config.autoclick ? 'Auto Clicker (ON) [F6]' : 'Auto Clicker (OFF) [F6]';
        if (g) g.textContent = config.autoGolden ? 'Auto Golden Cookies (ON)' : 'Auto Golden Cookies (OFF)';
        if (b) b.textContent = config.autoBuyBuildings ? 'Auto Buy Buildings (ON)' : 'Auto Buy Buildings (OFF)';
        if (u) u.textContent = config.autoBuyUpgrades ? 'Auto Buy Upgrades (ON)' : 'Auto Buy Upgrades (OFF)';

        if (a) a.className = config.autoclick ? 'option' : 'option off';
        if (g) g.className = config.autoGolden ? 'option' : 'option off';
        if (b) b.className = config.autoBuyBuildings ? 'option' : 'option off';
        if (u) u.className = config.autoBuyUpgrades ? 'option' : 'option off';
    }

    function startMasterLoop() {
        if (masterLoop) return;

        masterLoop = setInterval(() => {
            if (destroyed || !Game?.ready) return;

            if (config.autoclick && !Game.OnAscend) {
                Game.ClickCookie();
            }

            if (config.autoGolden) {
                for (const s of Game.shimmers) {
                    if (s.type === 'golden') s.pop();
                }
            }
        }, 1000 / config.cps);
    }

    function startBuyLoop() {
        if (buyLoop) return;

        buyLoop = setInterval(() => {
            if (destroyed || !Game?.ready) return;

            if (config.autoBuyBuildings) {
                const obj = Game.Objects?.[config.buyBuilding];
                if (obj && Game.cookies >= obj.getPrice()) {
                    obj.buy(1);
                }
            }

            if (config.autoBuyUpgrades) {
                for (const upg of Game.UpgradesInStore || []) {
                    if (upg && !upg.bought && Game.cookies >= upg.getPrice()) {
                        upg.buy();
                        break;
                    }
                }
            }
        }, config.buyInterval * 1000);
    }

    function restartBuyLoop() {
        if (buyLoop) {
            clearInterval(buyLoop);
            buyLoop = null;
        }
        startBuyLoop();
    }

    function toggleAutoclick() {
        config.autoclick = !config.autoclick;
        saveSettings();
        notify('Settings Plus', config.autoclick ? 'Auto Click Enabled' : 'Auto Click Disabled');
        updateUI();
    }

    function toggleGolden() {
        config.autoGolden = !config.autoGolden;
        saveSettings();
        notify('Settings Plus', config.autoGolden ? 'Auto Golden Enabled' : 'Auto Golden Disabled');
        updateUI();
    }

    function toggleAutoBuyBuildings() {
        config.autoBuyBuildings = !config.autoBuyBuildings;
        saveSettings();
        notify('Settings Plus', config.autoBuyBuildings ? 'Auto Buy Buildings Enabled' : 'Auto Buy Buildings Disabled');
        updateUI();
    }

    function toggleAutoBuyUpgrades() {
        config.autoBuyUpgrades = !config.autoBuyUpgrades;
        saveSettings();
        notify('Settings Plus', config.autoBuyUpgrades ? 'Auto Buy Upgrades Enabled' : 'Auto Buy Upgrades Disabled');
        updateUI();
    }

    function bindKeys() {
        document.addEventListener('keydown', e => {
            if (destroyed) return;

            if (e.key === 'F6') {
                e.preventDefault();
                toggleAutoclick();
            }
        });
    }

    function unload() {
        destroyed = true;

        config.autoclick = false;
        config.autoGolden = false;
        config.autoBuyBuildings = false;
        config.autoBuyUpgrades = false;

        saveSettings();

        clearInterval(masterLoop);
        clearInterval(buyLoop);

        masterLoop = null;
        buyLoop = null;

        if (originalUpdateMenu && Game) {
            Game.UpdateMenu = originalUpdateMenu;
        }

        document.getElementById('settingsPlus')?.remove();

        notify('Settings Plus https://github.com/6ixDivine', 'Unloaded');
    }

    waitForGame();

})();
