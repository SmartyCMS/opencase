// Live Feed Manager
class LiveFeedManager {
    constructor() {
        this.feedItems = [];
        this.maxItems = 20;
        
        this.initEventListeners();
        this.loadInitialFeed();
    }
    
    initEventListeners() {
        // Auto-scroll live feed
        const container = document.getElementById('live-feed');
        if (container) {
            let isScrolling = false;
            
            setInterval(() => {
                if (!isScrolling && container.children.length > 0) {
                    container.scrollLeft += 1;
                    
                    // Reset scroll when reaching end
                    if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
                        container.scrollLeft = 0;
                    }
                }
            }, 50);
            
            // Pause auto-scroll on hover
            container.addEventListener('mouseenter', () => {
                isScrolling = true;
            });
            
            container.addEventListener('mouseleave', () => {
                isScrolling = false;
            });
        }
    }
    
    async loadInitialFeed() {
        try {
            const response = await window.app.apiRequest('/api/game/live-feed');
            if (response.ok) {
                const data = await response.json();
                this.feedItems = data.liveFeed;
                this.renderFeed();
            }
        } catch (error) {
            console.error('Failed to load live feed:', error);
            // Generate mock data for demo
            this.generateMockFeed();
        }
    }
    
    generateMockFeed() {
        const mockUsers = [
            { username: 'Player1', avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg' },
            { username: 'CaseHunter', avatar: 'https://avatars.steamstatic.com/b5bd56c1aa4644a474a2e4972be27ef94e52a288_medium.jpg' },
            { username: 'SkinCollector', avatar: 'https://avatars.steamstatic.com/4f6bdc3c6e87b6b4b8b8b8b8b8b8b8b8b8b8b8b8_medium.jpg' },
            { username: 'LuckyGamer', avatar: 'https://avatars.steamstatic.com/c5d56c1aa4644a474a2e4972be27ef94e52a288_medium.jpg' }
        ];
        
        const mockItems = [
            { name: 'AK-47 | Redline', price: 25.50, icon_url: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310776/256fx256f', rarity: 'classified' },
            { name: 'AWP | Dragon Lore', price: 2500.00, icon_url: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310777/256fx256f', rarity: 'covert' },
            { name: 'M4A4 | Howl', price: 1800.00, icon_url: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310778/256fx256f', rarity: 'covert' },
            { name: 'Glock-18 | Water Elemental', price: 8.50, icon_url: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/310779/256fx256f', rarity: 'restricted' }
        ];
        
        const mockCases = [
            { name: 'Weapon Case' },
            { name: 'Operation Bravo Case' },
            { name: 'Chroma Case' }
        ];
        
        // Generate 15 mock feed items
        for (let i = 0; i < 15; i++) {
            const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
            const item = mockItems[Math.floor(Math.random() * mockItems.length)];
            const caseItem = mockCases[Math.floor(Math.random() * mockCases.length)];
            
            const types = ['case_opening', 'upgrade_success', 'upgrade_fail'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            this.feedItems.push({
                type,
                user,
                item: type !== 'upgrade_fail' ? item : null,
                case: type === 'case_opening' ? caseItem : null,
                value: item.price,
                timestamp: new Date(Date.now() - Math.random() * 3600000) // Random time in last hour
            });
        }
        
        this.renderFeed();
    }
    
    renderFeed() {
        const container = document.getElementById('live-feed');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.feedItems.forEach(item => {
            const feedElement = this.createFeedElement(item);
            container.appendChild(feedElement);
        });
    }
    
    createFeedElement(data) {
        const element = document.createElement('div');
        element.className = 'live-feed-item fade-in';
        
        let actionText = '';
        let valueText = '';
        let itemImage = '';
        
        switch (data.type) {
            case 'case_opening':
                actionText = `opened ${data.case?.name || 'a case'}`;
                valueText = `${formatPrice(data.value)}`;
                itemImage = data.item ? `<img src="${data.item.icon_url}" alt="${data.item.name}" class="live-feed-item-image">` : '';
                break;
            case 'upgrade_success':
                actionText = 'upgraded successfully';
                valueText = `${formatPrice(data.value)}`;
                itemImage = data.item ? `<img src="${data.item.icon_url}" alt="${data.item.name}" class="live-feed-item-image">` : '';
                break;
            case 'upgrade_fail':
                actionText = 'upgrade failed';
                valueText = `${formatPrice(data.value)}`;
                itemImage = '<div class="live-feed-item-image upgrade-fail-icon"><i class="fas fa-times"></i></div>';
                break;
        }
        
        element.innerHTML = `
            <div class="live-feed-header">
                <img src="${data.user.avatar}" alt="${data.user.username}" class="live-feed-avatar">
                <div>
                    <div class="live-feed-username">${data.user.username}</div>
                    <div class="live-feed-action">${actionText}</div>
                </div>
            </div>
            <div class="live-feed-item-info">
                ${itemImage}
                <div class="live-feed-item-details">
                    <h4>${data.item ? data.item.name : 'Upgrade Attempt'}</h4>
                    <div class="live-feed-item-value ${data.type === 'upgrade_fail' ? 'text-red' : ''}">${valueText}</div>
                </div>
            </div>
        `;
        
        return element;
    }
    
    addFeedItem(data) {
        // Add to beginning of array
        this.feedItems.unshift(data);
        
        // Keep only max items
        if (this.feedItems.length > this.maxItems) {
            this.feedItems = this.feedItems.slice(0, this.maxItems);
        }
        
        // Add to DOM
        const container = document.getElementById('live-feed');
        if (container) {
            const newElement = this.createFeedElement(data);
            container.insertBefore(newElement, container.firstChild);
            
            // Remove excess elements
            while (container.children.length > this.maxItems) {
                container.removeChild(container.lastChild);
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.liveFeedManager = new LiveFeedManager();
});