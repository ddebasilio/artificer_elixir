import { ElixirApp } from "./elixir-app.js";

const MODULE_ID = "artificer-elixir";
const _elixirApps = new Map();

Hooks.once('init', function () {
    console.log("Artificer Elixirs | Initializing");

    game.settings.register(MODULE_ID, "showElixirTab", {
        name: "Show Elixirs Tab",
        hint: "Display the Experimental Elixirs tab on actor sheets.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false
    });
});
Hooks.once('ready', function () {
    const baseApi = game.modules.get("base-module")?.api;
    if (baseApi && baseApi.registerTab) {
        baseApi.registerTab({
            tabId: "artificer-elixir",
            tabTitle: "Experimental Elixirs",
            iconClass: "fas fa-wine-bottle",
            shouldShow: (actor) => shouldShowElixirTab(actor),
            render: (actor, tabEl) => renderElixirTab(actor, tabEl)
        });
    } else {
        setupStandaloneTabInjection();
    }

    window.ArtificerElixirs = {
        showElixirApp: (actor) => openElixirApp(actor)
    };

    console.log("Artificer Elixirs | Ready");
});

function shouldShowElixirTab(actor) {
    if (!game.settings.get(MODULE_ID, "showElixirTab")) return false;
    if (actor.type !== 'character') return false;

    // Auto-check if they have Alchemist subclass
    let isAlchemist = false;
    if (actor.classes) {
        const artificerClass = actor.classes.artificer;
        if (artificerClass) {
            const subName = artificerClass.subclass?.name ?? "";
            if (subName.toLowerCase().includes("alchemist")) {
                isAlchemist = true;
            }
        }
    }
    if (!isAlchemist) {
        for (const item of actor.items) {
            if (item.type === "subclass" && item.name.toLowerCase().includes("alchemist")) {
                isAlchemist = true;
                break;
            }
        }
    }
    const subclassText = actor.system?.details?.subclass || "";
    if (subclassText.toLowerCase().includes("alchemist")) {
        isAlchemist = true;
    }
    return isAlchemist;
}

function renderElixirTab(actor, tabEl) {
    let appInstance = _elixirApps.get(actor.id);
    if (!appInstance) {
        appInstance = new ElixirApp(actor);
        _elixirApps.set(actor.id, appInstance);
    }
    appInstance.renderInline(tabEl);
}

function setupStandaloneTabInjection() {
    const hookNames = [
        'renderActorSheet',
        'renderActorSheet5eCharacter',
        'renderActorSheet5eCharacter2',
        'renderActorSheet5eNPC',
        'renderActorSheet5eNPC2',
        'renderActorSheet5eVehicle',
        'renderActorSheet5eVehicle2',
        'renderCharacterSheet5e',
        'renderNPCSheet5e',
        'renderApplication',
        'renderApplicationV2',
    ];
    
    hookNames.forEach(hookName => {
        Hooks.on(hookName, (app, html) => injectElixirTab(app, html));
    });
}

