// ==UserScript==
// @name         Settings Plus
// @namespace    SettingsPlus
// @version      3.1.1
// @description  Cookie Clicker utility mod
// @author       6ixDivine
// @match        https://orteil.dashnet.org/cookieclicker/*
// @match        https://cookieclicker.ee/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    if (window.__SETTINGS_PLUS__) return;
    window.__SETTINGS_PLUS__ = true;

    let destroyed = false;

    let masterLoop = null;
    let buyLoop = null;
    let cpsLoop = null;

    let originalUpdateMenu = null;

    const STORAGE_KEY = "SettingsPlus_Config";

    const BUY_INTERVAL_OPTIONS = [1, 2, 4, 6, 12, 24];

    const config = {
        autoclick: false,
        autoGolden: false,
        autoReindeer: false,
        cps: 30,

        autoBuyBuildings: false,
        autoBuyUpgrades: false,

        buyBuilding: "Cursor",
        buyInterval: 1,

        cpsGuiVisible: true,
        cheatMenuVisible: false,

        cpsHudX: 20,
        cpsHudY: 20,

        cheatMenuX: window.innerWidth / 2 - 170,
        cheatMenuY: window.innerHeight / 2 - 180
    };

    const listeners = [];

    function addListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);

        listeners.push(() => {
            target.removeEventListener(type, handler, options);
        });
    }

    function cleanupListeners() {
        listeners.forEach(remove => remove());

        listeners.length = 0;
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

            if (saved && typeof saved === "object") {
                Object.assign(config, saved);
            }
        } catch (e) {}
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    function notify(title, message) {
        if (!window.Game || !Game.Notify) return;

        Game.Notify(title, message, [16, 5]);
    }

    function waitForGame() {
        if (typeof Game !== "undefined" && Game.ready) {
            init();
        } else {
            setTimeout(waitForGame, 1000);
        }
    }

    function init() {
        if (destroyed) return;

        loadSettings();

        injectStyles();

        hookMenu();

        createCPSGUI();

        createCheatMenu();

        bindKeys();

        startMasterLoop();

        startBuyLoop();

        notify("Settings Plus", "Loaded");
    }

    function injectStyles() {
        const style = document.createElement("style");

        style.id = "spStyles";

        style.textContent = `
            .sp-window {
                position: fixed;
                width: 320px;
                background: linear-gradient(180deg,#4a2f1d,#2d1b10);
                border: 3px solid #8b5a2b;
                border-radius: 14px;
                z-index: 999999;
                box-shadow:
                    0 0 0 2px #2a160a inset,
                    0 12px 30px rgba(0,0,0,0.55);
                color: #f7e7c6;
                font-family: Georgia, serif;
                overflow: hidden;
                user-select: none;
            }

            .sp-header {
                background: linear-gradient(180deg,#7a4d25,#5c3516);
                padding: 10px;
                cursor: move;
                font-weight: bold;
                text-align: center;
                font-size: 18px;
                border-bottom: 2px solid #3d220f;
                text-shadow: 1px 1px 2px #000;
                color: #fff3d6;
            }

            .sp-body {
                padding: 12px;
            }

            .sp-button {
                width: 100%;
                margin-bottom: 8px;
                padding: 10px;
                border: 2px solid #6a3d1b;
                border-radius: 10px;
                background: linear-gradient(180deg,#c48a4b,#8d5a2a);
                color: #fff8ec;
                font-weight: bold;
                cursor: pointer;
                transition: 0.12s ease;
                font-family: Georgia, serif;
                text-shadow: 1px 1px 2px #000;
            }

            .sp-button:hover {
                transform: scale(1.02);
                filter: brightness(1.08);
            }

            .sp-stat {
                text-align: center;
                font-size: 42px;
                font-weight: bold;
                color: #fff0c0;
                text-shadow: 0 0 8px rgba(255,220,120,0.7);
                padding: 10px;
            }

            .sp-sub {
                text-align: center;
                font-size: 12px;
                color: #e6d3b2;
                margin-top: -6px;
                margin-bottom: 6px;
            }
        `;

        document.head.appendChild(style);
    }

    function hookMenu() {
        if (!Game || !Game.UpdateMenu) return;

        if (originalUpdateMenu) return;

        originalUpdateMenu = Game.UpdateMenu;

        const previous = Game.UpdateMenu;

        Game.UpdateMenu = function (...args) {
            previous.apply(this, args);

            if (destroyed) return;

            if (Game.onMenu === "prefs") {
                injectUI();
            }
        };
    }

    function injectUI() {
        const menu = document.getElementById("menu");

        if (!menu) return;

        document.getElementById("settingsPlus")?.remove();

        const section = document.createElement("div");

        section.id = "settingsPlus";
        section.className = "subsection";

        const buildings = Object.keys(Game.Objects || {});

        section.innerHTML = `
            <div class="title">Settings Plus</div>

            <div class="listing">
                <a class="option" id="autoClickToggle">
                    Auto Clicker (${config.autoclick ? "ON" : "OFF"}) [F6]
                </a>

                <a class="option" id="goldenToggle">
                    Auto Golden (${config.autoGolden ? "ON" : "OFF"})
                </a>

                <a class="option" id="reindeerToggle">
                    Auto Reindeer (${config.autoReindeer ? "ON" : "OFF"})
                </a>
            </div>

            <div class="listing">
                <a class="option" id="autoBuyBuildingsToggle">
                    Auto Buy Buildings (${config.autoBuyBuildings ? "ON" : "OFF"})
                </a>

                <a class="option" id="autoBuyUpgradesToggle">
                    Auto Buy Upgrades (${config.autoBuyUpgrades ? "ON" : "OFF"})
                </a>
            </div>

            <div class="listing">
                <a class="option" id="toggleCPSGUI">
                    CPS HUD (${config.cpsGuiVisible ? "ON" : "OFF"}) [F2]
                </a>

                <a class="option" id="toggleCheatMenu">
                    Utility Menu (${config.cheatMenuVisible ? "ON" : "OFF"}) [F4]
                </a>
            </div>

            <div class="listing">
                <div class="option">
                    <span>Building:</span>

                    <select id="buildingSelect"></select>
                </div>

                <div class="option">
                    <span>Interval:</span>

                    <select id="intervalSelect">
                        ${BUY_INTERVAL_OPTIONS.map(v => `
                            <option value="${v}">
                                ${v}s
                            </option>
                        `).join("")}
                    </select>
                </div>
            </div>

            <div class="listing">
                <a class="option" id="UnloadBtn">
                    Unload Script
                </a>
            </div>
        `;

        const sections = menu.getElementsByClassName("section");

        if (sections.length > 0) {
            sections[sections.length - 1].appendChild(section);
        } else {
            menu.appendChild(section);
        }

        const buildingSelect = document.getElementById("buildingSelect");
        const intervalSelect = document.getElementById("intervalSelect");

        buildings.forEach(b => {
            const opt = document.createElement("option");

            opt.value = b;
            opt.textContent = b;

            buildingSelect.appendChild(opt);
        });

        buildingSelect.value = config.buyBuilding;

        intervalSelect.value = config.buyInterval;

        buildingSelect.addEventListener("change", e => {
            config.buyBuilding = e.target.value;

            saveSettings();
        });

        intervalSelect.addEventListener("change", e => {
            config.buyInterval = parseInt(e.target.value);

            saveSettings();

            restartBuyLoop();
        });

        document.getElementById("autoClickToggle")
            .addEventListener("click", toggleAutoclick);

        document.getElementById("goldenToggle")
            .addEventListener("click", toggleGolden);

        document.getElementById("reindeerToggle")
            .addEventListener("click", toggleReindeer);

        document.getElementById("autoBuyBuildingsToggle")
            .addEventListener("click", toggleAutoBuyBuildings);

        document.getElementById("autoBuyUpgradesToggle")
            .addEventListener("click", toggleAutoBuyUpgrades);

        document.getElementById("toggleCPSGUI")
            .addEventListener("click", toggleCPSGUI);

        document.getElementById("toggleCheatMenu")
            .addEventListener("click", toggleCheatMenu);

        document.getElementById("UnloadBtn")
            .addEventListener("click", unload);
    }

    function startMasterLoop() {
        if (masterLoop) return;

        masterLoop = setInterval(() => {

            if (destroyed || !Game?.ready) return;

            if (config.autoclick && !Game.OnAscend) {
                Game.ClickCookie();
            }

            for (const s of Game.shimmers || []) {

                if (
                    (config.autoGolden && s.type === "golden") ||
                    (config.autoReindeer && s.type === "reindeer")
                ) {
                    s.pop();
                }
            }

        }, 1000 / config.cps);
    }

    function startBuyLoop() {
        if (buyLoop) return;

        buyLoop = setInterval(() => {

            if (destroyed || !Game?.ready) return;

            if (config.autoBuyUpgrades) {

                for (const upg of Game.UpgradesInStore || []) {

                    if (
                        upg &&
                        !upg.bought &&
                        Game.cookies >= upg.getPrice()
                    ) {
                        upg.buy();
                        break;
                    }
                }
            }

            if (config.autoBuyBuildings) {

                const obj = Game.Objects?.[config.buyBuilding];

                if (obj && Game.cookies >= obj.getPrice()) {
                    obj.buy(1);
                }
            }

        }, config.buyInterval * 1000);
    }

    function restartBuyLoop() {
        clearInterval(buyLoop);

        buyLoop = null;

        startBuyLoop();
    }

    function toggleAutoclick() {
        config.autoclick = !config.autoclick;

        saveSettings();

        updateMenuState();

        notify(
            "Settings Plus",
            config.autoclick
                ? "Auto Click Enabled"
                : "Auto Click Disabled"
        );
    }

    function toggleGolden() {
        config.autoGolden = !config.autoGolden;

        saveSettings();

        updateMenuState();
    }

    function toggleReindeer() {
        config.autoReindeer = !config.autoReindeer;

        saveSettings();

        updateMenuState();
    }

    function toggleAutoBuyBuildings() {
        config.autoBuyBuildings = !config.autoBuyBuildings;

        saveSettings();

        updateMenuState();
    }

    function toggleAutoBuyUpgrades() {
        config.autoBuyUpgrades = !config.autoBuyUpgrades;

        saveSettings();

        updateMenuState();
    }

    function updateMenuState() {
        if (Game.onMenu === "prefs") {
            injectUI();
        }
    }

    let clicks = [];

    let cpsHud = null;

    function createCPSGUI() {

        cpsHud = document.createElement("div");

        cpsHud.className = "sp-window";

        cpsHud.style.left = config.cpsHudX + "px";
        cpsHud.style.top = config.cpsHudY + "px";
        cpsHud.style.width = "150px";

        cpsHud.style.display =
            config.cpsGuiVisible ? "block" : "none";

        const header = document.createElement("div");

        header.className = "sp-header";

        header.innerText = "Cookie CPS";

        const body = document.createElement("div");

        body.className = "sp-body";

        const cpsText = document.createElement("div");

        cpsText.className = "sp-stat";

        const sub = document.createElement("div");

        sub.className = "sp-sub";

        sub.innerText = "Clicks Per Second";

        body.appendChild(cpsText);

        body.appendChild(sub);

        cpsHud.appendChild(header);

        cpsHud.appendChild(body);

        document.body.appendChild(cpsHud);

        const bigCookie = document.getElementById("bigCookie");

        if (bigCookie) {
            addListener(bigCookie, "mousedown", () => {
                clicks.push(Date.now());
            });
        }

        cpsLoop = setInterval(() => {

            const now = Date.now();

            clicks = clicks.filter(t => now - t < 1000);

            cpsText.innerText = clicks.length;

        }, 100);

        makeDraggable(
            cpsHud,
            header,
            (x, y) => {

                config.cpsHudX = x;
                config.cpsHudY = y;

                saveSettings();
            }
        );
    }

    function toggleCPSGUI() {

        config.cpsGuiVisible = !config.cpsGuiVisible;

        cpsHud.style.display =
            config.cpsGuiVisible ? "block" : "none";

        saveSettings();

        updateMenuState();
    }

    let cheatMenu = null;

    function createButton(text, callback) {

        const btn = document.createElement("button");

        btn.className = "sp-button";

        btn.innerText = text;

        btn.addEventListener("click", callback);

        return btn;
    }

    function createCheatMenu() {

        cheatMenu = document.createElement("div");

        cheatMenu.className = "sp-window";

        cheatMenu.style.left = config.cheatMenuX + "px";
        cheatMenu.style.top = config.cheatMenuY + "px";

        cheatMenu.style.display =
            config.cheatMenuVisible ? "block" : "none";

        const header = document.createElement("div");

        header.className = "sp-header";

        header.innerText = "Cookie Utilities";

        const body = document.createElement("div");

        body.className = "sp-body";

        body.appendChild(
            createButton("Spawn Golden Cookie", () => {
                new Game.shimmer("golden");
            })
        );

        body.appendChild(
            createButton("Spawn Reindeer", () => {
                new Game.shimmer("reindeer");
            })
        );

        body.appendChild(
            createButton("+1 Million Cookies", () => {
                Game.Earn(1000000);
            })
        );

        body.appendChild(
            createButton("x10 Cookies", () => {
                Game.Earn(Game.cookies * 9);
            })
        );

        body.appendChild(
            createButton("Unlock All Achievements", () => {

                Object.values(Game.AchievementsById).forEach(a => {
                    Game.Win(a.name);
                });
            })
        );

        body.appendChild(
            createButton("Unlock All Upgrades", () => {

                Object.values(Game.UpgradesById).forEach(upgrade => {

                    if (
                        !upgrade.bought &&
                        upgrade.pool !== "prestige"
                    ) {
                        upgrade.unlock();

                        upgrade.buy(true);
                    }
                });
            })
        );

        cheatMenu.appendChild(header);

        cheatMenu.appendChild(body);

        document.body.appendChild(cheatMenu);

        makeDraggable(
            cheatMenu,
            header,
            (x, y) => {

                config.cheatMenuX = x;
                config.cheatMenuY = y;

                saveSettings();
            }
        );
    }

    function toggleCheatMenu() {

        config.cheatMenuVisible =
            !config.cheatMenuVisible;

        cheatMenu.style.display =
            config.cheatMenuVisible ? "block" : "none";

        saveSettings();

        updateMenuState();
    }

    function makeDraggable(element, handle, callback) {

        let dragging = false;

        let offsetX = 0;
        let offsetY = 0;

        addListener(handle, "mousedown", (e) => {

            dragging = true;

            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
        });

        addListener(document, "mousemove", (e) => {

            if (!dragging) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            element.style.left = x + "px";
            element.style.top = y + "px";

            callback(x, y);
        });

        addListener(document, "mouseup", () => {
            dragging = false;
        });
    }

    function bindKeys() {

        addListener(document, "keydown", e => {

            if (destroyed) return;

            switch (e.key) {

                case "F2":
                    e.preventDefault();
                    toggleCPSGUI();
                    break;

                case "F4":
                    e.preventDefault();
                    toggleCheatMenu();
                    break;

                case "F6":
                    e.preventDefault();
                    toggleAutoclick();
                    break;

                case "Escape":
                    if (config.cheatMenuVisible) {
                        toggleCheatMenu();
                    }
                    break;
            }
        });
    }

    function unload() {

        destroyed = true;

        clearInterval(masterLoop);
        clearInterval(buyLoop);
        clearInterval(cpsLoop);

        cleanupListeners();

        if (originalUpdateMenu && Game) {
            Game.UpdateMenu = originalUpdateMenu;
        }

        document.getElementById("settingsPlus")?.remove();

        document.getElementById("spStyles")?.remove();

        cpsHud?.remove();

        cheatMenu?.remove();

        notify("Settings Plus", "Unloaded");
    }

    waitForGame();

})();
