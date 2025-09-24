import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

class RPGEngine {
    constructor() {
        this.db = null;
        this.cooldowns = new Map();
        this.init();
    }

    async init() {
        const file = join(__dirname, '../database/rpg/rpg.items.json');
        const adapter = new JSONFile(file);
        this.db = new Low(adapter, this.getDefaultData());
        
        await this.db.read();
        await this.db.write();
        
        this.dropRates = this.initializeDropRates();
        this.rewardTables = this.initializeRewardTables();
        this.itemsData = this.loadItemsData();
    }

    getDefaultData() {
        return {
            users: [],
            market: [],
            guilds: [],
            quests: [],
            dungeons: [],
            achievements: [],
            races: this.getRaceData(),
            config: {
                race_chances: { human: 62.5, angel: 18.75, shark: 18.75 },
                version_requirements: this.getVersionRequirements(),
                game_settings: this.getGameSettings()
            }
        };
    }

    getRaceData() {
        return {
            human: {
                name: "Human",
                description: "Balanced race with attack and speed bonuses",
                versions: {
                    v1: { 
                        level_required: 1,
                        attack_bonus: 5, 
                        speed_bonus: 5,
                        health_bonus: 0,
                        defense_bonus: 0,
                        passive: "Fast Learner: +10% EXP gain",
                        special_ability: "Adaptive Combat"
                    },
                    v2: { 
                        level_required: 15,
                        attack_bonus: 10, 
                        speed_bonus: 10,
                        health_bonus: 50,
                        defense_bonus: 5,
                        passive: "Quick Recovery: +15% Health Regen",
                        special_ability: "Critical Strike"
                    },
                    v3: { 
                        level_required: 35,
                        attack_bonus: 15, 
                        speed_bonus: 15,
                        health_bonus: 100,
                        defense_bonus: 10,
                        passive: "Battle Hardened: +20% Damage Reduction when low HP",
                        special_ability: "Ultimate Fury"
                    }
                }
            },
            angel: {
                name: "Angel",
                description: "Divine being with healing and regeneration abilities",
                versions: {
                    v1: { 
                        level_required: 1,
                        attack_bonus: 2, 
                        speed_bonus: 8,
                        health_bonus: 20,
                        defense_bonus: 8,
                        passive: "Divine Regeneration: +25% Health Regen",
                        special_ability: "Healing Light"
                    },
                    v2: { 
                        level_required: 20,
                        attack_bonus: 5, 
                        speed_bonus: 12,
                        health_bonus: 50,
                        defense_bonus: 12,
                        passive: "Celestial Protection: +15% Damage Reduction",
                        special_ability: "Revival Grace"
                    },
                    v3: { 
                        level_required: 40,
                        attack_bonus: 8, 
                        speed_bonus: 15,
                        health_bonus: 100,
                        defense_bonus: 15,
                        passive: "Archangel's Blessing: Auto-revive once per battle",
                        special_ability: "Divine Judgment"
                    }
                }
            },
            shark: {
                name: "Shark",
                description: "Aquatic predator with high HP and damage reduction",
                versions: {
                    v1: { 
                        level_required: 1,
                        attack_bonus: 8, 
                        speed_bonus: 3,
                        health_bonus: 50,
                        defense_bonus: 12,
                        passive: "Thick Skin: +20% Damage Reduction",
                        special_ability: "Blood Frenzy"
                    },
                    v2: { 
                        level_required: 25,
                        attack_bonus: 12, 
                        speed_bonus: 5,
                        health_bonus: 100,
                        defense_bonus: 18,
                        passive: "Aquatic Dominance: +30% HP in water zones",
                        special_ability: "Ocean's Wrath"
                    },
                    v3: { 
                        level_required: 45,
                        attack_bonus: 15, 
                        speed_bonus: 8,
                        health_bonus: 150,
                        defense_bonus: 25,
                        passive: "Alpha Predator: +25% Attack when HP above 70%",
                        special_ability: "Tsunami Crash"
                    }
                }
            }
        };
    }

    getVersionRequirements() {
        return {
            v2: { level: 15, quest: "advanced_training" },
            v3: { level: 35, boss: "ancient_guardian" }
        };
    }

