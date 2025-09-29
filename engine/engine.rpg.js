// engine.rpg.js
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Error handling untuk load configuration
let config, items;
try {
    const configPath = join(__dirname, '../database/rpg/rpg.config.json')
    const itemsPath = join(__dirname, '../database/rpg/rpg.items.json')
    
    if (!existsSync(configPath)) {
        throw new Error('rpg.config.json not found')
    }
    if (!existsSync(itemsPath)) {
        throw new Error('rpg.items.json not found')
    }
    
    config = JSON.parse(readFileSync(configPath, 'utf8'))
    items = JSON.parse(readFileSync(itemsPath, 'utf8'))
} catch (error) {
    console.error('Error loading RPG config files:', error.message)
    // Fallback config
    config = {
        races: {
            human: {
                name: "Human",
                versions: {
                    v1: { level_required: 1, attack_bonus: 5, speed_bonus: 5, health_bonus: 0, defense_bonus: 0 }
                }
            }
        },
        config: {
            game_settings: { 
                exp_base: 100, 
                exp_multiplier: 1.5, 
                max_level: 100, 
                base_health: 100, 
                base_attack: 10, 
                base_defense: 5,
                base_stamina: 100,
                base_hunger: 100,
                base_energy: 100
            },
            race_chances: { human: 100 },
            cooldowns: {
                hunt: 30000,
                work: 45000,
                mine: 60000,
                fish: 40000,
                chop: 50000,
                craft: 30000,
                cook: 35000,
                duel: 60000,
                boss: 120000,
                dungeon: 90000,
                explore: 80000,
                train: 70000,
                quest: 60000,
                gamble: 30000,
                trade: 25000,
                heal: 20000,
                rest: 30000,
                pray: 40000,
                enchant: 50000,
                forge: 60000,
                alchemy: 45000,
                study: 55000,
                meditate: 35000,
                party: 40000,
                raid: 150000
            }
        }
    }
    items = {}
}

// Database setup dengan error handling
const dbPath = join(__dirname, '../database/rpg/rpg.user.json')
const adapter = new JSONFile(dbPath)
const db = new Low(adapter, { users: [] })

try {
    await db.read()
    
    if (!db.data || typeof db.data !== 'object') {
        db.data = { users: [] }
    }
    if (!Array.isArray(db.data.users)) {
        db.data.users = []
    }
    
    await db.write()
} catch (error) {
    console.error('Error initializing database:', error.message)
    db.data = { users: [] }
}

class RPGSystem {
    constructor() {
        this.config = config
        this.items = items
        this.db = db
    }

    // Calculate required EXP for a level
    requiredExp(level) {
        const { exp_base, exp_multiplier } = this.config.config?.game_settings || { exp_base: 100, exp_multiplier: 1.5 }
        return Math.floor(exp_base * Math.pow(exp_multiplier, level - 1))
    }

    // Find user by ID
    findUser(userId) {
        return this.db.data?.users?.find(user => user.id === userId)
    }

    // Save user data
    async saveUser(userData) {
        try {
            if (!this.db.data) this.db.data = { users: [] }
            if (!Array.isArray(this.db.data.users)) this.db.data.users = []
            
            const index = this.db.data.users.findIndex(user => user.id === userData.id)
            if (index !== -1) {
                this.db.data.users[index] = userData
            } else {
                this.db.data.users.push(userData)
            }
            await this.db.write()
            return true
        } catch (error) {
            console.error('Error saving user:', error)
            return false
        }
    }

