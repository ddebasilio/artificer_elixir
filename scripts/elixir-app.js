const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

export class ElixirApp extends HandlebarsApplicationMixin(ApplicationV2) {
    
    constructor(actor = null, options = {}) {
        super(options);
        this.actor = actor;
        this._element = null;
    }

    get element() {
        return this._element || super.element;
    }

    async renderInline(targetElement) {
        this.targetElement = targetElement;
        const context = await this._prepareContext({});
        const html = await renderTemplate("modules/artificer-elixir/templates/elixir-panel.hbs", context);

        this.targetElement.innerHTML = html;
        this._element = this.targetElement;

        this._onRender(context, {});
    }

    render(force = false, options = {}) {
        if (this.targetElement) {
            this.renderInline(this.targetElement);
            return this;
        }
        return super.render(force, options);
    }

    static DEFAULT_OPTIONS = {
        window: { title: "Experimental Elixirs", icon: "fas fa-flask" },
        classes: ["artificer-elixir-app"],
        position: { width: 600, height: 700 }
    };

    static PARTS = {
        panel: { template: "modules/artificer-elixir/templates/elixir-panel.hbs" }
    };

    // ─── Elixir definitions dynamically scaled (EFA supplement) ───────────────────
    static getElixirDefinitions(level, intMod = 0) {
        let healingDice = "2d8";
        if (level >= 15) healingDice = "4d8";
        else if (level >= 9) healingDice = "3d8";

        let swiftnessSpeed = "10 feet";
        if (level >= 15) swiftnessSpeed = "20 feet";
        else if (level >= 9) swiftnessSpeed = "15 feet";

        let resilienceDuration = "10 minutes";
        if (level >= 15) resilienceDuration = "8 hours";
        else if (level >= 9) resilienceDuration = "1 hour";

        let boldnessDuration = "1 minute";
        if (level >= 15) boldnessDuration = "1 hour";
        else if (level >= 9) boldnessDuration = "10 minutes";

        let flightSpeed = "10 feet";
        if (level >= 15) flightSpeed = "30 feet";
        else if (level >= 9) flightSpeed = "20 feet";

        return [
            {
                id: 1,
                name: "Healing",
                description: `The drinker regains ${healingDice} plus your Intelligence modifier (${intMod >= 0 ? "+" : ""}${intMod}) hit points.`,
                img: "icons/consumables/potions/bottle-corked-red.webp"
            },
            {
                id: 2,
                name: "Swiftness",
                description: `The drinker's Speed increases by ${swiftnessSpeed} for 1 hour.`,
                img: "icons/consumables/potions/bottle-corked-green.webp"
            },
            {
                id: 3,
                name: "Resilience",
                description: `The drinker gains a +1 bonus to AC for ${resilienceDuration}.`,
                img: "icons/consumables/potions/bottle-corked-blue.webp"
            },
            {
                id: 4,
                name: "Boldness",
                description: `The drinker can roll 1d4 and add the number rolled to every attack roll and saving throw they make for the next ${boldnessDuration}.`,
                img: "icons/consumables/potions/flask-corked-red-glow.webp"
            },
            {
                id: 5,
                name: "Flight",
                description: `The drinker gains a Fly Speed of ${flightSpeed} for 10 minutes.`,
                img: "icons/consumables/potions/bottle-conical-corked-cyan.webp"
            }
        ];
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if (!this.actor) return context;

        // Detect Artificer Alchemist Level
        let artificerLevel = 0;
        let isAlchemist = false;
        
        if (this.actor.classes) {
            const artificerClass = this.actor.classes.artificer;
            if (artificerClass) {
                artificerLevel = artificerClass.system.levels ?? 0;
                const subName = artificerClass.subclass?.name ?? "";
                if (subName.toLowerCase().includes("alchemist")) {
                    isAlchemist = true;
                }
            }
        }
        
        if (artificerLevel === 0 || !isAlchemist) {
            for (const item of this.actor.items) {
                const nameLower = (item.name ?? "").toLowerCase();
                if (item.type === "class" && nameLower.includes("artificer")) {
                    artificerLevel = item.system.levels ?? 0;
                }
                if (item.type === "subclass" && nameLower.includes("alchemist")) {
                    isAlchemist = true;
                }
            }
        }
        
        const subclassText = this.actor.system?.details?.subclass || "";
        if (subclassText.toLowerCase().includes("alchemist")) {
            isAlchemist = true;
        }

        // Free Daily Elixirs logic (EFA scaling)
        let freeElixirsCount = 0;
        if (isAlchemist && artificerLevel >= 3) {
            if (artificerLevel >= 15) freeElixirsCount = 5;
            else if (artificerLevel >= 9) freeElixirsCount = 4;
            else if (artificerLevel >= 5) freeElixirsCount = 3;
            else freeElixirsCount = 2;
        }

        const intMod = this.actor.system.abilities?.int?.mod || 0;
        const definitions = ElixirApp.getElixirDefinitions(artificerLevel, intMod);

        // Active Elixirs in Inventory
        const inventoryElixirs = [];
        const elixirNames = definitions.map(e => `Elixir of ${e.name}`);

        for (const item of this.actor.items) {
            if (item.type === "consumable" && elixirNames.includes(item.name)) {
                const baseName = item.name.replace("Elixir of ", "");
                const ref = definitions.find(e => e.name === baseName);
                inventoryElixirs.push({
                    id: item.id,
                    name: item.name,
                    quantity: item.system.quantity ?? 1,
                    description: ref?.description || "",
                    img: item.img || "icons/svg/item-bag.svg"
                });
            }
        }

        // Available Spell Slots
        const spellSlots = [];
        const spells = this.actor.system.spells || {};
        for (let i = 1; i <= 9; i++) {
            const slot = spells[`spell${i}`];
            if (slot && slot.max > 0) {
                spellSlots.push({
                    level: i,
                    value: slot.value,
                    max: slot.max
                });
            }
        }

        const dailyRolled = false;
        const hasSpellSlots = spellSlots.some(s => s.value > 0);

        Object.assign(context, {
            alchemistLevel: artificerLevel,
            freeElixirsCount,
            inventoryElixirs,
            elixirRecipes: definitions,
            spellSlots: spellSlots.filter(s => s.value > 0),
            hasSpellSlots,
            dailyRolled
        });

        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);

