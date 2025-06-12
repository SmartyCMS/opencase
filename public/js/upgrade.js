// Upgrade Manager
class UpgradeManager {
    constructor() {
        this.selectedSourceItem = null;
        this.selectedTargetItem = null;
        this.upgradeOptions = [];
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Upgrade button
        document.getElementById('upgrade-btn')?.addEventListener('click', () => {
            this.performUpgrade();
        });
        
        // Source item slot
        document.getElementById('upgrade-from-slot')?.addEventListener('click', () => {
            this.showInventorySelector();
        });
    }
    
    async loadUpgradeOptions() {
        if (!window.app.user) {
            this.showLoginRequired();
            return;
        }
        
        // Load user inventory for source selection
        await this.loadUserInventory();
    }
    
    async loadUserInventory() {
        try {
            const response = await window.app.apiRequest('/api/game/inventory');
            if (response.ok) {
                const data = await response.json();
                this.userInventory = data.inventory;
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            window.app.showNotification('Failed to load inventory', 'error');
        }
    }
    
    showInventorySelector() {
        if (!this.userInventory || this.userInventory.length === 0) {
            window.app.showNotification('No items in inventory', 'info');
            return;
        }
        
        // Create inventory selector modal (simplified)
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Item to Upgrade</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="inventory-grid" id="upgrade-inventory-grid">
                        ${this.userInventory.map(item => `
                            <div class="inventory-item hover-scale" data-item-id="${item.id}">
                                <img src="${item.icon_url}" alt="${item.name}">
                                <div class="inventory-item-name">${item.name}</div>
                                <div class="inventory-item-price">${formatPrice(item.price)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelectorAll('.inventory-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemId = item.dataset.itemId;
                const selectedItem = this.userInventory.find(i => i.id == itemId);
                this.selectSourceItem(selectedItem);
                modal.remove();
            });
        });
    }
    
    async selectSourceItem(item) {
        this.selectedSourceItem = item;
        
        // Update UI
        const slot = document.getElementById('upgrade-from-slot');
        slot.innerHTML = `
            <img src="${item.icon_url}" alt="${item.name}">
            <div class="item-name">${item.name}</div>
            <div class="item-price">${formatPrice(item.price)}</div>
        `;
        slot.className = `item-slot ${getRarityClass(item.rarity)}`;
        
        // Load upgrade targets
        await this.loadUpgradeTargets(item.item_id);
    }
    
    async loadUpgradeTargets(itemId) {
        try {
            const response = await window.app.apiRequest(`/api/upgrade/options/${itemId}`);
            if (response.ok) {
                const data = await response.json();
                this.upgradeOptions = data.upgradeTargets;
                this.renderUpgradeTargets();
            }
        } catch (error) {
            console.error('Failed to load upgrade targets:', error);
            window.app.showNotification('Failed to load upgrade options', 'error');
        }
    }
    
    renderUpgradeTargets() {
        const container = document.getElementById('upgrade-targets');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.upgradeOptions.forEach(target => {
            const targetElement = document.createElement('div');
            targetElement.className = `upgrade-target ${getRarityClass(target.rarity)} hover-scale`;
            targetElement.innerHTML = `
                <img src="${target.icon_url}" alt="${target.name}">
                <div class="upgrade-target-name">${target.name}</div>
                <div class="upgrade-target-chance">${target.success_chance}%</div>
                <div class="upgrade-target-price">${formatPrice(target.price)}</div>
            `;
            
            targetElement.addEventListener('click', () => {
                this.selectTargetItem(target, targetElement);
            });
            
            container.appendChild(targetElement);
        });
    }
    
    selectTargetItem(target, element) {
        // Remove previous selection
        document.querySelectorAll('.upgrade-target').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select new target
        element.classList.add('selected');
        this.selectedTargetItem = target;
        
        // Enable upgrade button
        const upgradeBtn = document.getElementById('upgrade-btn');
        upgradeBtn.disabled = false;
        upgradeBtn.innerHTML = `Upgrade (${target.success_chance}% chance)`;
    }
    
    async performUpgrade() {
        if (!this.selectedSourceItem || !this.selectedTargetItem) return;
        
        const upgradeBtn = document.getElementById('upgrade-btn');
        upgradeBtn.disabled = true;
        upgradeBtn.innerHTML = '<span class="loading-spinner"></span> Upgrading...';
        
        try {
            const response = await window.app.apiRequest('/api/upgrade/perform', {
                method: 'POST',
                body: JSON.stringify({
                    inventoryItemId: this.selectedSourceItem.id,
                    targetItemId: this.selectedTargetItem.id
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.showUpgradeResult(data);
            } else {
                const error = await response.json();
                window.app.showNotification(error.message, 'error');
                this.resetUpgradeButton();
            }
        } catch (error) {
            console.error('Upgrade failed:', error);
            window.app.showNotification('Upgrade failed', 'error');
            this.resetUpgradeButton();
        }
    }
    
    showUpgradeResult(result) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        
        const success = result.upgradeSuccess;
        const resultItem = success ? result.resultItem : null;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${success ? 'Upgrade Successful!' : 'Upgrade Failed'}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="upgrade-result ${success ? 'upgrade-success' : 'upgrade-fail'}">
                        ${success ? `
                            <img src="${resultItem.icon_url}" alt="${resultItem.name}" class="item-reveal">
                            <h3>${resultItem.name}</h3>
                            <div class="result-item-price">${formatPrice(resultItem.price)}</div>
                            <p>Congratulations! Your upgrade was successful!</p>
                        ` : `
                            <div class="upgrade-fail-icon">
                                <i class="fas fa-times-circle"></i>
                            </div>
                            <h3>Upgrade Failed</h3>
                            <p>Better luck next time!</p>
                            <p>Success chance was: ${result.successChance}%</p>
                        `}
                    </div>
                    <div class="upgrade-result-controls">
                        <button class="btn btn-primary" id="upgrade-result-ok">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add particle effect for success
        if (success) {
            createParticleEffect(modal.querySelector('.upgrade-result'));
        }
        
        // Event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
            this.resetUpgrade();
        });
        
        modal.querySelector('#upgrade-result-ok').addEventListener('click', () => {
            modal.remove();
            this.resetUpgrade();
        });
        
        // Show notification
        const message = success 
            ? `Successfully upgraded to ${resultItem.name}!`
            : 'Upgrade failed. Better luck next time!';
        window.app.showNotification(message, success ? 'success' : 'error');
    }
    
    resetUpgrade() {
        this.selectedSourceItem = null;
        this.selectedTargetItem = null;
        
        // Reset UI
        const slot = document.getElementById('upgrade-from-slot');
        slot.innerHTML = `
            <div class="slot-placeholder">
                <i class="fas fa-plus"></i>
                <span>Select Item</span>
            </div>
        `;
        slot.className = 'item-slot';
        
        document.getElementById('upgrade-targets').innerHTML = '';
        
        this.resetUpgradeButton();
        
        // Reload inventory
        this.loadUserInventory();
    }
    
    resetUpgradeButton() {
        const upgradeBtn = document.getElementById('upgrade-btn');
        upgradeBtn.disabled = true;
        upgradeBtn.innerHTML = 'Upgrade';
    }
    
    showLoginRequired() {
        const container = document.querySelector('#upgrade-page .upgrade-container');
        container.innerHTML = `
            <div class="login-required">
                <h2>Login Required</h2>
                <p>Please login to access the upgrade feature.</p>
                <button class="btn btn-primary" onclick="window.app.showSteamLogin()">
                    <i class="fab fa-steam"></i>
                    Login with Steam
                </button>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.upgradeManager = new UpgradeManager();
});