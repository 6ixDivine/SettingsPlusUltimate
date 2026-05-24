// ==UserScript==
// @name         SettingsPlus
// @namespace    SettingsPlus
// @version      3.1.0
// @description  SettingsPlus + CPS GUI + 6ixMenu Combined
// @author       6ixDivine
// @match        https://orteil.dashnet.org/cookieclicker/*
// @match        https://cookieclicker.ee/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict"


    if (window.__SETTINGSPLUS_ULTIMATE__) return
    window.__SETTINGSPLUS_ULTIMATE__ = true


    let destroyed = false

    let masterLoop = null
    let buyLoop = null
    let cpsLoop = null

    let originalUpdateMenu = null

    const STORAGE_KEY = "SettingsPlusUltimate_Config"

    const BUY_INTERVAL_OPTIONS = [1, 2, 4, 6, 12, 24]

    const config = {
        autoclick: false,
        autoGolden: false,
        cps: 30,

        autoBuyBuildings: false,
        autoBuyUpgrades: false,

        buyBuilding: "Cursor",
        buyInterval: 1,

        cpsGuiVisible: true,
        cheatMenuVisible: false,

        cpsHudX: 20,
        cpsHudY: 20,

        cheatMenuX: window.innerWidth / 2,
        cheatMenuY: window.innerHeight / 2
    }


    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))

            if (saved && typeof saved === "object") {
                Object.assign(config, saved)
            }
        } catch (e) {}
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    }

    function notify(title, message) {
        if (!window.Game || !Game.Notify) return

        Game.Notify(title, message, [16, 5])
    }


    function waitForGame() {
        if (typeof Game !== "undefined" && Game.ready) {
            init()
        } else {
            setTimeout(waitForGame, 1000)
        }
    }

    function init() {
        if (destroyed) return

        loadSettings()

        hookMenu()

        createCPSGUI()

        createCheatMenu()

        bindKeys()

        startMasterLoop()

        startBuyLoop()

        notify("SettingsPlus Ultimate", "Loaded")
    }



    function hookMenu() {
        if (!Game || !Game.UpdateMenu) return

        if (originalUpdateMenu) return

        originalUpdateMenu = Game.UpdateMenu

        const previous = Game.UpdateMenu

        Game.UpdateMenu = function (...args) {
            previous.apply(this, args)

            if (destroyed) return

            if (Game.onMenu === "prefs") {
                injectUI()
            }
        }
    }



    function injectUI() {
        const menu = document.getElementById("menu")

        if (!menu) return

        if (document.getElementById("settingsPlusUltimate")) return

        const section = document.createElement("div")

        section.id = "settingsPlusUltimate"

        section.className = "subsection"

        const buildings = Object.keys(Game.Objects || {})

        section.innerHTML = `
            <div class="title">SettingsPlus Ultimate</div>

            <div class="listing">
                <a class="option" id="autoClickToggle">
                    Auto Clicker (${config.autoclick ? "ON" : "OFF"}) [F6]
                </a>

                <a class="option" id="goldenToggle">
                    Auto Golden Cookies (${config.autoGolden ? "ON" : "OFF"})
                </a>

                <a class="option" id="autoBuyBuildingsToggle">
                    Auto Buy Buildings (${config.autoBuyBuildings ? "ON" : "OFF"})
                </a>

                <a class="option" id="autoBuyUpgradesToggle">
                    Auto Buy Upgrades (${config.autoBuyUpgrades ? "ON" : "OFF"})
                </a>
            </div>

            <div class="listing">
                <a class="option" id="toggleCPSGUI">
                    CPS GUI (${config.cpsGuiVisible ? "ON" : "OFF"}) [F2]
                </a>

                <a class="option" id="toggleCheatMenu">
                    Cheat Menu (${config.cheatMenuVisible ? "ON" : "OFF"}) [F4]
                </a>
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
                        ${BUY_INTERVAL_OPTIONS.map(v => `
                            <option value="${v}">
                                ${v}s
                            </option>
                        `).join("")}
                    </select>

                    <span id="intervalLabel"></span>
                </div>
            </div>

            <div class="listing">
                <a class="option" id="UnloadBtn">
                    Unload
                </a>
            </div>
        `

        const sections = menu.getElementsByClassName("section")

        if (sections.length > 0) {
            sections[sections.length - 1].appendChild(section)
        } else {
            menu.appendChild(section)
        }

        const buildingSelect = document.getElementById("buildingSelect")

        const intervalSelect = document.getElementById("intervalSelect")

        buildings.forEach(b => {
            const opt = document.createElement("option")

            opt.value = b

            opt.textContent = b

            buildingSelect.appendChild(opt)
        })

        buildingSelect.value = config.buyBuilding

        intervalSelect.value = config.buyInterval

        function updateLabels() {
            const bl = document.getElementById("buildingLabel")

            const il = document.getElementById("intervalLabel")

            if (bl) {
                bl.textContent = ` → ${config.buyBuilding}`
            }

            if (il) {
                il.textContent = ` → every ${config.buyInterval}s`
            }
        }

        updateLabels()

        buildingSelect.addEventListener("change", e => {
            config.buyBuilding = e.target.value

            saveSettings()

            updateLabels()
        })

        intervalSelect.addEventListener("change", e => {
            config.buyInterval = parseInt(e.target.value)

            saveSettings()

            restartBuyLoop()

            updateLabels()
        })

        document.getElementById("autoClickToggle")
            .addEventListener("click", toggleAutoclick)

        document.getElementById("goldenToggle")
            .addEventListener("click", toggleGolden)

        document.getElementById("autoBuyBuildingsToggle")
            .addEventListener("click", toggleAutoBuyBuildings)

        document.getElementById("autoBuyUpgradesToggle")
            .addEventListener("click", toggleAutoBuyUpgrades)

        document.getElementById("toggleCPSGUI")
            .addEventListener("click", toggleCPSGUI)

        document.getElementById("toggleCheatMenu")
            .addEventListener("click", toggleCheatMenu)

        document.getElementById("UnloadBtn")
            .addEventListener("click", unload)

        updateUI()
    }

    function updateUI() {
        const a = document.getElementById("autoClickToggle")

        const g = document.getElementById("goldenToggle")

        const b = document.getElementById("autoBuyBuildingsToggle")

        const u = document.getElementById("autoBuyUpgradesToggle")

        const cps = document.getElementById("toggleCPSGUI")

        const cheat = document.getElementById("toggleCheatMenu")

        if (a) {
            a.textContent =
                `Auto Clicker (${config.autoclick ? "ON" : "OFF"}) [F6]`
        }

        if (g) {
            g.textContent =
                `Auto Golden Cookies (${config.autoGolden ? "ON" : "OFF"})`
        }

        if (b) {
            b.textContent =
                `Auto Buy Buildings (${config.autoBuyBuildings ? "ON" : "OFF"})`
        }

        if (u) {
            u.textContent =
                `Auto Buy Upgrades (${config.autoBuyUpgrades ? "ON" : "OFF"})`
        }

        if (cps) {
            cps.textContent =
                `CPS GUI (${config.cpsGuiVisible ? "ON" : "OFF"}) [F2]`
        }

        if (cheat) {
            cheat.textContent =
                `Cheat Menu (${config.cheatMenuVisible ? "ON" : "OFF"}) [F4]`
        }
    }



    function startMasterLoop() {
        if (masterLoop) return

        masterLoop = setInterval(() => {

            if (destroyed || !Game?.ready) return

            if (config.autoclick && !Game.OnAscend) {
                Game.ClickCookie()
            }

            if (config.autoGolden) {
                for (const s of Game.shimmers) {
                    if (s.type === "golden") {
                        s.pop()
                    }
                }
            }

        }, 1000 / config.cps)
    }



    function startBuyLoop() {
        if (buyLoop) return

        buyLoop = setInterval(() => {

            if (destroyed || !Game?.ready) return

            if (config.autoBuyBuildings) {

                const obj = Game.Objects?.[config.buyBuilding]

                if (obj && Game.cookies >= obj.getPrice()) {
                    obj.buy(1)
                }
            }

            if (config.autoBuyUpgrades) {

                for (const upg of Game.UpgradesInStore || []) {

                    if (
                        upg &&
                        !upg.bought &&
                        Game.cookies >= upg.getPrice()
                    ) {
                        upg.buy()
                        break
                    }
                }
            }

        }, config.buyInterval * 1000)
    }

    function restartBuyLoop() {
        clearInterval(buyLoop)

        buyLoop = null

        startBuyLoop()
    }



    function toggleAutoclick() {
        config.autoclick = !config.autoclick

        saveSettings()

        notify(
            "SettingsPlus Ultimate",
            config.autoclick
                ? "Auto Click Enabled"
                : "Auto Click Disabled"
        )

        updateUI()
    }

    function toggleGolden() {
        config.autoGolden = !config.autoGolden

        saveSettings()

        notify(
            "SettingsPlus Ultimate",
            config.autoGolden
                ? "Auto Golden Enabled"
                : "Auto Golden Disabled"
        )

        updateUI()
    }

    function toggleAutoBuyBuildings() {
        config.autoBuyBuildings = !config.autoBuyBuildings

        saveSettings()

        updateUI()
    }

    function toggleAutoBuyUpgrades() {
        config.autoBuyUpgrades = !config.autoBuyUpgrades

        saveSettings()

        updateUI()
    }



    let clicks = []

    let cpsHud = null

    function createCPSGUI() {

        cpsHud = document.createElement("div")

        Object.assign(cpsHud.style, {
            position: "fixed",
            left: config.cpsHudX + "px",
            top: config.cpsHudY + "px",
            zIndex: "999999",
            width: "100px",
            borderRadius: "10px",
            background: "rgba(15,15,20,0.9)",
            color: "#00ffcc",
            fontFamily: "Arial",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            userSelect: "none",
            overflow: "hidden",
            display: config.cpsGuiVisible ? "block" : "none"
        })

        document.body.appendChild(cpsHud)

        const header = document.createElement("div")

        header.innerText = "CPS"

        Object.assign(header.style, {
            padding: "6px",
            cursor: "grab",
            fontWeight: "bold",
            background: "linear-gradient(90deg,#00c6ff,#0072ff)",
            color: "#fff"
        })

        cpsHud.appendChild(header)

        const body = document.createElement("div")

        Object.assign(body.style, {
            padding: "10px",
            fontSize: "20px",
            textAlign: "center",
            fontWeight: "700"
        })

        cpsHud.appendChild(body)

        window.addEventListener("mousedown", () => {
            clicks.push(Date.now())
        }, true)

        cpsLoop = setInterval(() => {

            const now = Date.now()

            clicks = clicks.filter(t => now - t < 1000)

            body.innerText = clicks.length

        }, 100)

        let dragging = false

        let offsetX = 0

        let offsetY = 0

        header.addEventListener("mousedown", (e) => {

            dragging = true

            offsetX = e.clientX - cpsHud.offsetLeft

            offsetY = e.clientY - cpsHud.offsetTop
        })

        window.addEventListener("mousemove", (e) => {

            if (!dragging) return

            config.cpsHudX = e.clientX - offsetX

            config.cpsHudY = e.clientY - offsetY

            cpsHud.style.left = config.cpsHudX + "px"

            cpsHud.style.top = config.cpsHudY + "px"
        })

        window.addEventListener("mouseup", () => {

            dragging = false

            saveSettings()
        })
    }

    function toggleCPSGUI() {

        config.cpsGuiVisible = !config.cpsGuiVisible

        cpsHud.style.display =
            config.cpsGuiVisible ? "block" : "none"

        saveSettings()

        updateUI()
    }



    let cheatMenu = null

    function spawnGoldenCookie() {
        if (window.Game) {
            new Game.shimmer("golden")
        }
    }

    function addCookies(amount) {
        if (window.Game) {
            Game.Earn(amount)
        }
    }

    function multiplyCookies(multiplier) {
        if (window.Game) {
            Game.cookies *= multiplier
        }
    }

    function unlockAllUpgrades() {
        if (!window.Game) return

        Object.values(Game.UpgradesById).forEach(upgrade => {
            if (!upgrade.bought) {
                upgrade.unlock()
                upgrade.buy(true)
            }
        })
    }

    function unlockAllAchievements() {
        if (!window.Game) return

        Object.values(Game.AchievementsById).forEach(achievement => {
            Game.Win(achievement.name)
        })
    }

    function createButton(text, color, callback) {
        const btn = document.createElement("button")

        btn.innerText = text

        Object.assign(btn.style, {
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            background: color,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            color: "white",
            transition: "0.15s ease",
            boxShadow: "0 3px 8px rgba(0,0,0,0.3)"
        })

        btn.addEventListener("mouseenter", () => {
            btn.style.transform = "scale(1.03)"
            btn.style.filter = "brightness(1.1)"
        })

        btn.addEventListener("mouseleave", () => {
            btn.style.transform = "scale(1)"
            btn.style.filter = "brightness(1)"
        })

        btn.addEventListener("click", callback)

        return btn
    }

    function createCheatMenu() {

        cheatMenu = document.createElement("div")

        Object.assign(cheatMenu.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "300px",
            background: "linear-gradient(180deg, #1e1e1e, #111)",
            border: "1px solid #333",
            borderRadius: "14px",
            zIndex: "999999",
            boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
            fontFamily: "Arial",
            color: "white",
            display: config.cheatMenuVisible ? "block" : "none",
            userSelect: "none",
            overflow: "hidden"
        })

        const header = document.createElement("div")

        Object.assign(header.style, {
            background: "linear-gradient(90deg, #6a00ff, #8e2de2)",
            padding: "14px",
            cursor: "move",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "18px",
            letterSpacing: "1px"
        })

        header.innerText = "6ixMenu"

        const body = document.createElement("div")

        body.style.padding = "15px"

        body.appendChild(
            createButton("Spawn Golden Cookie", "#f1c40f", spawnGoldenCookie)
        )

        body.appendChild(
            createButton("+1 Million Cookies", "#27ae60", () => addCookies(1000000))
        )

        body.appendChild(
            createButton("x10 Cookies", "#16a085", () => multiplyCookies(10))
        )

        body.appendChild(
            createButton("Unlock All Achievements", "#9b59b6", unlockAllAchievements)
        )

        body.appendChild(
            createButton("Unlock All Upgrades", "#3498db", unlockAllUpgrades)
        )

        cheatMenu.appendChild(header)

        cheatMenu.appendChild(body)

        document.body.appendChild(cheatMenu)

        let dragging = false

        let offsetX = 0

        let offsetY = 0

        header.addEventListener("mousedown", (e) => {

            dragging = true

            cheatMenu.style.transform = "none"

            offsetX = e.clientX - cheatMenu.offsetLeft

            offsetY = e.clientY - cheatMenu.offsetTop
        })

        document.addEventListener("mousemove", (e) => {

            if (!dragging) return

            cheatMenu.style.left = `${e.clientX - offsetX}px`

            cheatMenu.style.top = `${e.clientY - offsetY}px`
        })

        document.addEventListener("mouseup", () => {
            dragging = false
        })
    }

    function toggleCheatMenu() {

        config.cheatMenuVisible =
            !config.cheatMenuVisible

        cheatMenu.style.display =
            config.cheatMenuVisible ? "block" : "none"

        saveSettings()

        updateUI()
    }



    function bindKeys() {

        document.addEventListener("keydown", e => {

            if (destroyed) return

            switch (e.key) {

                case "F2":
                    e.preventDefault()
                    toggleCPSGUI()
                    break

                case "F4":
                    e.preventDefault()
                    toggleCheatMenu()
                    break

                case "F6":
                    e.preventDefault()
                    toggleAutoclick()
                    break

                case "Escape":
                    if (config.cheatMenuVisible) {
                        toggleCheatMenu()
                    }
                    break
            }
        })
    }



    function unload() {

        destroyed = true

        clearInterval(masterLoop)

        clearInterval(buyLoop)

        clearInterval(cpsLoop)

        if (originalUpdateMenu && Game) {
            Game.UpdateMenu = originalUpdateMenu
        }

        document.getElementById("settingsPlusUltimate")?.remove()

        cpsHud?.remove()

        cheatMenu?.remove()

        notify("SettingsPlus Ultimate", "Unloaded")
    }



    waitForGame()

})()