        const el = this.element;
        if (!el) return;

        // Roll free daily elixirs
        el.querySelector('.roll-daily-btn')?.addEventListener('click', async () => {
            await this._onRollDailyElixirs(context.freeElixirsCount);
        });

        // Create with spell slot
        el.querySelectorAll('.craft-elixir-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const recipeId = parseInt(btn.dataset.recipeId);
                const select = el.querySelector(`.elixir-slot-select[data-recipe-id="${recipeId}"]`);
                const slotLevel = parseInt(select?.value);
                if (slotLevel) {
                    await this._onCraftElixirWithSlot(recipeId, slotLevel);
                }
            });
        });
    }

    async _promptElixirChoice(index) {
        return new Promise((resolve) => {
            const intMod = this.actor.system.abilities?.int?.mod || 0;
            const alchemistLevel = this.actor.items.contents.find(i => i.type === "class" && i.name.toLowerCase().includes("artificer"))?.system?.levels ?? 3;
            const list = ElixirApp.getElixirDefinitions(alchemistLevel, intMod);
            
            const buttons = {};
            for (const el of list) {
                buttons[el.name.toLowerCase()] = {
                    label: el.name,
                    callback: () => resolve(el.name)
                };
            }
            new Dialog({
                title: `Choose Effect for Elixir #${index}`,
                content: `<p>You rolled a <strong>6 (Choice)</strong> on the Experimental Elixir table. Select which effect you would like to produce:</p>`,
                buttons: buttons,
                default: "healing",
                close: () => resolve("Healing")
            }).render(true);
        });
    }

    async _onRollDailyElixirs(count) {
        if (count <= 0) {
            ui.notifications.warn("You must be an Alchemist Artificer of at least 3rd level to roll daily free elixirs.");
            return;
        }

        ui.notifications.info(`Sending Experimental Elixir roll requests to Chat...`);

        // Post initial chat message roll request
        await ChatMessage.create({
            content: `
                <div class="af-elixir-roll-request-card" data-actor-id="${this.actor.id}">
                    <p><i class="fas fa-flask" style="color: #ff6400;"></i> <strong>Experimental Elixirs Request</strong></p>
                    <p>${this.actor.name} has <strong>${count}</strong> free daily Experimental Elixirs available.</p>
                    <button type="button" class="af-elixir-start-roll-btn" data-actor-id="${this.actor.id}" data-total="${count}" data-current="1" style="width: 100%; margin-top: 5px;">
                        <i class="fas fa-dice"></i> Roll Elixir #1 (of ${count})
                    </button>
                </div>
            `,
            speaker: ChatMessage.getSpeaker({ actor: this.actor })
        });

        this.render();
    }

    async cleanInvalidElixirs() {
        if (!this.actor) return;
        const invalidElixirIds = this.actor.toObject().items.filter(item => {
            if (item.type !== "consumable" || !item.name?.startsWith("Elixir of")) return false;
            const activities = item.system?.activities || {};
            return Object.keys(activities).some(id => id.length !== 16);
        }).map(i => i._id);

        if (invalidElixirIds.length > 0) {
            console.warn(`Artificer Elixir | Cleaning up invalid elixirs:`, invalidElixirIds);
            await this.actor.deleteEmbeddedDocuments("Item", invalidElixirIds);
        }
    }

    async _onCraftElixirWithSlot(recipeId, slotLevel) {
        await this.cleanInvalidElixirs();
        const intMod = this.actor.system.abilities?.int?.mod || 0;
        const alchemistLevel = this.actor.items.contents.find(i => i.type === "class" && i.name.toLowerCase().includes("artificer"))?.system?.levels ?? 3;
        const definitions = ElixirApp.getElixirDefinitions(alchemistLevel, intMod);

        const elixir = definitions.find(e => e.id === recipeId);
        if (!elixir) return;

        // Deduct spell slot
        const spells = foundry.utils.duplicate(this.actor.system.spells);
        const slotKey = `spell${slotLevel}`;
        if (!spells[slotKey] || spells[slotKey].value <= 0) {
            ui.notifications.warn(`You do not have any level ${slotLevel} spell slots left.`);
            return;
        }

        spells[slotKey].value = Math.max(0, spells[slotKey].value - 1);
        await this.actor.update({ "system.spells": spells });

        // Add elixir to actor inventory
        await this._awardElixir(elixir.name, definitions);

        // Chat message
        await ChatMessage.create({
            content: `
                <div class="af-elixir-chat-msg" style="padding: 5px; border-left: 3px solid #d89f5e;">
                    <p><i class="fas fa-magic" style="color: #d89f5e;"></i> <strong>Spell Slot Expended to Craft Elixir</strong></p>
                    <p>${this.actor.name} expends a level ${slotLevel} spell slot to create: <strong>Experimental Elixir (${elixir.name})</strong>.</p>
                </div>`,
            speaker: { alias: "Alchemist Lab" }
        });

        ui.notifications.info(`Expended level ${slotLevel} spell slot to craft Experimental Elixir (${elixir.name})!`);
        this.render();
    }

    async _awardElixir(elixirName, definitions = null) {
        await this.cleanInvalidElixirs();
        let alchemistLevel = 3;
        if (this.actor.classes) {
            const artificerClass = this.actor.classes.artificer;
            if (artificerClass) {
                alchemistLevel = artificerClass.system.levels ?? 3;
            }
        }
        const intMod = this.actor.system.abilities?.int?.mod || 0;

        if (!definitions) {
            definitions = ElixirApp.getElixirDefinitions(alchemistLevel, intMod);
        }

        const fullItemName = `Elixir of ${elixirName}`;
        const existing = this.actor.items.find(i => i.name === fullItemName && i.type === "consumable");

        if (existing) {
            const nextQty = (existing.system.quantity ?? 0) + 1;
            await existing.update({ "system.quantity": nextQty });
        } else {
            const ref = definitions.find(e => e.name === elixirName);
            
            const effectId = foundry.utils.randomID();
            const activityId = foundry.utils.randomID();
            const effects = [];
            let isV4 = false;
            try {
                isV4 = isNewerVersion(game.system?.version || "0.0.0", "3.99.99");
            } catch (e) {
                isV4 = parseInt(game.system?.version?.split(".")[0] || "0") >= 4;
            }

            if (elixirName === "Swiftness") {
                effects.push({
                    _id: effectId,
                    name: "Elixir of Swiftness",
                    label: "Elixir of Swiftness",
                    icon: ref?.img || "icons/consumables/potions/bottle-corked-green.webp",
                    img: ref?.img || "icons/consumables/potions/bottle-corked-green.webp",
                    duration: { seconds: 3600 },
                    changes: [
                        {
                            key: "system.attributes.movement.walk",
                            value: "10 + 5 * min(max(@classes.artificer.levels - 8, 0), 1) + 5 * min(max(@classes.artificer.levels - 14, 0), 1)",
                            mode: 2
                        }
                    ],
                    transfer: false,
                    disabled: false
                });
            } else if (elixirName === "Resilience") {
                let resilienceSec = 600; // 10 minutes
                if (alchemistLevel >= 15) resilienceSec = 28800; // 8 hours
                else if (alchemistLevel >= 9) resilienceSec = 3600; // 1 hour

                effects.push({
                    _id: effectId,
                    name: "Elixir of Resilience",
                    label: "Elixir of Resilience",
                    icon: ref?.img || "icons/consumables/potions/bottle-corked-blue.webp",
                    img: ref?.img || "icons/consumables/potions/bottle-corked-blue.webp",
                    duration: { seconds: resilienceSec },
                    changes: [
                        {
                            key: "system.attributes.ac.bonus",
                            value: "+1",
                            mode: 2
                        }
                    ],
                    transfer: false,
                    disabled: false
                });
            } else if (elixirName === "Boldness") {
                let boldnessSec = 60; // 1 minute
                if (alchemistLevel >= 15) boldnessSec = 3600; // 1 hour
                else if (alchemistLevel >= 9) boldnessSec = 600; // 10 minutes

                effects.push({
                    _id: effectId,
                    name: "Elixir of Boldness",
                    label: "Elixir of Boldness",
                    icon: ref?.img || "icons/consumables/potions/flask-corked-red-glow.webp",
                    img: ref?.img || "icons/consumables/potions/flask-corked-red-glow.webp",
                    duration: { seconds: boldnessSec },
                    changes: [
                        { key: "system.bonuses.mwak.attack", value: "+1d4", mode: 2 },
                        { key: "system.bonuses.rwak.attack", value: "+1d4", mode: 2 },
                        { key: "system.bonuses.msak.attack", value: "+1d4", mode: 2 },
                        { key: "system.bonuses.rsak.attack", value: "+1d4", mode: 2 },
                        { key: "system.bonuses.abilities.save", value: "+1d4", mode: 2 }
                    ],
                    transfer: false,
                    disabled: false
                });
            } else if (elixirName === "Flight") {
                effects.push({
                    _id: effectId,
                    name: "Elixir of Flight",
                    label: "Elixir of Flight",
                    icon: ref?.img || "icons/consumables/potions/bottle-conical-corked-cyan.webp",
                    img: ref?.img || "icons/consumables/potions/bottle-conical-corked-cyan.webp",
                    duration: { seconds: 600 }, // always 10 mins
                    changes: [
                        {
                            key: "system.attributes.movement.fly",
                            value: "10 + 10 * min(max(@classes.artificer.levels - 8, 0), 1) + 10 * min(max(@classes.artificer.levels - 14, 0), 1)",
                            mode: 4 // override
                        }
                    ],
                    transfer: false,
                    disabled: false
                });
            }

            const activities = {};
            const actType = CONFIG.DND5E.activityTypes?.use ? "use" : "utility";

            if (isV4) {
                // v4 Activity model
                activities[activityId] = {
                    _id: activityId,
                    type: elixirName === "Healing" ? "heal" : actType,
                    name: "Drink",
                    activation: {
                        type: "bonus",
                        value: 1
                    },
                    consumption: {
                        targets: [{
                            type: "itemUses",
                            value: "1"
                        }],
                        scaling: {
                            allowed: false
                        }
                    }
                };
                if (elixirName === "Healing") {
                    activities[activityId].healing = {
                        custom: {
                            enabled: true,
                            formula: "(2 + floor(@classes.artificer.levels / 9) + floor(@classes.artificer.levels / 15))d8 + @abilities.int.mod"
                        },
                        types: ["healing"]
                    };
                } else {
                    activities[activityId].effects = [{ _id: effectId }];
                }
            } else {
                // v3 Activity model
                activities[activityId] = {
                    _id: activityId,
                    type: elixirName === "Healing" ? "heal" : actType,
                    name: "Drink",
                    activation: {
                        type: "bonus",
                        value: 1
                    },
                    consumption: {
                        targets: [{
                            type: "itemUses",
                            value: "1"
                        }],
                        scaling: {
                            allowed: false
                        }
                    }
                };
                if (elixirName === "Healing") {
                    activities[activityId].healing = {
                        custom: {
                            enabled: true,
                            formula: "(2 + floor(@classes.artificer.levels / 9) + floor(@classes.artificer.levels / 15))d8 + @abilities.int.mod"
                        },
                        types: ["healing"]
                    };
                } else {
                    activities[activityId].effects = [effectId];
                }
            }

            const itemData = {
                name: fullItemName,
                type: "consumable",
                img: ref?.img || "icons/consumables/potions/bottle-corked-red.webp",
                effects: effects,
                system: {
                    quantity: 1,
                    price: { value: 0, denomination: "gp" },
                    weight: { value: 0.1 },
                    description: { value: `<p>${ref?.description || ""}</p>` },
                    consumableType: "potion",
                    activation: {
                        type: "bonus",
                        cost: 1
                    },
                    uses: {
                        value: 1,
                        max: "1",
                        per: "charges",
                        autoDestroy: true
                    },
                    activities: activities
                }
            };
            try {
                await this.actor.createEmbeddedDocuments("Item", [itemData]);
            } catch (err) {
                console.error("Artificer Elixir | Error creating custom activity elixir, falling back to simple item:", err);
                const fallbackItemData = {
                    name: fullItemName,
                    type: "consumable",
                    img: ref?.img || "icons/consumables/potions/bottle-corked-red.webp",
                    system: {
                        quantity: 1,
                        price: { value: 0, denomination: "gp" },
                        weight: { value: 0.1 },
                        description: { value: `<p>${ref?.description || ""}</p>` },
                        consumableType: "potion"
                    }
                };
                await this.actor.createEmbeddedDocuments("Item", [fallbackItemData]);
            }
        }
    }
}