    getGameSettings() {
        return {
            exp_base: 100,
            exp_multiplier: 1.5,
            max_level: 100,
            base_health: 100,
            base_attack: 10,
            base_defense: 5
        };
    }

    loadItemsData() {
        return {
            ore: {
                coal: { name: "Coal Ore", type: "ore", price_buy: 50000, price_sell: 25000, rarity: "common" },
                iron: { name: "Iron Ore", type: "ore", price_buy: 62500, price_sell: 31250, rarity: "uncommon" },
                copper: { name: "Copper Ore", type: "ore", price_buy: 78125, price_sell: 39063, rarity: "uncommon" },
                silver: { name: "Silver Ore", type: "ore", price_buy: 97656, price_sell: 48828, rarity: "rare" },
                gold: { name: "Gold Ore", type: "ore", price_buy: 122070, price_sell: 61035, rarity: "rare" },
                emerald: { name: "Emerald Ore", type: "ore", price_buy: 152588, price_sell: 76294, rarity: "epic" },
                diamond: { name: "Diamond Ore", type: "ore", price_buy: 190735, price_sell: 95368, rarity: "legendary" }
            },
            box: {
                common: { name: "Common Box", type: "box", price_buy: 25000, price_sell: 12500, tier: "common" },
                uncommon: { name: "Uncommon Box", type: "box", price_buy: 75000, price_sell: 37500, tier: "uncommon" },
                rare: { name: "Rare Box", type: "box", price_buy: 225000, price_sell: 112500, tier: "rare" },
                epic: { name: "Epic Box", type: "box", price_buy: 675000, price_sell: 337500, tier: "epic" },
                legendary: { name: "Legendary Box", type: "box", price_buy: 2025000, price_sell: 1012500, tier: "legendary" },
                mythic: { name: "Mythic Box", type: "box", price_buy: 6075000, price_sell: 3037500, tier: "mythic" }
            },
            weapon: {
                wooden_sword: { name: "Wooden Sword", type: "weapon", price_buy: 25000, price_sell: 12500, damage: 10, rarity: "common" },
                iron_sword: { name: "Iron Sword", type: "weapon", price_buy: 75000, price_sell: 37500, damage: 25, rarity: "uncommon" },
                steel_sword: { name: "Steel Sword", type: "weapon", price_buy: 150000, price_sell: 75000, damage: 40, rarity: "rare" },
                silver_sword: { name: "Silver Sword", type: "weapon", price_buy: 300000, price_sell: 150000, damage: 60, rarity: "epic" },
                dragonbone_sword: { name: "Dragonbone Sword", type: "weapon", price_buy: 750000, price_sell: 375000, damage: 90, rarity: "legendary" }
            },
            armor: {
                leather_armor: { name: "Leather Armor", type: "armor", price_buy: 30000, price_sell: 15000, defense: 15, rarity: "common" },
                chainmail_armor: { name: "Chainmail Armor", type: "armor", price_buy: 75000, price_sell: 37500, defense: 30, rarity: "uncommon" },
                iron_armor: { name: "Iron Armor", type: "armor", price_buy: 150000, price_sell: 75000, defense: 45, rarity: "rare" },
                steel_armor: { name: "Steel Armor", type: "armor", price_buy: 300000, price_sell: 150000, defense: 60, rarity: "epic" },
                dragon_scale_armor: { name: "Dragon Scale Armor", type: "armor", price_buy: 750000, price_sell: 375000, defense: 90, rarity: "legendary" }
            },
            potion: {
                health_potion: { name: "Health Potion", type: "potion", price_buy: 15000, price_sell: 7500, restore: 50, rarity: "common" },
                mana_potion: { name: "Mana Potion", type: "potion", price_buy: 15000, price_sell: 7500, restore: 50, rarity: "common" },
                greater_health_potion: { name: "Greater Health Potion", type: "potion", price_buy: 30000, price_sell: 15000, restore: 100, rarity: "uncommon" },
                elixir_of_life: { name: "Elixir of Life", type: "potion", price_buy: 100000, price_sell: 50000, restore: 200, rarity: "epic" }
            }
        };
    }