async function injectElixirTab(app, htmlArg) {
    try {
        const actor = app.document ?? app.object ?? app.actor;
        if (!actor || actor.documentName !== 'Actor') return;

        if (!shouldShowElixirTab(actor)) return;

        let root = htmlArg instanceof HTMLElement
            ? htmlArg
            : (htmlArg?.length ? htmlArg[0] : null);

        root = root?.closest?.('.application') ?? root;

        const appEl = app.element instanceof HTMLElement
            ? app.element
            : (app.element?.length ? app.element[0] : null);

        if (appEl && !root?.querySelector?.('nav.tabs, nav[data-group]')) {
            root = appEl;
        }

        if (!root) return;

        const NAV_SELECTORS = [
            'nav.tabs[data-group="primary"]',
            'nav[data-group="primary"]',
            'nav[data-tabs="primary"]',
            'nav.tabs.tabs-primary',
            'nav.primary-tabs',
            'nav.sheet-navigation',
            'nav.sheet-tabs',
            'nav.tabs',
        ];

        let tabsNav = null;
        for (const sel of NAV_SELECTORS) {
            tabsNav = root.querySelector(sel);
            if (tabsNav) break;
        }

        if (!tabsNav) return;

        const tabBody = root.querySelector('.tab-body, .sheet-body, form, .sheet-content');
        if (!tabBody) return;

        const tabId = "artificer-elixir";
        const tabTitle = "Experimental Elixirs";
        const iconClass = "fas fa-wine-bottle";
        const tabBtnClass = `af-${tabId}-nav-item`;

        // Avoid duplicate button injection
        let navItem = tabsNav.querySelector(`.${tabBtnClass}`);
        if (!navItem) {
            navItem = document.createElement('a');
            
            const firstLink = tabsNav.querySelector('a.item, a[data-tab], a.tab-control');
            let baseClasses = "item";
            if (firstLink) {
                baseClasses = firstLink.className.replace(/\bactive\b/g, "").replace(/\baria-selected\b/g, "").trim();
            }
            navItem.className = `${baseClasses} ${tabBtnClass}`;
            navItem.dataset.tab = tabId;
            navItem.title = tabTitle;

            if (firstLink) {
                const hasLabel = firstLink.querySelector('label') !== null;
                const tooltip = firstLink.dataset.tooltip || firstLink.getAttribute('data-tooltip');
                const hasVisibleText = firstLink.textContent.trim().length > 0;

                if (hasLabel) {
                    navItem.innerHTML = `<i class="${iconClass}"></i>`;
                } else if (tooltip && !hasVisibleText) {
                    navItem.innerHTML = `<i class="${iconClass}"></i>`;
                    navItem.dataset.tooltip = tabTitle;
                    navItem.setAttribute('aria-label', tabTitle);
                } else {
                    navItem.innerHTML = `<i class="${iconClass}"></i>`;
                }
            } else {
                navItem.innerHTML = `<i class="${iconClass}"></i>`;
            }
            tabsNav.appendChild(navItem);
        }

        // Check if active
        let isTabActive = false;
        if (app.tabGroups?.primary === tabId) {
            isTabActive = true;
        } else if (Array.isArray(app._tabs)) {
            for (const t of app._tabs) {
                if (t.group === 'primary' && t.active === tabId) {
                    isTabActive = true;
                    break;
                }
            }
        }

        const tabClassBase = `artificer-${tabId}-tab`;
        let customTab = tabBody.querySelector(`.${tabClassBase}`);
        if (!customTab) {
            customTab = document.createElement('div');
            customTab.className = `tab ${tabClassBase}`;
            customTab.dataset.group = 'primary';
            customTab.dataset.tab = tabId;
            
            const featuresTab = root.querySelector('[data-tab="features"], [data-tab="biography"], [data-tab="description"]');
            if (featuresTab) {
                featuresTab.parentElement.appendChild(customTab);
            } else {
                tabBody.appendChild(customTab);
            }
        }

        if (isTabActive) {
            navItem.classList.add('active');
            navItem.ariaSelected = "true";

            // Deactivate other nav items
            tabsNav.querySelectorAll('.item').forEach(item => {
                if (item !== navItem) {
                    item.classList.remove('active');
                    item.removeAttribute('aria-selected');
                }
            });

            // Hide other tabs
            tabBody.querySelectorAll('.tab').forEach(tab => {
                if (tab !== customTab) {
                    tab.classList.remove('active');
                    tab.style.display = 'none';
                }
            });

            customTab.classList.add('active');
            customTab.style.display = '';
            renderElixirTab(actor, customTab);
        } else {
            customTab.classList.remove('active');
            customTab.style.display = 'none';
        }

        // Click listener for tab button
        if (!navItem._hasClickListener) {
            navItem._hasClickListener = true;
            navItem.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (app.tabGroups) {
                    app.tabGroups.primary = tabId;
                }
                if (Array.isArray(app._tabs)) {
                    for (const t of app._tabs) {
                        if (t.group === 'primary') {
                            t.active = tabId;
                        }
                    }
                }

                // Deactivate other nav items
                tabsNav.querySelectorAll('.item').forEach(item => {
                    if (item !== navItem) {
                        item.classList.remove('active');
                        item.removeAttribute('aria-selected');
                    }
                });

                // Activate this nav item
                navItem.classList.add('active');
                navItem.ariaSelected = "true";

                // Show custom tab, hide others
                tabBody.querySelectorAll('.tab').forEach(tab => {
                    if (tab === customTab) {
                        tab.classList.add('active');
                        tab.style.display = 'block';
                    } else {
                        tab.classList.remove('active');
                        tab.style.display = 'none';
                    }
                });

                renderElixirTab(actor, customTab);
            });
        }

        // Listen to all other nav clicks to hide our custom tab
        tabsNav.querySelectorAll('.item').forEach(item => {
            const isCustomTab = `af-${tabId}-nav-item` === item.className || item.dataset.tab === tabId;
            if (!isCustomTab && !item._hasElixirTabListener) {
                item._hasElixirTabListener = true;
                item.addEventListener('click', () => {
                    // Navigate away from custom tab in trackers
                    if (app.tabGroups && app.tabGroups.primary === tabId) {
                        app.tabGroups.primary = item.dataset.tab;
                    }
                    if (Array.isArray(app._tabs)) {
                        for (const t of app._tabs) {
                            if (t.group === 'primary' && t.active === tabId) {
                                t.active = item.dataset.tab;
                            }
                        }
                    }

                    // Deactivate custom button and hide custom content tab
                    navItem.classList.remove('active');
                    navItem.removeAttribute('aria-selected');
                    customTab.classList.remove('active');
                    customTab.style.display = 'none';

                    // Show clicked native tab
                    tabBody.querySelectorAll('.tab').forEach(tab => {
                        const isSomeCustom = tab.classList.contains(`artificer-${tabId}-tab`);
                        if (!isSomeCustom && tab.dataset.tab === item.dataset.tab) {
                            tab.classList.add('active');
                            tab.style.display = '';
                        }
                    });
                });
            }
        });

    } catch (err) {
        console.error("Artificer Elixirs | Error injecting dedicated tab:", err);
    }
}

