// Cases Manager
class CasesManager {
    constructor() {
        this.cases = [];
        this.currentCase = null;
        this.isOpening = false;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Case opening button
        document.getElementById('open-case-btn')?.addEventListener('click', () => {
            this.openCase();
        });
    }
    
    async loadCases() {
        try {
            const response = await window.app.apiRequest('/api/cases');
            if (response.ok) {
                const data = await response.json();
                this.cases = data.cases;
                this.renderCases();
            }
        } catch (error) {
            console.error('Failed to load cases:', error);
            window.app.showNotification('Failed to load cases', 'error');
        }
    }
    
    renderCases() {
        const container = document.getElementById('cases-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.cases.forEach(caseItem => {
            const caseElement = document.createElement('div');
            caseElement.className = 'case-card hover-lift';
            caseElement.innerHTML = `
                <div class="case-image">
                    <img src="${caseItem.image}" alt="${caseItem.name}">
                    <div class="case-price">${formatPrice(caseItem.price)}</div>
                </div>
                <div class="case-info">
                    <h3 class="case-name">${caseItem.name}</h3>
                    <p class="case-description">${caseItem.description}</p>
                    <div class="case-stats">
                        <span>Opened: ${caseItem.total_opened || 0}</span>
                        <span>Avg: ${formatPrice(caseItem.avg_value || 0)}</span>
                    </div>
                </div>
            `;
            
            caseElement.addEventListener('click', () => {
                this.selectCase(caseItem);
            });
            
            container.appendChild(caseElement);
        });
        
        // Add stagger animation
        container.classList.add('stagger-animation');
    }
    
    async selectCase(caseItem) {
        if (!window.app.user) {
            window.app.showNotification('Please login to open cases', 'error');
            return;
        }
        
        if (window.app.user.balance < caseItem.price) {
            window.app.showNotification('Insufficient balance', 'error');
            return;
        }
        
        this.currentCase = caseItem;
        
        // Load case details
        try {
            const response = await window.app.apiRequest(`/api/cases/${caseItem.id}`);
            if (response.ok) {
                const data = await response.json();
                this.showCaseModal(data);
            }
        } catch (error) {
            console.error('Failed to load case details:', error);
            window.app.showNotification('Failed to load case details', 'error');
        }
    }
    
    showCaseModal(caseData) {
        document.getElementById('case-modal-title').textContent = caseData.case.name;
        
        // Populate roulette with items
        const rouletteContainer = document.getElementById('roulette-items');
        rouletteContainer.innerHTML = '';
        
        // Create extended item list for roulette effect
        const extendedItems = [];
        for (let i = 0; i < 50; i++) {
            const randomItem = caseData.items[Math.floor(Math.random() * caseData.items.length)];
            extendedItems.push(randomItem);
        }
        
        extendedItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `roulette-item ${getRarityClass(item.rarity)}`;
            itemElement.innerHTML = `<img src="${item.icon_url}" alt="${item.name}">`;
            rouletteContainer.appendChild(itemElement);
        });
        
        window.app.showModal('case-modal');
    }
    
    async openCase() {
        if (this.isOpening || !this.currentCase) return;
        
        this.isOpening = true;
        const openButton = document.getElementById('open-case-btn');
        openButton.disabled = true;
        openButton.innerHTML = '<span class="loading-spinner"></span> Opening...';
        
        try {
            const response = await window.app.apiRequest('/api/game/open-case', {
                method: 'POST',
                body: JSON.stringify({ caseId: this.currentCase.id })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.animateRoulette(data.item);
                
                // Update user balance
                window.app.user.balance = data.balance;
                window.app.updateUserUI();
            } else {
                const error = await response.json();
                window.app.showNotification(error.message, 'error');
                this.resetOpenButton();
            }
        } catch (error) {
            console.error('Case opening failed:', error);
            window.app.showNotification('Case opening failed', 'error');
            this.resetOpenButton();
        }
    }
    
    animateRoulette(wonItem) {
        const rouletteContainer = document.getElementById('roulette-items');
        const items = rouletteContainer.children;
        
        // Find a good position for the won item (around the center)
        const centerIndex = Math.floor(items.length / 2) + Math.floor(Math.random() * 5) - 2;
        
        // Replace the item at center position with won item
        if (items[centerIndex]) {
            items[centerIndex].innerHTML = `<img src="${wonItem.icon_url}" alt="${wonItem.name}">`;
            items[centerIndex].className = `roulette-item ${getRarityClass(wonItem.rarity)}`;
        }
        
        // Calculate scroll position
        const itemWidth = 110; // 100px + 10px gap
        const scrollPosition = centerIndex * itemWidth - (rouletteContainer.parentElement.offsetWidth / 2) + (itemWidth / 2);
        
        // Animate
        rouletteContainer.style.transform = `translateX(-${scrollPosition}px)`;
        rouletteContainer.classList.add('roulette-spinning');
        
        // Show result after animation
        setTimeout(() => {
            this.showResult(wonItem);
            this.resetRoulette();
        }, 3000);
    }
    
    showResult(item) {
        window.app.closeModal();
        
        // Populate result modal
        const resultContainer = document.getElementById('result-item');
        resultContainer.innerHTML = `
            <img src="${item.icon_url}" alt="${item.name}" class="item-reveal">
            <h3 class="result-item-name">${item.name}</h3>
            <div class="result-item-price">${formatPrice(item.price)}</div>
        `;
        
        // Add rarity class for glow effect
        resultContainer.className = `result-item ${getRarityClass(item.rarity)} glow`;
        
        // Store current item for sell/keep actions
        this.currentWonItem = item;
        
        // Add particle effect
        createParticleEffect(resultContainer);
        
        window.app.showModal('result-modal');
        
        // Setup result buttons
        this.setupResultButtons();
    }
    
    setupResultButtons() {
        const sellBtn = document.getElementById('sell-item-btn');
        const keepBtn = document.getElementById('keep-item-btn');
        
        sellBtn.onclick = () => this.sellItem();
        keepBtn.onclick = () => this.keepItem();
    }
    
    async sellItem() {
        // In a real implementation, this would sell the item
        // For now, we'll just close the modal and show a notification
        window.app.closeModal();
        window.app.showNotification(`Sold ${this.currentWonItem.name} for ${formatPrice(this.currentWonItem.price * 0.9)}`, 'success');
        
        // Update balance (90% of item value)
        window.app.user.balance += this.currentWonItem.price * 0.9;
        window.app.updateUserUI();
    }
    
    keepItem() {
        window.app.closeModal();
        window.app.showNotification(`${this.currentWonItem.name} added to inventory`, 'success');
        
        // Refresh inventory if on inventory page
        if (window.app.currentPage === 'inventory') {
            window.inventoryManager?.loadInventory();
        }
    }
    
    resetRoulette() {
        const rouletteContainer = document.getElementById('roulette-items');
        rouletteContainer.style.transform = 'translateX(0)';
        rouletteContainer.classList.remove('roulette-spinning');
        this.resetOpenButton();
    }
    
    resetOpenButton() {
        const openButton = document.getElementById('open-case-btn');
        openButton.disabled = false;
        openButton.innerHTML = 'Open Case';
        this.isOpening = false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.casesManager = new CasesManager();
});