    initializeDropRates() {
        return {
            common: { chance: 0.6, multiplier: 1.0 },
            uncommon: { chance: 0.3, multiplier: 1.5 },
            rare: { chance: 0.08, multiplier: 2.0 },
            epic: { chance: 0.015, multiplier: 3.0 },
            legendary: { chance: 0.004, multiplier: 5.0 },
            mythic: { chance: 0.0008, multiplier: 8.0 }
        };
    }

    initializeRewardTables() {
        return {
            common: ['wood', 'stone', 'coal', 'bread', 'water', 'health_potion'],
            uncommon: ['iron', 'copper', 'leather', 'cloth', 'meat', 'fish', 'mana_potion'],
            rare: ['silver', 'gold', 'iron_bar', 'basic_pickaxe', 'greater_health_potion'],
            epic: ['emerald', 'steel_bar', 'iron_sword', 'leather_armor', 'elixir_of_life'],
            legendary: ['diamond', 'steel_sword', 'chainmail_armor', 'dragonbone_sword'],
            mythic: ['dragon_scale_armor', 'mythic_box', 'ancient_artifact']
        };
    }

    async createUser(userId, username, email) {
        const existingUser = this.db.data.users.find(user => user.username === username || user.email === email);
        if (existingUser) throw new Error("User already exists");

        const race = this.determineRace();
        const raceData = this.db.data.races[race];
        const version = 'v1';
        const versionData = raceData.versions[version];

        const newUser = {
            id: userId,
            username,
            email,
            race,
            race_version: version,
            level: 1,
            exp: 0,
            health: this.getGameSettings().base_health + versionData.health_bonus,
            max_health: this.getGameSettings().base_health + versionData.health_bonus,
            attack: this.getGameSettings().base_attack + versionData.attack_bonus,
            defense: this.getGameSettings().base_defense + versionData.defense_bonus,
            speed: versionData.speed_bonus,
            coins: 10000,
            gems: 0,
            inventory: {},
            equipment: { weapon: null, armor: null, accessory: null },
            skills: { mining: 1, combat: 1, crafting: 1 },
            achievements: [],
            guild: null,
            daily_streak: 0,
            last_daily: null,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
        };

        this.db.data.users.push(newUser);
        await this.db.write();
        return newUser;
    }

    determineRace() {
        const random = Math.random() * 100;
        const chances = this.db.data.config.race_chances;
        
        if (random < chances.human) return 'human';
        if (random < chances.human + chances.angel) return 'angel';
        return 'shark';
    }

    async getUser(userId) {
        return this.db.data.users.find(user => user.id === userId);
    }

    async addExp(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        const raceBonus = this.calculateRaceEXPBonus(user.race);
        const finalExp = Math.floor(amount * (1 + raceBonus));
        user.exp += finalExp;

        const expNeeded = this.calculateExpRequired(user.level);
        if (user.exp >= expNeeded) {
            user.level += 1;
            user.exp -= expNeeded;
            user.max_health += 20;
            user.health = user.max_health;
            
            const levelUpResult = { levelUp: true, newLevel: user.level, expGained: finalExp };
            
            if (this.canUpgradeRace(user)) {
                levelUpResult.raceUpgradeAvailable = true;
            }
            
            await this.db.write();
            return levelUpResult;
        }

        await this.db.write();
        return { levelUp: false, expGained: finalExp };
    }

    calculateRaceEXPBonus(race) {
        const bonuses = {
            human: 0.1,
            angel: 0.05,
            shark: 0.03
        };
        return bonuses[race] || 0;
    }

    calculateExpRequired(level) {
        const settings = this.getGameSettings();
        return Math.floor(settings.exp_base * Math.pow(level, settings.exp_multiplier));
    }

    canUpgradeRace(user) {
        const raceData = this.db.data.races[user.race];
        const currentVersion = user.race_version;
        const nextVersion = this.getNextVersion(currentVersion);
        
        if (!nextVersion) return false;
        
        const nextVersionData = raceData.versions[nextVersion];
        return user.level >= nextVersionData.level_required;
    }

    getNextVersion(currentVersion) {
        const versions = ['v1', 'v2', 'v3'];
        const currentIndex = versions.indexOf(currentVersion);
        return versions[currentIndex + 1];
    }

