// Inventory Manager
class InventoryManager {
    constructor() {
        this.inventory = [];
        this.selectedItems = new Set();
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Multi-select functionality could be added here
    }
    
    async loadInventory() {
        if (!window.app.user) {
            this.showLoginRequired();
            return;
        }
        
        try {
            const response = await window.app.apiRequest('/api/game/inventory');
            if (response.ok) {
                const data = await response.json();
                this.inventory = data.inventory;
                this.renderInventory();
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            window.app.showNotification('Failed to load inventory', 'error');
        }
    }
    
    renderInventory() {
        const container = document.getElementById('inventory-grid');
        if (!container) return;
        
        if (this.inventory.length === 0) {
            container.innerHTML = `
                <div class="empty-inventory">
                    <i class="fas fa-box-open"></i>
                    <h3>Your inventory is empty</h3>
                    <p>Open some cases to get items!</p>
                    <button class="btn btn-primary" onclick="window.app.loadPage('cases')">
                        Browse Cases
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `inventory-item ${getRarityClass(item.rarity)} hover-lift`;
            itemElement.innerHTML = `
                <img src="${item.icon_url}" alt="${item.name}">
                <div class="inventory-item-name">${item.name}</div>
                <div class="inventory-item-price">${formatPrice(item.price)}</div>
                <div class="inventory-item-float">Float: ${item.float_value ? item.float_value.toFixed(6) : 'N/A'}</div>
                <div class="inventory-item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.inventoryManager.sellItem(${item.id})">
                        <i class="fas fa-dollar-sign"></i>
                        Sell
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="window.inventoryManager.upgradeItem(${item.id})">
                        <i class="fas fa-arrow-up"></i>
                        Upgrade
                    </button>
                </div>
            `;
            
            container.appendChild(itemElement);
        });
        
        // Add stagger animation
        container.classList.add('stagger-animation');
    }
    
    async sellItem(inventoryItemId) {
        const item = this.inventory.find(i => i.id === inventoryItemId);
        if (!item) return;
        
        const confirmed = confirm(`Are you sure you want to sell ${item.name} for ${formatPrice(item.price * 0.9)}?`);
        if (!confirmed) return;
        
        try {
            const response = await window.app.apiRequest('/api/game/sell-item', {
                method: 'POST',
                body: JSON.stringify({ inventoryItemId })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Update balance
                window.app.user.balance = data.balance;
                window.app.updateUserUI();
                
                // Remove item from inventory
                this.inventory = this.inventory.filter(i => i.id !== inventoryItemId);
                this.renderInventory();
                
                window.app.showNotification(`Sold ${item.name} for ${formatPrice(data.soldPrice)}`, 'success');
            } else {
                const error = await response.json();
                window.app.showNotification(error.message, 'error');
            }
        } catch (error) {
            console.error('Failed to sell item:', error);
            window.app.showNotification('Failed to sell item', 'error');
        }
    }
    
    upgradeItem(inventoryItemId) {
        const item = this.inventory.find(i => i.id === inventoryItemId);
        if (!item) return;
        
        // Switch to upgrade page and pre-select this item
        window.app.loadPage('upgrade');
        
        // Wait for page to load then select the item
        setTimeout(() => {
            if (window.upgradeManager) {
                window.upgradeManager.selectSourceItem(item);
            }
        }, 100);
    }
    
    showLoginRequired() {
        const container = document.getElementById('inventory-grid');
        if (!container) return;
        
        container.innerHTML = `
            <div class="login-required">
                <i class="fas fa-lock"></i>
                <h3>Login Required</h3>
                <p>Please login to view your inventory.</p>
                <button class="btn btn-primary" onclick="window.app.showSteamLogin()">
                    <i class="fab fa-steam"></i>
                    Login with Steam
                </button>
            </div>
        `;
    }
    
    getInventoryValue() {
        return this.inventory.reduce((total, item) => total + item.price, 0);
    }
    
    getInventoryStats() {
        const stats = {
            totalItems: this.inventory.length,
            totalValue: this.getInventoryValue(),
            rarities: {}
        };
        
        this.inventory.forEach(item => {
            if (!stats.rarities[item.rarity]) {
                stats.rarities[item.rarity] = 0;
            }
            stats.rarities[item.rarity]++;
        });
        
        return stats;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});