    // Create new user dengan default money 100000
    async createUser(userId, name) {
        try {
            if (this.findUser(userId)) {
                throw new Error('User already exists')
            }

            // Determine race based on chances
            const raceChances = this.config.config?.race_chances || { human: 100 }
            const races = Object.keys(raceChances)
            const chances = Object.values(raceChances)
            const total = chances.reduce((sum, chance) => sum + chance, 0)
            
            let random = Math.random() * total
            let selectedRace = races[0]
            
            for (let i = 0; i < chances.length; i++) {
                random -= chances[i]
                if (random <= 0) {
                    selectedRace = races[i]
                    break
                }
            }

            const raceData = this.config.races[selectedRace]
            const version = 'v1'
            const gameSettings = this.config.config?.game_settings || { 
                base_health: 100, base_attack: 10, base_defense: 5,
                base_stamina: 100, base_hunger: 100, base_energy: 100
            }

            const newUser = {
                id: userId,
                name: name,
                level: 1,
                exp: 0,
                money: 100000, // Default money 100000
                race: selectedRace,
                version: version,
                stats: {
                    health: gameSettings.base_health + (raceData?.versions?.[version]?.health_bonus || 0),
                    attack: gameSettings.base_attack + (raceData?.versions?.[version]?.attack_bonus || 0),
                    defense: gameSettings.base_defense + (raceData?.versions?.[version]?.defense_bonus || 0),
                    speed: raceData?.versions?.[version]?.speed_bonus || 0,
                    stamina: gameSettings.base_stamina,
                    hunger: gameSettings.base_hunger,
                    energy: gameSettings.base_energy,
                    max_health: gameSettings.base_health + (raceData?.versions?.[version]?.health_bonus || 0),
                    max_stamina: gameSettings.base_stamina,
                    max_hunger: gameSettings.base_hunger,
                    max_energy: gameSettings.base_energy
                },
                inventory: this.initializeInventory(),
                equipment: {
                    weapon: null,
                    armor: null,
                    accessory: null
                },
                cooldowns: {},
                skills: {
                    mining: 1,
                    fishing: 1,
                    woodcutting: 1,
                    crafting: 1,
                    cooking: 1,
                    combat: 1
                },
                location: "village",
                lastAction: Date.now(),
                createdAt: Date.now(),
                quests: {
                    active: [],
                    completed: []
                }
            }

            const saved = await this.saveUser(newUser)
            if (!saved) {
                throw new Error('Failed to save user data')
            }
            
            return newUser
        } catch (error) {
            console.error('Error creating user:', error)
            throw error
        }
    }

    // Initialize empty inventory
    initializeInventory() {
        const inventory = {}
        Object.keys(this.items).forEach(category => {
            inventory[category] = {}
            Object.keys(this.items[category]).forEach(item => {
                inventory[category][item] = 0
            })
        })
        return inventory
    }

    // Check cooldown
    checkCooldown(userId, action) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const cooldownTime = this.config.config?.cooldowns?.[action] || 60000
        const lastAction = user.cooldowns[action] || 0
        const remaining = lastAction + cooldownTime - Date.now()
        