    async upgradeRace(userId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (!this.canUpgradeRace(user)) {
            throw new Error("Race upgrade requirements not met");
        }

        const raceData = this.db.data.races[user.race];
        const currentVersion = user.race_version;
        const nextVersion = this.getNextVersion(currentVersion);
        const nextVersionData = raceData.versions[nextVersion];

        user.race_version = nextVersion;
        user.max_health += nextVersionData.health_bonus;
        user.health = user.max_health;
        user.attack += nextVersionData.attack_bonus;
        user.defense += nextVersionData.defense_bonus;
        user.speed += nextVersionData.speed_bonus;

        await this.db.write();
        return {
            success: true,
            new_version: nextVersion,
            bonuses: nextVersionData,
            passive: nextVersionData.passive,
            special_ability: nextVersionData.special_ability
        };
    }

    getCooldownKey(userId, action) {
        return `${userId}:${action}`;
    }

    checkCooldown(userId, action, cooldownTime) {
        const key = this.getCooldownKey(userId, action);
        const now = Date.now();
        const lastAction = this.cooldowns.get(key);
        
        if (lastAction && (now - lastAction) < cooldownTime) {
            return Math.ceil((cooldownTime - (now - lastAction)) / 1000);
        }
        
        this.cooldowns.set(key, now);
        return 0;
    }

    async battleMonster(userId, monsterLevel) {
        const cooldown = this.checkCooldown(userId, 'battle', 60000);
        if (cooldown > 0) throw new Error(`Battle cooldown: ${cooldown}s`);

        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (user.health <= 0) throw new Error("User health too low");

        const battleResult = this.simulateBattle(user, monsterLevel);
        
        if (battleResult.victory) {
            await this.handleBattleVictory(user, battleResult);
        } else {
            await this.handleBattleDefeat(user, battleResult);
        }

        await this.db.write();
        return battleResult;
    }

    simulateBattle(user, monsterLevel) {
        const userPower = this.calculateBattlePower(user);
        const monsterPower = monsterLevel * 10;
        
        const raceAdvantage = this.calculateRaceAdvantage(user.race);
        const adjustedUserPower = userPower * raceAdvantage;
        
        const victoryChance = adjustedUserPower / (adjustedUserPower + monsterPower);
        const victory = Math.random() < victoryChance;
        
        const damageReduction = this.calculateRaceDamageReduction(user.race, user.health, user.max_health);
        const baseDamage = victory ? Math.floor(monsterPower * 0.1) : Math.floor(monsterPower * 0.3);
        const finalDamage = Math.floor(baseDamage * (1 - damageReduction));

        return {
            victory,
            userPower: adjustedUserPower,
            monsterPower,
            damageTaken: finalDamage,
            expGained: victory ? monsterLevel * 10 : monsterLevel * 2,
            coinsGained: victory ? monsterLevel * 50 : 0,
            damageReduction: damageReduction * 100
        };
    }

    calculateRaceAdvantage(race) {
        const advantages = {
            human: 1.1,
            angel: 1.0,
            shark: 1.05
        };
        return advantages[race] || 1.0;
    }

    calculateRaceDamageReduction(race, currentHealth, maxHealth) {
        const baseReduction = {
            human: 0.05,
            angel: 0.08,
            shark: 0.15
        };

        let reduction = baseReduction[race] || 0;

        if (race === 'human' && currentHealth < maxHealth * 0.3) {
            reduction += 0.15;
        }

        if (race === 'shark' && currentHealth > maxHealth * 0.7) {
            reduction += 0.1;
        }

        return Math.min(reduction, 0.5);
    }

    calculateBattlePower(user) {
        let power = user.level * 5;
        power += user.attack * 2;
        power += user.defense * 1.5;
        power += user.speed * 1.2;

        if (user.equipment.weapon) {
            const weapon = this.itemsData.weapon[user.equipment.weapon];
            if (weapon) power += weapon.damage * 2;
        }

        if (user.equipment.armor) {
            const armor = this.itemsData.armor[user.equipment.armor];
            if (armor) power += armor.defense * 1.5;
        }

        return power;
    }

