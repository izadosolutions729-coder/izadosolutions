/**
 * Izado Solutions - Complaints Portal | Frontend Controller
 * (C) 2026 Izado Solutions Pvt Ltd
 */

// --- Global Application State ---
const APP_STATE = {
    user: null,
    token: localStorage.getItem('izado_token'),
    currentScreen: 'login',
    activePanel: 'complaints',
    complaints: [],
    categories: [],
    activeComplaint: null,
};

// --- API CONFIGURATION ---
const API_BASE = 'https://izadosolutions.onrender.com/api'; 


// --- API Utility Layer ---
const izadoApi = {
    async request(endpoint, method = 'GET', body = null) {
        let headers = {};
        let requestBody = body;

        // Automatically handle FormData (for file uploads) vs JSON
        if (!(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            if (body) requestBody = JSON.stringify(body);
        }

        if (APP_STATE.token) headers['Authorization'] = `Token ${APP_STATE.token}`;

        const options = { method, headers };
        if (requestBody) options.body = requestBody;

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            if (response.status === 401) { logout(); return null; }
            if (response.status === 204) return true;
            return await response.json();
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            showToast("Server Unreachable: Ensure 'python manage.py runserver' is active.");
            return null;
        }
    }
};

// --- View Swapping Controllers ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
        target.classList.add('active');
        APP_STATE.currentScreen = screenId;
        refreshIcons();
    }
}

function showPanel(panelId) {
    document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`${panelId}-view`);
    if (target) {
        target.classList.add('active');
        APP_STATE.activePanel = panelId;

        // Sync Navigation UI
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navBtn = document.getElementById(`sidebar-${panelId}`);
        if (navBtn) navBtn.classList.add('active');

        // Scroll to top of main panel
        document.querySelector('.main-panel').scrollTop = 0;
        refreshIcons();
    }
}

function refreshIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Authentication Controllers ---
async function login(username, password) {
    const loginError = document.getElementById('login-error');
    loginError.innerText = '';

    const data = await izadoApi.request('/auth/login/', 'POST', { username, password });
    if (data && data.token) {
        APP_STATE.token = data.token;
        APP_STATE.user = { 
            id: data.user_id, 
            username: data.username, 
            role: data.role,
            email: data.email
        };
        localStorage.setItem('izado_token', data.token);
        localStorage.setItem('izado_user', JSON.stringify(APP_STATE.user));
        bootstrapPortal();
    } else {
        loginError.innerText = 'Authentication failed. Please verify your credentials.';
    }
}

function logout() {
    localStorage.clear();
    APP_STATE.token = null;
    APP_STATE.user = null;
    
    const statusPill = document.getElementById('server-status-pill');
    if (statusPill) statusPill.style.display = 'none';

    showScreen('login');
}

function tryAutoLogin() {
    const savedUser = localStorage.getItem('izado_user');
    if (APP_STATE.token && savedUser) {
        APP_STATE.user = JSON.parse(savedUser);
        bootstrapPortal();
    } else {
        showScreen('login');
    }
}

// --- Forgot Password Flow ---
let otpCountdown;

function startOtpTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('otp-timer-display');
    const submitBtn = document.querySelector('#verify-otp-form button[type="submit"]');
    
    clearInterval(otpCountdown);
    
    otpCountdown = setInterval(() => {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = `Expires in: ${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(otpCountdown);
            display.textContent = "OTP Expired! Please request a new one.";
            display.style.color = "#ff6666";
            submitBtn.disabled = true;
        } else {
            display.style.color = "var(--accent)";
            submitBtn.disabled = false;
        }
    }, 1000);
}

document.getElementById('show-forgot-btn')?.addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('forgot-password-forms').style.display = 'block';
    document.getElementById('request-otp-form').style.display = 'block';
    document.getElementById('verify-otp-form').style.display = 'none';
    document.getElementById('create-password-form').style.display = 'none';
});

document.querySelectorAll('.back-to-login').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('forgot-password-forms').style.display = 'none';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
    });
});

document.getElementById('request-otp-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const identifier = document.getElementById('forgot-identifier').value;
    const errorEl = document.getElementById('request-otp-error');
    errorEl.innerText = '';

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Sending...</span>';

    const data = await izadoApi.request('/auth/request-otp/', 'POST', { email: identifier });
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (data && !data.error) {
        showToast(data.message);
        document.getElementById('request-otp-form').style.display = 'none';
        document.getElementById('verify-otp-form').style.display = 'block';
        startOtpTimer(120); // 2 minutes countdown
    } else {
        errorEl.innerText = data?.error || 'Failed to request OTP.';
    }
});

document.getElementById('verify-otp-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const identifier = document.getElementById('forgot-identifier').value;
    const otp = document.getElementById('verify-otp-code').value;
    const errorEl = document.getElementById('verify-otp-error');
    errorEl.innerText = '';

    const data = await izadoApi.request('/auth/verify-otp/', 'POST', { email: identifier, otp });
    
    if (data && !data.error) {
        showToast(data.message);
        clearInterval(otpCountdown);
        document.getElementById('verify-otp-form').style.display = 'none';
        document.getElementById('create-password-form').style.display = 'block';
    } else {
        errorEl.innerText = data?.error || 'Invalid or expired OTP.';
    }
});

document.getElementById('create-password-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const identifier = document.getElementById('forgot-identifier').value;
    const otp = document.getElementById('verify-otp-code').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const errorEl = document.getElementById('create-password-error');
    errorEl.innerText = '';

    if (newPassword !== confirmPassword) {
        errorEl.innerText = 'Passwords do not match.';
        return;
    }

    const data = await izadoApi.request('/auth/reset-password/', 'POST', { email: identifier, otp, new_password: newPassword });
    
    if (data && !data.error) {
        showToast(data.message);
        document.getElementById('forgot-password-forms').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
        document.getElementById('create-password-form').reset();
        document.getElementById('verify-otp-form').reset();
        document.getElementById('request-otp-form').reset();
    } else {
        errorEl.innerText = data?.error || 'Failed to reset password.';
    }
});


// --- Dashboard Logic & Content Injection ---
async function bootstrapPortal() {
    document.getElementById('user-display').innerText = `Welcome, ${APP_STATE.user.username}`;
    document.getElementById('user-role-badge').innerText = APP_STATE.user.role;
    
    const empSidebarBtn = document.getElementById('sidebar-employees');
    if (APP_STATE.user.role === 'ADMIN') {
        empSidebarBtn.style.display = 'flex';
    } else {
        empSidebarBtn.style.display = 'none';
    }

    const statusPill = document.getElementById('server-status-pill');
    if (statusPill) {
        statusPill.style.display = (APP_STATE.user.role === 'ADMIN') ? 'flex' : 'none';
    }
    
    showScreen('dashboard');
    showPanel('complaints');
    
    syncCategoryDropdown();
    refreshComplaintsList();
}

async function syncCategoryDropdown() {
    APP_STATE.categories = await izadoApi.request('/categories/');
    const list = document.getElementById('comp-category-options');
    const text = document.getElementById('comp-category-text');
    const hiddenInput = document.getElementById('comp-category');

    if (APP_STATE.categories && list) {
        list.innerHTML = APP_STATE.categories.map(c => `
            <div class="premium-option" data-value="${c.id}">${c.name}</div>
        `).join('');

        // Default visual selection
        if (APP_STATE.categories.length > 0) {
            const first = list.querySelector('.premium-option');
            if (first) {
                hiddenInput.value = first.dataset.value;
                text.innerText = first.innerText;
                first.classList.add('selected');
            }
        }
    }
}

function setupCustomComponents() {
    // Generic logic for all premium dropdowns using event delegation
    document.querySelectorAll('.premium-dropdown').forEach(dropdown => {
        const trigger = dropdown.querySelector('.premium-trigger');
        const list = dropdown.querySelector('.premium-options');
        const textDisplay = trigger.querySelector('span'); 
        const hiddenInputId = dropdown.id.replace('-dropdown', '');
        const hiddenInput = document.getElementById(hiddenInputId);

        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.premium-dropdown').forEach(d => {
                if(d !== dropdown) {
                    d.classList.remove('active');
                    d.querySelector('.premium-options')?.classList.remove('active');
                }
            });
            dropdown.classList.toggle('active');
            list?.classList.toggle('active');
        });

        // Use event delegation for options (handles dynamic items)
        list?.addEventListener('click', (e) => {
            const opt = e.target.closest('.premium-option');
            if (!opt) return;
            e.stopPropagation();

            if (hiddenInput) {
                hiddenInput.value = opt.dataset.value;
                hiddenInput.dispatchEvent(new Event('change'));
            }
            if (textDisplay) textDisplay.innerText = opt.innerText;
            
            dropdown.classList.remove('active');
            list.classList.remove('active');
            list.querySelectorAll('.premium-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.premium-dropdown').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.premium-options').forEach(l => l.classList.remove('active'));
    });

    // Priority Selection (Pills)
    const priorityBtns = document.querySelectorAll('.priority-btn');
    const priorityHidden = document.getElementById('comp-priority');
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            priorityBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (priorityHidden) priorityHidden.value = btn.dataset.value;
        });
    });
}

async function refreshComplaintsList() {
    const list = document.getElementById('complaints-list');
    list.innerHTML = '<div class="loader">Querying Complaint Database...</div>';
    
    const filterStatus = document.getElementById('filter-status').value;
    let url = '/complaints/';
    if (filterStatus) url += `?status=${filterStatus}`;
    
    const data = await izadoApi.request(url);
    
    if (data === null) {
        list.innerHTML = '<div class="loader" style="color: #ff6666;">Unable to sync with Izado Database. Check server status.</div>';
        return;
    }

    APP_STATE.complaints = data;
    
    if (APP_STATE.complaints.length === 0) {
        list.innerHTML = '<div class="loader">No complaints found in this category.</div>';
        return;
    }

    list.innerHTML = APP_STATE.complaints.map(generateComplaintHTML).join('');
    refreshIcons();
}

async function refreshEmployeesList() {
    const list = document.getElementById('employees-list');
    list.innerHTML = '<div class="loader">Querying Users Database...</div>';
    
    if (APP_STATE.user.role !== 'ADMIN') return;
    
    const users = await izadoApi.request('/users/');
    if (!users) {
        list.innerHTML = '<div class="error-msg">Failed to load employees.</div>';
        return;
    }
    
    if (users.length === 0) {
        list.innerHTML = '<p class="text-muted">No employees registered yet.</p>';
        return;
    }
    
    list.innerHTML = users.map(u => `
        <div class="glass-panel employee-card">
            <div class="employee-info">
                <div class="employee-avatar">${u.username.charAt(0).toUpperCase()}</div>
                <div class="employee-details">
                    <h4>${u.username}</h4>
                    <p style="text-transform: capitalize;">${u.role.toLowerCase()}</p>
                </div>
            </div>
            <div class="employee-actions">
                <button class="btn-delete" title="Remove Employee" onclick="deleteEmployee(${u.id}, '${u.username}')">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    refreshIcons();
}

async function deleteEmployee(id, username) {
    if (username === APP_STATE.user.username) {
        showToast("Error: You cannot delete your own account.");
        return;
    }

    if (!confirm(`Are you sure you want to permanently remove employee '${username}'?`)) return;

    const result = await izadoApi.request(`/users/${id}/`, 'DELETE');
    if (result) {
        showToast(`Employee '${username}' has been removed.`);
        refreshEmployeesList();
    } else {
        showToast("Failed to remove employee. Check connectivity or permissions.");
    }
}

// Global scope mapping
window.deleteEmployee = deleteEmployee;

function generateComplaintHTML(c) {
    const date = new Date(c.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const statusClass = c.status.toLowerCase().replace(' ', '-');
    const priorityClass = c.priority.toLowerCase();
    const posterName = c.is_anonymous ? 'Anonymous Employee' : c.user_name;

    return `
        <div class="glass-panel complaint-card" onclick="openComplaintDetail(${c.id})">
            <div class="priority-tab priority-${priorityClass}"></div>
            <div class="card-header">
                <span class="badge ${statusClass}">
                    <i data-lucide="circle-dot"></i> ${c.status}
                </span>
                <span class="text-muted">${date}</span>
            </div>
            <div class="card-content">
                <h3>${c.title}</h3>
                <p>${c.description}</p>
            </div>
            <div class="card-footer">
                <div class="footer-item"><i data-lucide="user" class="sm-icon"></i> ${posterName}</div>
                <div class="footer-item"><i data-lucide="hash" class="sm-icon"></i> ID-${c.id}</div>
            </div>
        </div>
    `;
}

// --- Detail Context Controller ---
async function openComplaintDetail(id) {
    const c = await izadoApi.request(`/complaints/${id}/`);
    if (!c) return;
    APP_STATE.activeComplaint = c;
    
    document.getElementById('detail-title').innerText = c.title;
    document.getElementById('detail-body').innerText = c.description;
    
    const badge = document.getElementById('detail-status-badge');
    badge.innerText = c.status;
    badge.className = `badge ${c.status.toLowerCase().replace(' ', '-')}`;
    
    const poster = c.is_anonymous ? 'Anonymous Employee' : c.user_name;
    document.getElementById('detail-meta').innerHTML = `
        <div class="meta-item"><i data-lucide="user"></i> ${poster}</div>
        <div class="meta-item"><i data-lucide="tag"></i> ${c.category_name}</div>
        <div class="meta-item"><i data-lucide="zap"></i> Priority: ${c.priority}</div>
        <div class="meta-item"><i data-lucide="calendar"></i> Submitted: ${new Date(c.created_at).toLocaleDateString()}</div>
    `;

    // Access Resolution Controls for Admins Only
    const adminActions = document.getElementById('manager-actions');
    adminActions.style.display = (APP_STATE.user.role === 'ADMIN') ? 'block' : 'none';

    showPanel('detail');
    refreshResponsesList(id);
}

async function refreshResponsesList(complaintId) {
    const responses = await izadoApi.request(`/responses/?complaint=${complaintId}`);
    const list = document.getElementById('responses-list');
    
    if (!responses || responses.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center; padding:2rem;">No responses recorded yet.</p>';
        return;
    }

    list.innerHTML = responses.map(r => `
        <div class="response-item">
            <div class="response-header">
                <span>${r.user_name} • ${r.user_role}</span>
                <span>${new Date(r.created_at).toLocaleTimeString()}</span>
            </div>
            <div class="response-body">${r.message}</div>
        </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
}

// --- User Interaction Handlers ---
async function changeComplaintStatus(newStatus) {
    if (!APP_STATE.activeComplaint) return;
    const result = await izadoApi.request(`/complaints/${APP_STATE.activeComplaint.id}/update_status/`, 'PATCH', { status: newStatus });
    if (result) {
        showToast(`Complaint [ID-${APP_STATE.activeComplaint.id}] set to ${newStatus}.`);
        openComplaintDetail(APP_STATE.activeComplaint.id);
        refreshComplaintsList();
    }
}

// Global scope mapping for onclick attributes
window.updateStatus = changeComplaintStatus;

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- Global Event Listener Bindings ---
document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    login(document.getElementById('username').value, document.getElementById('password').value);
});

document.getElementById('show-signup-btn').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'flex';
});

document.getElementById('show-login-btn').addEventListener('click', () => {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
});

document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const signupError = document.getElementById('signup-error');
    signupError.innerText = '';
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value;
    
    const data = await izadoApi.request('/auth/register/', 'POST', { username, password, email, role: 'EMPLOYEE' });
    if (data && !data.error) {
        showToast('Registration successful! Please sign in.');
        document.getElementById('signup-form').reset();
        document.getElementById('show-login-btn').click();
    } else {
        signupError.innerText = data?.error || 'Registration failed. Username may already exist.';
    }
});

document.getElementById('logout-btn').addEventListener('click', logout);

document.getElementById('sidebar-complaints').addEventListener('click', () => {
    showPanel('complaints');
    refreshComplaintsList();
});

document.getElementById('sidebar-submit').addEventListener('click', () => showPanel('submit'));
document.getElementById('sidebar-employees').addEventListener('click', () => {
    showPanel('employees');
    refreshEmployeesList();
});
document.getElementById('back-to-list').addEventListener('click', () => showPanel('complaints'));

document.getElementById('add-employee-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('emp-username').value;
    const password = document.getElementById('emp-password').value;
    const email = document.getElementById('emp-email').value;
    
    // API registration call for Admin
    const data = await izadoApi.request('/auth/register/', 'POST', { username, password, email, role: 'EMPLOYEE' });
    if (data && !data.error) {
        showToast(`Employee ${username} registered successfully.`);
        e.target.reset();
        refreshEmployeesList();
    } else {
        showToast(data?.error || 'Registration failed. Username may already exist.');
    }
});

document.getElementById('upload-employees-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fileInput = document.getElementById('emp-spreadsheet');
    const reportBox = document.getElementById('bulk-upload-report');
    const reportContent = reportBox.querySelector('.report-content');
    
    if (!fileInput.files.length) return;
    
    const file = fileInput.files[0];
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<span>Processing...</span><i data-lucide="loader" class="spin"></i>';
    btn.disabled = true;
    reportBox.style.display = 'none';
    refreshIcons();
    
    const formData = new FormData();
    formData.append('file', file);

    const data = await izadoApi.request('/auth/bulk-register/', 'POST', formData);
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    refreshIcons();

    if (data && !data.error) {
        showToast(data.message);
        e.target.reset();
        
        // Render Report
        reportBox.style.display = 'block';
        let reportHTML = `<p style="color: var(--green-400); font-weight: bold; margin-bottom: 0.5rem;">Registration Summary:</p>`;
        reportHTML += `<p>• Successfully created: ${data.success_count}</p>`;
        
        if (data.failed_entries && data.failed_entries.length > 0) {
            reportHTML += `<p style="color: #f87171; margin-top: 1rem; font-weight: bold;">Failures / Skipped:</p>`;
            reportHTML += `<ul style="list-style: none; padding: 0.5rem 0;">`;
            data.failed_entries.forEach(entry => {
                reportHTML += `<li style="margin-bottom: 0.3rem;">⚠️ <b>${entry.username}:</b> ${entry.reason}</li>`;
            });
            reportHTML += `</ul>`;
        } else {
            reportHTML += `<p style="color: var(--green-300); margin-top: 0.5rem;">✅ All entries processed successfully.</p>`;
        }
        
        reportContent.innerHTML = reportHTML;
        refreshEmployeesList();
    } else {
        showToast(data?.error || 'Bulk registration failed.');
    }
});

document.getElementById('refresh-emp-btn')?.addEventListener('click', refreshEmployeesList);

document.getElementById('submission-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('comp-title').value,
        category: document.getElementById('comp-category').value,
        priority: document.getElementById('comp-priority').value,
        description: document.getElementById('comp-description').value,
        is_anonymous: document.getElementById('comp-anonymous').checked
    };
    
    const result = await izadoApi.request('/complaints/', 'POST', payload);
    if (result && result.id) {
        showToast('Complaint recorded successfully. Check your dashboard for updates.');
        e.target.reset();
        showPanel('complaints');
        refreshComplaintsList();
    }
});

document.getElementById('response-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msgInput = document.getElementById('response-message');
    const payload = {
        complaint: APP_STATE.activeComplaint.id,
        message: msgInput.value
    };
    
    const result = await izadoApi.request('/responses/', 'POST', payload);
    if (result && result.id) {
        msgInput.value = '';
        refreshResponsesList(APP_STATE.activeComplaint.id);
    }
});

document.getElementById('filter-status').addEventListener('change', refreshComplaintsList);

async function checkServerHealth() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    try {
        const response = await fetch(`${API_BASE}/categories/`, { method: 'GET' });
        if (response.ok || response.status === 401) {
            dot.style.background = '#4ade80';
            dot.style.boxShadow = '0 0 10px #4ade80';
            text.innerText = 'Backend: Online';
        } else {
            throw new Error();
        }
    } catch (e) {
        dot.style.background = '#ff4444';
        dot.style.boxShadow = '0 0 10px #ff4444';
        text.innerText = 'Backend: Offline';
    }
    setTimeout(checkServerHealth, 3000);
}

window.onload = () => {
    tryAutoLogin();
    setupCustomComponents();
    checkServerHealth();
};

// --- Mouse Element Tracking for Premium Glow Effects ---
document.addEventListener('mousemove', e => {
    // Global tracking
    document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    
    // Element specific tracking for buttons and cards
    document.querySelectorAll('.glass-panel, .btn-primary, .nav-item').forEach(el => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
    });
});