function openElixirApp(actor) {
    if (!actor) return;
    actor.sheet.render(true);
    const selectTab = () => {
        const sheetEl = actor.sheet.element instanceof HTMLElement ? actor.sheet.element : actor.sheet.element?.[0];
        const tabBtn = sheetEl?.querySelector?.('.af-artificer-elixir-nav-item');
        if (tabBtn) {
            tabBtn.click();
        }
        else setTimeout(selectTab, 50);
    };
    setTimeout(selectTab, 100);
}

// Add sheet header button
[
    'getActorSheet5eCharacter2HeaderButtons',
    'getActorSheet5eNPC2HeaderButtons',
].forEach(hookName => {
    Hooks.on(hookName, (app, buttons) => {
        const actor = app.document ?? app.object ?? app.actor;
        if (!actor || actor.documentName !== 'Actor' || actor.type !== 'character') return;

        // Auto-check if they have Alchemist subclass
        let isAlchemist = false;
        for (const item of actor.items) {
            if (item.type === "subclass" && item.name.toLowerCase().includes("alchemist")) {
                isAlchemist = true;
                break;
            }
        }
        const subclassText = actor.system?.details?.subclass || "";
        if (subclassText.toLowerCase().includes("alchemist")) {
            isAlchemist = true;
        }

        if (!isAlchemist) return;
        if (!game.settings.get(MODULE_ID, "showElixirTab")) return;
        if (buttons.some(b => b.action === MODULE_ID)) return;
        
        buttons.unshift({
            action: MODULE_ID,
            icon: 'fas fa-wine-bottle',
            label: 'Elixirs',
            onClick: () => openElixirApp(actor)
        });
    });
});

