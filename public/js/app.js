// Main Application Class
class CaseHuntApp {
    constructor() {
        this.socket = null;
        this.user = null;
        this.currentPage = 'cases';
        this.token = localStorage.getItem('token');
        
        this.init();
    }
    
    init() {
        this.initSocket();
        this.initEventListeners();
        this.checkAuth();
        this.loadPage('cases');
    }
    
    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('live-feed', (data) => {
            this.addLiveFeedItem(data);
        });
        
        this.socket.on('online-count', (count) => {
            document.getElementById('online-count').textContent = count;
        });
    }
    
    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.loadPage(page);
            });
        });
        
        // Auth buttons
        document.getElementById('login-btn')?.addEventListener('click', () => {
            this.showSteamLogin();
        });
        
        document.getElementById('logout-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        });
    }
    
    async checkAuth() {
        if (!this.token) return;
        
        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.updateUserUI();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }
    
    updateUserUI() {
        if (this.user) {
            document.getElementById('auth-buttons').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('user-balance').textContent = `$${this.user.balance.toFixed(2)}`;
            document.getElementById('user-avatar').src = this.user.avatar;
        } else {
            document.getElementById('auth-buttons').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
        }
    }
    
    showSteamLogin() {
        // In a real implementation, this would redirect to Steam OpenID
        // For demo purposes, we'll simulate a login
        const mockUser = {
            steamId: '76561198000000000',
            username: 'Demo User',
            avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
        };
        
        this.simulateLogin(mockUser);
    }
    
    async simulateLogin(userData) {
        try {
            const response = await fetch('/api/auth/steam', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.updateUserUI();
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification('Login failed!', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed!', 'error');
        }
    }
    
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        this.updateUserUI();
        this.showNotification('Logged out successfully!', 'info');
    }
    
    loadPage(page) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(p => {
            p.style.display = 'none';
        });
        
        // Show selected page
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.style.display = 'flex';
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
        
        this.currentPage = page;
        
        // Load page-specific content
        switch (page) {
            case 'cases':
                window.casesManager?.loadCases();
                break;
            case 'inventory':
                window.inventoryManager?.loadInventory();
                break;
            case 'upgrade':
                window.upgradeManager?.loadUpgradeOptions();
                break;
        }
    }
    
    addLiveFeedItem(data) {
        const container = document.getElementById('live-feed');
        if (!container) return;
        
        const item = document.createElement('div');
        item.className = 'live-feed-item fade-in';
        
        let actionText = '';
        let valueText = '';
        
        switch (data.type) {
            case 'case_opening':
                actionText = `opened ${data.case.name}`;
                valueText = `$${data.item.price.toFixed(2)}`;
                break;
            case 'upgrade_success':
                actionText = 'upgraded successfully';
                valueText = `$${data.targetItem.price.toFixed(2)}`;
                break;
            case 'upgrade_fail':
                actionText = 'upgrade failed';
                valueText = `$${data.value.toFixed(2)}`;
                break;
        }
        
        item.innerHTML = `
            <div class="live-feed-header">
                <img src="${data.user.avatar}" alt="${data.user.username}" class="live-feed-avatar">
                <div>
                    <div class="live-feed-username">${data.user.username}</div>
                    <div class="live-feed-action">${actionText}</div>
                </div>
            </div>
            <div class="live-feed-item-info">
                ${data.item ? `<img src="${data.item.icon_url}" alt="${data.item.name}" class="live-feed-item-image">` : ''}
                <div class="live-feed-item-details">
                    <h4>${data.item ? data.item.name : 'Upgrade Attempt'}</h4>
                    <div class="live-feed-item-value">${valueText}</div>
                </div>
            </div>
        `;
        
        // Add to beginning of feed
        container.insertBefore(item, container.firstChild);
        
        // Remove old items (keep only 20)
        while (container.children.length > 20) {
            container.removeChild(container.lastChild);
        }
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
    
    async apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            }
        };
        
        const response = await fetch(endpoint, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Unauthorized');
        }
        
        return response;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CaseHuntApp();
});

// Utility functions
function formatPrice(price) {
    return `$${price.toFixed(2)}`;
}

function getRarityClass(rarity) {
    return `rarity-${rarity.toLowerCase()}`;
}

function createParticleEffect(element) {
    const particles = document.createElement('div');
    particles.className = 'particles';
    
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 2 + 's';
        particles.appendChild(particle);
    }
    
    element.appendChild(particles);
    
    setTimeout(() => {
        particles.remove();
    }, 3000);
}