        return {
            onCooldown: remaining > 0,
            remaining: remaining,
            cooldownTime: cooldownTime
        }
    }

    // Set cooldown
    async setCooldown(userId, action) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        user.cooldowns[action] = Date.now()
        await this.saveUser(user)
        return true
    }

    // Update stats over time
    async updateStatsOverTime(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const timeDiff = Date.now() - user.lastAction
        const hoursPassed = timeDiff / (1000 * 60 * 60)
        
        // Hunger decreases over time
        if (hoursPassed > 0.5) { // Every 30 minutes
            user.stats.hunger = Math.max(0, user.stats.hunger - 10)
        }
        
        // Stamina regenerates over time
        if (hoursPassed > 0.25) { // Every 15 minutes
            user.stats.stamina = Math.min(user.stats.max_stamina, user.stats.stamina + 5)
        }
        
        // Energy regenerates over time
        if (hoursPassed > 0.166) { // Every 10 minutes
            user.stats.energy = Math.min(user.stats.max_energy, user.stats.energy + 10)
        }
        
        user.lastAction = Date.now()
        await this.saveUser(user)
        return user.stats
    }

    // Consume stamina for action
    async consumeStamina(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (user.stats.stamina < amount) {
            throw new Error('Not enough stamina')
        }
        
        user.stats.stamina -= amount
        await this.saveUser(user)
        return user.stats.stamina
    }

    // Consume hunger for action
    async consumeHunger(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        user.stats.hunger = Math.max(0, user.stats.hunger - amount)
        await this.saveUser(user)
        return user.stats.hunger
    }

    // Restore stats
    async restoreStats(userId, stats) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        Object.keys(stats).forEach(stat => {
            if (user.stats[stat] !== undefined) {
                const maxStat = user.stats[`max_${stat}`] || 100
                user.stats[stat] = Math.min(maxStat, user.stats[stat] + stats[stat])
            }
        })
        
        await this.saveUser(user)
        return user.stats
    }

    // Get user EXP
    getExp(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.exp
    }

    // Get user money
    getMoney(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.money
    }

    // Decrease EXP
    async minExp(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        user.exp = Math.max(0, user.exp - amount)
        await this.saveUser(user)
        return user.exp
    }

    // Decrease money
    async minMoney(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (user.money < amount) {
            throw new Error('Insufficient money')
        }
        
        user.money -= amount
        await this.saveUser(user)
        return user.money
    }

    // Add EXP and handle level up
    async addExp(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        user.exp += amount
        let leveledUp = false
        
        while (user.exp >= this.requiredExp(user.level + 1) && user.level < (this.config.config?.game_settings?.max_level || 100)) {
            user.level += 1
            leveledUp = true
            
            // Increase max stats on level up
            user.stats.max_health += 10
            user.stats.max_stamina += 5
            user.stats.max_energy += 8
            user.stats.health = user.stats.max_health
            user.stats.stamina = user.stats.max_stamina
            user.stats.energy = user.stats.max_energy
            
            await this.updateRaceVersion(user)
        }
        
        await this.saveUser(user)
        return { exp: user.exp, level: user.level, leveledUp }
    }

    // Add money
    async addMoney(userId, amount) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        user.money += amount
        await this.saveUser(user)
        return user.money
    }

    // Get race information
    getRace(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const raceData = this.config.races[user.race]
        return {
            race: user.race,
            version: user.version,
            name: raceData?.name || user.race,
            description: raceData?.description || 'No description available',
            bonuses: raceData?.versions?.[user.version] || {},
            nextVersion: this.getNextVersion(user.race, user.version)
        }
    }

    // Get next available race version
    getNextVersion(race, currentVersion) {
        const versions = Object.keys(this.config.races[race]?.versions || {})
        const currentIndex = versions.indexOf(currentVersion)
        
        if (currentIndex < versions.length - 1) {
            return versions[currentIndex + 1]
        }
        return null
    }

    // Update race version if requirements are met
    async updateRaceVersion(user) {
        const nextVersion = this.getNextVersion(user.race, user.version)
        if (!nextVersion) return false
        
        const versionReq = this.config.races[user.race]?.versions?.[nextVersion]
        if (user.level >= (versionReq?.level_required || 999)) {
            user.version = nextVersion
            
            // Update stats with new bonuses
            const raceData = this.config.races[user.race]
            const gameSettings = this.config.config?.game_settings || { 
                base_health: 100, base_attack: 10, base_defense: 5 
            }
            
            user.stats.max_health = gameSettings.base_health + (raceData?.versions?.[nextVersion]?.health_bonus || 0)
            user.stats.max_attack = gameSettings.base_attack + (raceData?.versions?.[nextVersion]?.attack_bonus || 0)
            user.stats.max_defense = gameSettings.base_defense + (raceData?.versions?.[nextVersion]?.defense_bonus || 0)
            user.stats.health = user.stats.max_health
            user.stats.attack = user.stats.max_attack
            user.stats.defense = user.stats.max_defense
            user.stats.speed = raceData?.versions?.[nextVersion]?.speed_bonus || 0
            
            await this.saveUser(user)
            return true
        }
        
        return false
    }

    // Get user stats
    getStats(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.stats
    }

    // Add item to inventory
    async addItem(userId, category, item, quantity = 1) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (!user.inventory[category]) {
            user.inventory[category] = {}
        }
        
        if (user.inventory[category][item] === undefined) {
            user.inventory[category][item] = 0
        }
        
        user.inventory[category][item] += quantity
        await this.saveUser(user)
        return user.inventory[category][item]
    }

    // Remove item from inventory
    async removeItem(userId, category, item, quantity = 1) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (!user.inventory[category] || user.inventory[category][item] === undefined) {
            throw new Error('Invalid item or category')
        }
        
        if (user.inventory[category][item] < quantity) {
            throw new Error('Not enough items')
        }
        
        user.inventory[category][item] -= quantity
        await this.saveUser(user)
        return user.inventory[category][item]
    }

    // Get inventory
    getInventory(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.inventory
    }

    // Equip item
    async equipItem(userId, category, item) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (!user.inventory[category] || user.inventory[category][item] === undefined || user.inventory[category][item] < 1) {
            throw new Error('Item not in inventory')
        }
        
        // Check if category is equippable
        if (!['weapon', 'armor', 'accessory'].includes(category)) {
            throw new Error('Item cannot be equipped')
        }
        
        // Unequip current item if any
        if (user.equipment[category]) {
            await this.addItem(userId, category, user.equipment[category], 1)
        }
        
        // Equip new item
        user.equipment[category] = item
        await this.removeItem(userId, category, item, 1)
        
        // Update stats based on equipped item
        await this.updateStatsWithEquipment(userId)
        
        await this.saveUser(user)
        return user.equipment
    }

    // Update stats with equipped items
    async updateStatsWithEquipment(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const raceData = this.config.races[user.race]
        const versionData = raceData?.versions?.[user.version] || {}
        const gameSettings = this.config.config?.game_settings || { 
            base_health: 100, base_attack: 10, base_defense: 5 
        }
        
        // Base stats from race and version
        let baseStats = {
            health: user.stats.max_health,
            attack: user.stats.max_attack,
            defense: user.stats.max_defense,
            speed: versionData.speed_bonus || 0,
            stamina: user.stats.stamina,
            hunger: user.stats.hunger,
            energy: user.stats.energy
        }
        
        // Add equipment bonuses
        if (user.equipment.weapon) {
            const weapon = this.items.weapon?.[user.equipment.weapon]
            baseStats.attack += weapon?.damage || 0
        }
        
        if (user.equipment.armor) {
            const armor = this.items.armor?.[user.equipment.armor]
            baseStats.defense += armor?.defense || 0
        }
        
        if (user.equipment.accessory) {
            const accessory = this.items.accessory?.[user.equipment.accessory]
            baseStats.defense += accessory?.defense || 0
            baseStats.attack += accessory?.attack || 0
        }
        
        user.stats = { ...user.stats, ...baseStats }
        await this.saveUser(user)
        return user.stats
    }

    // Get equipped items
    getEquipment(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.equipment
    }

    // Use item (potion, food, etc.)
    async useItem(userId, category, item, quantity = 1) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (!user.inventory[category] || user.inventory[category][item] === undefined || user.inventory[category][item] < quantity) {
            throw new Error('Not enough items')
        }
        
        const itemData = this.items[category]?.[item] || {}
        let effects = {}
        
        switch (category) {
            case 'potion':
                if (itemData.restore) {
                    effects.health = itemData.restore * quantity
                }
                break;
            case 'food':
                if (itemData.hunger) {
                    effects.hunger = itemData.hunger * quantity
                }
                if (itemData.energy) {
                    effects.energy = itemData.energy * quantity
                }
                break;
            case 'drink':
                if (itemData.energy) {
                    effects.energy = itemData.energy * quantity
                }
                if (itemData.stamina) {
                    effects.stamina = itemData.stamina * quantity
                }
                break;
            default:
                throw new Error('Item cannot be used directly')
        }
        
        // Apply effects
        await this.restoreStats(userId, effects)
        
        // Remove used items
        await this.removeItem(userId, category, item, quantity)
        
        return effects
    }

    // Get user profile
    getProfile(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const raceInfo = this.getRace(userId)
        const nextLevelExp = this.requiredExp(user.level + 1)
        
        return {
            id: user.id,
            name: user.name,
            level: user.level,
            exp: user.exp,
            nextLevelExp: nextLevelExp,
            money: user.money,
            race: raceInfo,
            stats: user.stats,
            equipment: user.equipment,
            skills: user.skills,
            location: user.location,
            createdAt: user.createdAt
        }
    }

    // Get leaderboard by specific criteria
    getLeaderboard(criteria = 'level', limit = 10) {
        const users = [...(this.db.data?.users || [])]
        
        users.sort((a, b) => {
            if (criteria === 'level') {
                return b.level - a.level || b.exp - a.exp
            } else if (criteria === 'money') {
                return b.money - a.money
            } else if (criteria === 'combat') {
                return (b.stats.attack + b.stats.defense) - (a.stats.attack + a.stats.defense)
            }
            return 0
        })
        
        return users.slice(0, limit).map(user => ({
            name: user.name,
            level: user.level,
            exp: user.exp,
            money: user.money,
            race: user.race,
            stats: user.stats
        }))
    }

    // Skill system
    async addSkillExp(userId, skill, exp = 1) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        if (!user.skills[skill]) {
            user.skills[skill] = 1
        }
        
        // Simple skill progression
        if (Math.random() < 0.3) { // 30% chance to gain skill level
            user.skills[skill] += 1
        }
        
        await this.saveUser(user)
        return user.skills[skill]
    }

    // Get user skills
    getSkills(userId) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        return user.skills
    }

    // Travel to different locations
    async travel(userId, location) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        const locations = {
            'village': { level: 1, cost: 0 },
            'forest': { level: 5, cost: 100 },
            'mine': { level: 10, cost: 500 },
            'mountain': { level: 15, cost: 1000 },
            'dungeon': { level: 20, cost: 2000 },
            'city': { level: 25, cost: 5000 }
        }
        
        const target = locations[location]
        if (!target) {
            throw new Error('Location not found')
        }
        
        if (user.level < target.level) {
            throw new Error(`Level ${target.level} required to travel to ${location}`)
        }
        
        if (user.money < target.cost) {
            throw new Error(`Need ${target.cost} gold to travel to ${location}`)
        }
        
        user.money -= target.cost
        user.location = location
        await this.saveUser(user)
        
        return location
    }

    // Crafting system
    async craftItem(userId, item, category) {
        const user = this.findUser(userId)
        if (!user) throw new Error('User not found')
        
        // Simple crafting logic - would need recipes database
        const recipes = {
            'iron_sword': { material: 'iron_bar', quantity: 3, skill: 'crafting', level: 2 },
            'steel_sword': { material: 'steel_bar', quantity: 5, skill: 'crafting', level: 3 },
            'health_potion': { material: 'magic_dust', quantity: 2, skill: 'alchemy', level: 1 }
        }
        
        const recipe = recipes[item]
        if (!recipe) {
            throw new Error('Recipe not found')
        }
        
        if (user.skills[recipe.skill] < recipe.level) {
            throw new Error(`Need ${recipe.skill} level ${recipe.level} to craft this`)
        }
        
        // Check materials
        if (user.inventory.material?.[recipe.material] < recipe.quantity) {
            throw new Error(`Need ${recipe.quantity} ${recipe.material}`)
        }
        
        // Craft item
        await this.removeItem(userId, 'material', recipe.material, recipe.quantity)
        await this.addItem(userId, category, item, 1)
        await this.addSkillExp(userId, recipe.skill)
        
        return item
    }
}

export default new RPGSystem()