// Handle interactive elixir buttons in chat cards
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    const $html = $(html);
    // Start roll button
    $html.find('.af-elixir-start-roll-btn').click(async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const actorId = btn.dataset.actorId;
        const total = parseInt(btn.dataset.total || "1");
        const current = parseInt(btn.dataset.current || "1");

        const actor = game.actors.get(actorId);
        if (!actor) return;

        if (!actor.isOwner) {
            ui.notifications.warn("You do not own this character to roll.");
            return;
        }

        // Evaluate the roll using standard Foundry dice roll
        const roll = new Roll("1d6");
        await roll.evaluate();
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `Rolling Daily Elixir #${current} of ${total}`
        });

        const result = roll.total;
        const intMod = actor.system.abilities?.int?.mod || 0;
        let levels = 3;
        for (const item of actor.items) {
            if (item.type === "class" && item.name.toLowerCase().includes("artificer")) {
                levels = item.system.levels ?? 3;
                break;
            }
        }
        const app = new ElixirApp(actor);
        const definitions = ElixirApp.getElixirDefinitions(levels, intMod);

        if (result === 6) {
            const updatedContent = `
                <div class="af-elixir-chat-msg" style="padding: 5px; border-left: 3px solid #ff6400;">
                    <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Daily Elixir #${current} of ${total}</strong></p>
                    <p>${actor.name} rolled a <strong>6 (Choice)</strong>! Choice card has been posted.</p>
                </div>
            `;
            await message.update({ content: updatedContent });

            await ChatMessage.create({
                content: `
                    <div class="af-elixir-choice-card" data-actor-id="${actor.id}" data-index="${current}" data-total="${total}">
                        <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Experimental Elixir #${current}: Choice!</strong></p>
                        <p>${actor.name} rolled a 6. Choose which effect to produce:</p>
                        <div class="elixir-choices-row" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                            <button type="button" class="elixir-choice-btn" data-actor-id="${actor.id}" data-elixir-name="Healing" data-current="${current}" data-total="${total}" style="flex: 1 1 45%; font-size: 11px; padding: 4px 6px;">Healing</button>
                            <button type="button" class="elixir-choice-btn" data-actor-id="${actor.id}" data-elixir-name="Swiftness" data-current="${current}" data-total="${total}" style="flex: 1 1 45%; font-size: 11px; padding: 4px 6px;">Swiftness</button>
                            <button type="button" class="elixir-choice-btn" data-actor-id="${actor.id}" data-elixir-name="Resilience" data-current="${current}" data-total="${total}" style="flex: 1 1 45%; font-size: 11px; padding: 4px 6px;">Resilience</button>
                            <button type="button" class="elixir-choice-btn" data-actor-id="${actor.id}" data-elixir-name="Boldness" data-current="${current}" data-total="${total}" style="flex: 1 1 45%; font-size: 11px; padding: 4px 6px;">Boldness</button>
                            <button type="button" class="elixir-choice-btn" data-actor-id="${actor.id}" data-elixir-name="Flight" data-current="${current}" data-total="${total}" style="flex: 1 1 45%; font-size: 11px; padding: 4px 6px;">Flight</button>
                        </div>
                    </div>
                `,
                speaker: ChatMessage.getSpeaker({ actor })
            });
        } else {
            const elixir = definitions.find(e => e.id === result);
            if (elixir) {
                await app._awardElixir(elixir.name, definitions);

                const updatedContent = `
                    <div class="af-elixir-chat-msg" style="padding: 5px; border-left: 3px solid #ff6400;">
                        <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Daily Elixir #${current} of ${total}</strong></p>
                        <p>${actor.name} rolled a <strong>${result}</strong> and obtained an <strong>Elixir of ${elixir.name}</strong>!</p>
                    </div>
                `;
                await message.update({ content: updatedContent });

                if (current < total) {
                    await ChatMessage.create({
                        content: `
                            <div class="af-elixir-roll-request-card" data-actor-id="${actor.id}">
                                <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Experimental Elixirs Request</strong></p>
                                <p>${actor.name} has rolled ${current} of ${total} elixirs.</p>
                                <button type="button" class="af-elixir-start-roll-btn" data-actor-id="${actor.id}" data-total="${total}" data-current="${current + 1}" style="width: 100%; margin-top: 5px;">
                                    <i class="fas fa-dice"></i> Roll Elixir #${current + 1} (of ${total})
                                </button>
                            </div>
                        `,
                        speaker: ChatMessage.getSpeaker({ actor })
                    });
                }
            }
        }
    });

    // Choice select button
    $html.find('.elixir-choice-btn').click(async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const actorId = btn.dataset.actorId;
        const elixirName = btn.dataset.elixirName;
        const current = parseInt(btn.dataset.current || "0");
        const total = parseInt(btn.dataset.total || "0");

        const actor = game.actors.get(actorId);
        if (!actor) return;

        if (!actor.isOwner) {
            ui.notifications.warn("You do not own this character to select an elixir.");
            return;
        }

        const app = new ElixirApp(actor);
        await app._awardElixir(elixirName);

        const updatedContent = `
            <div class="af-elixir-chat-msg" style="padding: 5px; border-left: 3px solid #ff6400;">
                <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Elixir Choice Made</strong></p>
                <p>${actor.name} selected: <strong>${elixirName}</strong>.</p>
            </div>
        `;
        await message.update({ content: updatedContent });

        if (current && total && current < total) {
            await ChatMessage.create({
                content: `
                    <div class="af-elixir-roll-request-card" data-actor-id="${actor.id}">
                        <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Experimental Elixirs Request</strong></p>
                        <p>${actor.name} has rolled ${current} of ${total} elixirs.</p>
                        <button type="button" class="af-elixir-start-roll-btn" data-actor-id="${actor.id}" data-total="${total}" data-current="${current + 1}" style="width: 100%; margin-top: 5px;">
                            <i class="fas fa-dice"></i> Roll Elixir #${current + 1} (of ${total})
                        </button>
                    </div>
                `,
                speaker: ChatMessage.getSpeaker({ actor })
            });
        }
        
        ui.notifications.info(`Added Elixir of ${elixirName} to ${actor.name}.`);
    });
});