    async handleBattleVictory(user, battleResult) {
        user.coins += battleResult.coinsGained;
        await this.addExp(user.id, battleResult.expGained);
        user.health = Math.max(0, user.health - battleResult.damageTaken);
        
        const dropChance = Math.random();
        if (dropChance < 0.3) {
            const droppedItem = this.generateBattleDrop(user.level);
            if (droppedItem) {
                await this.addItemToInventory(user.id, droppedItem.category, droppedItem.id, droppedItem.quantity);
                battleResult.droppedItem = droppedItem;
            }
        }

        if (user.race === 'angel' && user.health < user.max_health * 0.3) {
            const healAmount = Math.floor(user.max_health * 0.15);
            user.health = Math.min(user.max_health, user.health + healAmount);
            battleResult.angel_heal = healAmount;
        }
    }

    async handleBattleDefeat(user, battleResult) {
        user.health = Math.max(0, user.health - battleResult.damageTaken);
        
        if (user.race === 'angel' && user.race_version === 'v3' && user.health <= 0) {
            user.health = Math.floor(user.max_health * 0.3);
            battleResult.angel_revive = true;
        } else {
            user.coins = Math.max(0, user.coins - Math.floor(user.coins * 0.1));
        }

        await this.addExp(user.id, battleResult.expGained);
    }

    generateBattleDrop(playerLevel) {
        const tiers = Object.keys(this.dropRates);
        for (const tier of tiers) {
            if (Math.random() < this.dropRates[tier].chance * (playerLevel / 100)) {
                const reward = this.getRandomReward(tier);
                if (reward) {
                    const category = this.findItemCategory(reward.item);
                    return { category, id: reward.item, quantity: reward.quantity, tier };
                }
            }
        }
        return null;
    }

    getRandomReward(tier) {
        const rewards = this.rewardTables[tier];
        if (!rewards) return null;
        
        const randomItem = rewards[Math.floor(Math.random() * rewards.length)];
        const quantity = this.calculateRewardQuantity(tier);
        
        return { item: randomItem, quantity };
    }

    calculateRewardQuantity(tier) {
        const baseQuantities = {
            common: { min: 1, max: 3 },
            uncommon: { min: 1, max: 2 },
            rare: { min: 1, max: 2 },
            epic: { min: 1, max: 1 },
            legendary: { min: 1, max: 1 },
            mythic: { min: 1, max: 1 }
        };
        
        const range = baseQuantities[tier];
        return range ? Math.floor(Math.random() * (range.max - range.min + 1)) + range.min : 1;
    }

    findItemCategory(itemName) {
        for (const category in this.itemsData) {
            for (const itemKey in this.itemsData[category]) {
                if (this.itemsData[category][itemKey].name.toLowerCase().replace(/\s+/g, '_') === itemName) {
                    return category;
                }
            }
        }
        return null;
    }

    async addItemToInventory(userId, category, itemId, quantity = 1) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (!user.inventory[category]) user.inventory[category] = {};
        user.inventory[category][itemId] = (user.inventory[category][itemId] || 0) + quantity;
        