// Automatically apply active effects to the actor when an Elixir consumable is used/drunk
Hooks.on("dnd5e.useItem", async (item, config, options) => {
    const elixirNames = ["Elixir of Healing", "Elixir of Swiftness", "Elixir of Resilience", "Elixir of Boldness", "Elixir of Flight"];
    if (!elixirNames.includes(item.name)) return;

    const actor = item.actor;
    if (!actor) return;

    // Apply any active effects defined on the item to the actor
    const effectsToCreate = item.effects.map(effect => {
        const effectData = effect.toObject();
        effectData.transfer = false; // ensure they are applied as temporary effects, not passive item effects
        effectData.origin = actor.uuid; // link the origin to the actor so it remains when item is deleted
        return effectData;
    });

    if (effectsToCreate.length > 0) {
        await actor.createEmbeddedDocuments("ActiveEffect", effectsToCreate);
        ui.notifications.info(`Applied ${item.name} effects to ${actor.name}.`);
    }
});

// Automatically apply active effects to the actor when an Elixir activity is used/drunk (pre-use ensures item has not been destroyed yet)
Hooks.on("dnd5e.preUseActivity", async (activity, config, options) => {
    const item = activity.item;
    if (!item) return;

    const elixirNames = ["Elixir of Healing", "Elixir of Swiftness", "Elixir of Resilience", "Elixir of Boldness", "Elixir of Flight"];
    if (!elixirNames.includes(item.name)) return;

    const actor = item.actor;
    if (!actor) return;

    // Apply any active effects defined on the item to the actor
    const effectsToCreate = item.effects.map(effect => {
        const effectData = effect.toObject();
        effectData.transfer = false;
        effectData.origin = actor.uuid;
        return effectData;
    });

    if (effectsToCreate.length > 0) {
        await actor.createEmbeddedDocuments("ActiveEffect", effectsToCreate);
        ui.notifications.info(`Applied ${item.name} effects to ${actor.name}.`);
    }
});