        await this.db.write();
        return user.inventory[category][itemId];
    }

    async removeItemFromInventory(userId, category, itemId, quantity = 1) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (!user.inventory[category] || !user.inventory[category][itemId]) {
            throw new Error("Item not found in inventory");
        }

        if (user.inventory[category][itemId] < quantity) {
            throw new Error("Not enough items in inventory");
        }

        user.inventory[category][itemId] -= quantity;
        if (user.inventory[category][itemId] <= 0) delete user.inventory[category][itemId];
        
        await this.db.write();
        return user.inventory[category][itemId] || 0;
    }

    async openBox(userId, boxTier) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        const boxKey = Object.keys(this.itemsData.box).find(key => 
            this.itemsData.box[key].tier === boxTier
        );
        
        if (!boxKey || !user.inventory.box || !user.inventory.box[boxKey]) {
            throw new Error("Box not found in inventory");
        }

        await this.removeItemFromInventory(userId, 'box', boxKey, 1);
        
        const rewards = [];
        const reward = this.getRandomReward(boxTier);
        if (reward) {
            const category = this.findItemCategory(reward.item);
            if (category) {
                await this.addItemToInventory(userId, category, reward.item, reward.quantity);
                rewards.push({ item: reward.item, quantity: reward.quantity, type: 'item' });
            }
        }

        const coinsReward = this.calculateCoinReward(boxTier);
        user.coins += coinsReward;
        rewards.push({ amount: coinsReward, type: 'coins' });

        const expReward = this.calculateExpReward(boxTier);
        await this.addExp(userId, expReward);
        rewards.push({ amount: expReward, type: 'exp' });

        await this.db.write();
        return rewards;
    }

    calculateCoinReward(tier) {
        const baseRewards = {
            common: 1000,
            uncommon: 5000,
            rare: 25000,
            epic: 100000,
            legendary: 500000,
            mythic: 2000000
        };
        
        const base = baseRewards[tier] || 0;
        const variation = base * 0.2;
        return Math.floor(base + (Math.random() * variation * 2) - variation);
    }

    calculateExpReward(tier) {
        const baseExp = {
            common: 10,
            uncommon: 50,
            rare: 250,
            epic: 1000,
            legendary: 5000,
            mythic: 25000
        };
        
        return baseExp[tier] || 0;
    }

    async mineOre(userId, oreType) {
        const cooldown = this.checkCooldown(userId, 'mining', 30000);
        if (cooldown > 0) throw new Error(`Mining cooldown: ${cooldown}s`);

        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        const successChance = this.calculateMiningSuccess(user, oreType);
        if (Math.random() > successChance) {
            throw new Error("Mining failed");
        }

        const quantity = this.calculateMiningYield(user, oreType);
        await this.addItemToInventory(userId, 'ore', oreType, quantity);

        const expGain = this.calculateMiningExp(oreType);
        await this.addExp(userId, expGain);

        await this.db.write();
        return { ore: oreType, quantity, exp: expGain };
    }

    calculateMiningSuccess(user, oreType) {
        const baseChance = {
            coal: 0.9, iron: 0.7, copper: 0.6, silver: 0.4, gold: 0.3, emerald: 0.2, diamond: 0.1
        };
        
        const raceBonus = user.race === 'human' ? 0.1 : 0;
        return Math.min(0.95, (baseChance[oreType] || 0.5) + raceBonus);
    }

    calculateMiningYield(user, oreType) {
        const baseYield = {
            coal: 3, iron: 2, copper: 2, silver: 1, gold: 1, emerald: 1, diamond: 1
        };
        
        const raceBonus = user.race === 'shark' ? 1 : 0;
        const base = baseYield[oreType] || 1;
        return Math.floor(base + raceBonus);
    }

    calculateMiningExp(oreType) {
        const expValues = {
            coal: 5, iron: 10, copper: 15, silver: 25, gold: 40, emerald: 60, diamond: 100
        };
        return expValues[oreType] || 5;
    }

    async createGuild(leaderId, guildName, tag) {
        const leader = await this.getUser(leaderId);
        if (!leader) throw new Error("User not found");
        if (leader.guild) throw new Error("User already in a guild");

        if (leader.coins < 50000) throw new Error("Not enough coins to create guild");

        const newGuild = {
            id: Date.now().toString(),
            name: guildName,
            tag: tag.toUpperCase(),
            leader: leaderId,
            members: [leaderId],
            level: 1,
            experience: 0,
            treasury: 0,
            skills: {
                attack_boost: 0,
                defense_boost: 0,
                exp_boost: 0
            },
            created_at: new Date().toISOString()
        };

        leader.guild = newGuild.id;
        leader.coins -= 50000;
        this.db.data.guilds.push(newGuild);
        
        await this.db.write();
        return newGuild;
    }

    async joinGuild(userId, guildId) {
        const user = await this.getUser(userId);
        const guild = this.db.data.guilds.find(g => g.id === guildId);
        
        if (!user || !guild) throw new Error("User or guild not found");
        if (user.guild) throw new Error("User already in a guild");

        guild.members.push(userId);
        user.guild = guildId;
        
        await this.db.write();
        return guild;
    }

    async listItemOnMarket(userId, category, itemId, quantity, price) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        await this.removeItemFromInventory(userId, category, itemId, quantity);

        const listing = {
            id: Date.now().toString(),
            sellerId: userId,
            category,
            itemId,
            quantity,
            price,
            listed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        this.db.data.market.push(listing);
        await this.db.write();
        return listing;
    }

    async buyFromMarket(userId, listingId) {
        const user = await this.getUser(userId);
        const listing = this.db.data.market.find(l => l.id === listingId);
        
        if (!user || !listing) throw new Error("User or listing not found");
        if (user.coins < listing.price * listing.quantity) {
            throw new Error("Not enough coins");
        }

        user.coins -= listing.price * listing.quantity;
        await this.addItemToInventory(userId, listing.category, listing.itemId, listing.quantity);

        const seller = await this.getUser(listing.sellerId);
        if (seller) seller.coins += listing.price * listing.quantity;

        this.db.data.market = this.db.data.market.filter(l => l.id !== listingId);
        await this.db.write();
        return { success: true, item: listing.itemId, quantity: listing.quantity };
    }

    async claimDailyReward(userId) {
        const cooldown = this.checkCooldown(userId, 'daily', 86400000);
        if (cooldown > 0) throw new Error(`Daily reward available in ${cooldown}s`);

        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        const now = new Date();
        const lastClaim = user.last_daily ? new Date(user.last_daily) : null;
        
        let streak = user.daily_streak || 0;
        if (lastClaim && this.isConsecutiveDay(lastClaim, now)) {
            streak++;
        } else {
            streak = 1;
        }

        const reward = this.calculateDailyReward(streak, user.race);
        user.coins += reward.coins;
        await this.addExp(userId, reward.exp);
        user.daily_streak = streak;
        user.last_daily = now.toISOString();

        await this.db.write();
        return { streak, reward };
    }

    isConsecutiveDay(lastDate, currentDate) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.abs(currentDate - lastDate) <= oneDay;
    }

    calculateDailyReward(streak, race) {
        const baseCoins = 1000;
        const baseExp = 50;
        
        const raceMultiplier = {
            human: 1.1,
            angel: 1.0,
            shark: 1.05
        };

        const multiplier = raceMultiplier[race] || 1.0;
        const streakBonus = Math.min(streak, 7);
        
        return {
            coins: Math.floor(baseCoins * streakBonus * multiplier),
            exp: Math.floor(baseExp * streakBonus * multiplier)
        };
    }

    async equipItem(userId, category, itemId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (!user.inventory[category] || !user.inventory[category][itemId]) {
            throw new Error("Item not in inventory");
        }

        const validSlots = ['weapon', 'armor', 'accessory'];
        if (!validSlots.includes(category)) {
            throw new Error("Item is not equippable");
        }

        user.equipment[category] = itemId;
        await this.db.write();
        return user.equipment;
    }

    async unequipItem(userId, category) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        if (!user.equipment[category]) {
            throw new Error("No item equipped in this slot");
        }

        const itemId = user.equipment[category];
        user.equipment[category] = null;
        await this.addItemToInventory(userId, category, itemId, 1);
        
        await this.db.write();
        return user.equipment;
    }

    getRaceInfo(race, version = 'v1') {
        const raceData = this.db.data.races[race];
        if (!raceData) return null;

        return {
            name: raceData.name,
            description: raceData.description,
            version: raceData.versions[version],
            all_versions: raceData.versions
        };
    }

    async getUserStats(userId) {
        const user = await this.getUser(userId);
        if (!user) throw new Error("User not found");

        const raceInfo = this.getRaceInfo(user.race, user.race_version);
        
        return {
            user: {
                id: user.id,
                username: user.username,
                level: user.level,
                exp: user.exp,
                exp_required: this.calculateExpRequired(user.level),
                health: user.health,
                max_health: user.max_health,
                attack: user.attack,
                defense: user.defense,
                speed: user.speed,
                coins: user.coins,
                guild: user.guild
            },
            race: raceInfo,
            equipment: user.equipment,
            inventory_size: Object.keys(user.inventory).reduce((sum, category) => 
                sum + Object.keys(user.inventory[category] || {}).length, 0)
        };
    }
}

export default RPGEngine;