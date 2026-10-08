// Core Application Controller for RepFlow Multi-Tenant SaaS
const RepFlowApp = (() => {
  let activeRole = 'MR';
  let activeTenantId = 1;
  let activeUser = { id: 5, name: 'Rahul Sharma', role: 'MR', reportingManager: 'Vikram Singh (AM)' };
  let allTenantsCache = [];
  let currentTenantUsersCache = [];
  let doctorMasterCache = [];
  let chemistMasterCache = [];
  let distributorMasterCache = [];
  let currentSampleBagCache = [];
  let activeAreaWorked = 'Saket';
  let lastCreatedTenantInfo = null;

  // E-Detailing Slide Deck State
  let edetailingSlides = [
    { id: 1, title: 'Cardia-90 Phase-III Clinical Trial Results', subtitle: '38% Reduction in Major Adverse Cardiovascular Events (MACE)', highlight: 'P < 0.001 Significance' },
    { id: 2, title: 'Superior Pharmacokinetics & Bioavailability', subtitle: 'Peak Plasma Concentration achieved in 1.2 Hours with 24-hr Coverage', highlight: 'Once Daily Dosage' },
    { id: 3, title: 'Glicla-M SR Dual Action Glycemic Control', subtitle: 'Mean HbA1c Reduction of 1.6% across 12-week trials', highlight: 'Sustained Release' }
  ];
  let currentSlideIndex = 0;
  let slideTimerInterval = null;
  let slideSeconds = 0;

  let activeImpersonation = null;

  const PERSONA_CONFIG = {
    MR: { id: 5, name: 'Rahul Sharma', role: 'MR', manager: 'Vikram Singh (AM)', tabs: ['mr-dashboard', 'dcr', 'edetailing', 'mtp', 'master', 'expenses', 'leaves', 'sample-bag', 'gifts', 'analytics'] },
    AM: { id: 4, name: 'Vikram Singh', role: 'AM', manager: 'Anita Sharma (RM)', tabs: ['am-dashboard', 'team-hierarchy', 'expenses', 'leaves', 'academic-roi', 'master'] },
    RM: { id: 3, name: 'Anita Sharma', role: 'RM', manager: 'Ramesh Gupta (ZSM)', tabs: ['rm-portal', 'team-hierarchy', 'academic-roi', 'expenses', 'leaves', 'master'] },
    ZSM: { id: 2, name: 'Ramesh Gupta', role: 'ZSM', manager: 'Priya Mehta (HO)', tabs: ['zsm-portal', 'team-hierarchy', 'ho-yield-analytics', 'academic-roi', 'master'] },
    HO: { id: 1, name: 'Priya Mehta', role: 'HO', manager: 'Chief Executive Officer', tabs: ['tenant-admin-territories', 'tenant-admin-hcp', 'tenant-admin-products', 'tenant-admin-governance', 'tenant-admin-reports', 'team-hierarchy', 'ho-yield-analytics', 'academic-roi'] },
    SUPERADMIN: { id: 99, name: 'SaaS Platform Admin', role: 'SUPERADMIN', manager: 'RepFlow Global Admin', tabs: ['system-admin-tenants', 'system-admin-licenses', 'system-admin-templates', 'system-admin-infrastructure', 'tenant-admin-territories', 'tenant-admin-hcp', 'tenant-admin-products', 'tenant-admin-governance', 'tenant-admin-reports'] }
  };

  const TAB_LABELS = {
    // System Admin Control Panel (/system-admin)
    'system-admin-tenants': '🛡️ System Admin: Tenants',
    'system-admin-licenses': '🔑 System Admin: Licensing & Flags',
    'system-admin-templates': '📋 System Admin: Templates',
    'system-admin-infrastructure': '⚡ System Admin: Infrastructure & Logs',

    // Company Admin Control Panel (/tenant-admin)
    'tenant-admin-territories': '🏢 Company Admin: Hierarchy & Territories',
    'tenant-admin-hcp': '👨‍⚕️ Company Admin: HCP Doctor Master',
    'tenant-admin-products': '💊 Company Admin: Product SKU & CLM',
    'tenant-admin-governance': '⚖️ Company Admin: Field Governance',
    'tenant-admin-reports': '📊 Company Admin: Analytics & Reports',

    // Field Operations & Manager Desks
    'team-hierarchy': '👥 Team & Hierarchy',
    'mr-dashboard': '📊 MR Dashboard',
    'dcr': '📝 DCR Log',
    'edetailing': '🖥️ E-Detailing Visual Aide',
    'mtp': '🗓️ MTP Calendar',
    'master': '🏥 Master Directory',
    'expenses': '💰 Expenses',
    'leaves': '🌴 Leaves',
    'sample-bag': '🎒 Sample Bag',
    'gifts': '🎁 Gift Ledger',
    'analytics': '📈 Target vs Sales',
    'academic-roi': '🔬 Academic RoI',
    'am-dashboard': '👥 AM Team & Field Desk',
    'rm-portal': '👔 RM Regional Portal',
    'zsm-portal': '🏆 ZSM Zonal Portal',
    'ho-yield-analytics': '📊 HO Yield Analytics',
    'ho-dashboard': '🏢 HO Master Admin',
    'superadmin': '⚡ Legacy Super-Admin'
  };

  async function init() {
    console.log('[RepFlowApp] Initializing RepFlow SaaS Engine...');
    setupEventListeners();
    await loadTenantsList();
    await loadInitialData();
    switchPersona('MR');
  }

  function setupEventListeners() {
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
  }

  function updateNetworkStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const offlineToggleBtn = document.getElementById('offlineToggleBtn');

    if (navigator.onLine) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.innerText = 'Online';
      if (offlineToggleBtn) offlineToggleBtn.style.background = '';
    } else {
      if (statusDot) statusDot.className = 'status-dot offline';
      if (statusText) statusText.innerText = 'Offline Mode Active';
      if (offlineToggleBtn) offlineToggleBtn.style.background = 'var(--accent-rose)';
    }
  }

  function toggleOfflineSim() {
    const isOffline = document.getElementById('statusDot').classList.contains('offline');
    if (isOffline) {
      document.getElementById('statusDot').className = 'status-dot';
      document.getElementById('statusText').innerText = 'Online';
      showToast('⚡ Simulating Online Mode. Data ready to sync.', 'info');
    } else {
      document.getElementById('statusDot').className = 'status-dot offline';
      document.getElementById('statusText').innerText = 'Offline (Simulated)';
      showToast('⚡ Simulating Offline Mode. Edits saved to IndexedDB.', 'warning');
    }
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('show');
      m.classList.add('active');
      m.style.display = 'flex';
      m.style.opacity = '1';
      m.style.pointerEvents = 'auto';
    }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('show');
      m.classList.remove('active');
      m.style.display = 'none';
      m.style.opacity = '0';
      m.style.pointerEvents = 'none';
    }
  }

  // -------------------------------------------------------------
  // Dynamic Tenant Organization Selector & Switcher
  // -------------------------------------------------------------
  async function loadTenantsList() {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        allTenantsCache = await res.json();
        const select = document.getElementById('tenantSelect');
        if (select && allTenantsCache.length > 0) {
          select.innerHTML = allTenantsCache.map(t => `
            <option value="${t.id}" ${t.id === activeTenantId ? 'selected' : ''}>${t.company_name}</option>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenants list', e);
    }
  }

  async function switchTenant(tenantId) {
    activeTenantId = parseInt(tenantId);
    const tenantObj = allTenantsCache.find(t => t.id === activeTenantId);
    const tenantName = tenantObj ? tenantObj.company_name : `Pharma Tenant #${tenantId}`;

    const orgLabel = document.getElementById('hierarchyOrgName');
    if (orgLabel) orgLabel.innerText = tenantName;

    document.title = `${tenantName} - RepFlow PWA Field Force OS`;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', activeTenantId === 1 ? '#070f1e' : '#0f2b48');

    showToast(`🏢 Switched active Pharma Tenant to: "${tenantName}"`, 'info');
    await loadInitialData();
    refreshActiveTabData();
  }

  function switchPersona(role) {
    activeRole = role;
    const config = PERSONA_CONFIG[role];
    activeUser = { id: config.id, name: config.name, role: config.role, reportingManager: config.manager };

    const userBadge = document.getElementById('sidebarUserRoleName');
    if (userBadge) userBadge.innerText = `${config.name} (${role})`;

    renderNavTabs(config.tabs);
    navigateToTab(config.tabs[0]);
    refreshActiveTabData();

    showToast(`Switched active persona to ${config.name} (${role})`, 'info');
  }

  function renderNavTabs(tabs) {
    const container = document.getElementById('navTabs');
    if (!container) return;
    container.innerHTML = tabs.map(t => `
      <button class="sidebar-item nav-tab ${t === tabs[0] ? 'active' : ''}" data-tab="${t}" onclick="RepFlowApp.navigateToTab('${t}')">
        <span class="sidebar-item-text">${TAB_LABELS[t] || t}</span>
      </button>
    `).join('');
  }

  function toggleSidebarCollapse() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('mobile-open');
  }

  function navigateToTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `tab-${tabId}`);
    });

    // System Admin Control Panel Tabs
    if (tabId === 'system-admin-tenants') loadSystemAdminTenants();
    if (tabId === 'system-admin-licenses') loadSystemAdminLicenses();
    if (tabId === 'system-admin-templates') loadSystemAdminTemplates();
    if (tabId === 'system-admin-infrastructure') loadSystemAdminInfrastructure();

    // Company Admin Control Panel Tabs
    if (tabId === 'tenant-admin-territories') loadTenantAdminTerritories();
    if (tabId === 'tenant-admin-hcp') loadTenantAdminHcp();
    if (tabId === 'tenant-admin-products') loadTenantAdminProducts();
    if (tabId === 'tenant-admin-governance') loadTenantAdminGovernance();
    if (tabId === 'tenant-admin-reports') loadTenantAdminReports();

    if (tabId === 'team-hierarchy') loadTeamHierarchyData();
    if (tabId === 'dcr') renderDcrForm();
    if (tabId === 'mtp') renderMtpCalendar();
    if (tabId === 'master') loadDoctorsAndChemists();
    if (tabId === 'expenses') loadExpenses();
    if (tabId === 'leaves') loadLeaves();
    if (tabId === 'sample-bag') loadSampleBag();
    if (tabId === 'gifts') loadGifts();
    if (tabId === 'analytics') loadSalesAnalytics();
    if (tabId === 'academic-roi') loadAcademicRoi();
    if (tabId === 'rm-portal') loadRmPortalData();
    if (tabId === 'zsm-portal') loadZsmPortalData();
    if (tabId === 'ho-yield-analytics') loadHoYieldAnalytics();
    if (tabId === 'superadmin') loadSuperAdminData();
  }

  async function loadInitialData() {
    try {
      const docRes = await fetch(`/api/doctors?area_name=${activeAreaWorked}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      if (docRes.ok) doctorMasterCache = await docRes.json();

      const chemRes = await fetch('/api/chemists', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (chemRes.ok) chemistMasterCache = await chemRes.json();

      const distRes = await fetch('/api/distributors', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (distRes.ok) distributorMasterCache = await distRes.json();

      const usersRes = await fetch('/api/users', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (usersRes.ok) currentTenantUsersCache = await usersRes.json();
    } catch (e) {
      console.warn('Initial data load falling back to IndexedDB cache.');
    }
  }

  function refreshActiveTabData() {
    loadTeamHierarchyData();
    loadSampleBag();
    loadLeaves();
  }

  // -------------------------------------------------------------
  // Super Admin Onboarding Modal & Tenant Admin Generation
  // -------------------------------------------------------------
  function autoFillAdminCredentials(companyName) {
    if (!companyName) return;
    const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const slugInput = document.getElementById('tenantSlug');
    const adminNameInput = document.getElementById('tenantAdminName');
    const adminEmailInput = document.getElementById('tenantAdminEmail');
    const adminPassInput = document.getElementById('tenantAdminPassword');

    if (slugInput) slugInput.value = baseSlug;
    if (adminNameInput && !adminNameInput.value) adminNameInput.value = `${companyName} Head Office`;
    if (adminEmailInput) adminEmailInput.value = `admin@${baseSlug || 'pharma'}.com`;
    if (adminPassInput && adminPassInput.value === 'Uniexcel@2026') {
      const cleanPrefix = baseSlug.split('-')[0] || 'Pharma';
      const capPrefix = cleanPrefix.charAt(0).toUpperCase() + cleanPrefix.slice(1);
      adminPassInput.value = `${capPrefix}@2026`;
    }
  }

  function openOnboardTenantModal() {
    const name = document.getElementById('tenantCompanyName');
    const slug = document.getElementById('tenantSlug');
    if (name) name.value = '';
    if (slug) slug.value = '';
    openModal('onboardTenantModal');
  }

  function closeOnboardTenantModal() {
    closeModal('onboardTenantModal');
  }

  async function handleOnboardTenantSubmit(e) {
    e.preventDefault();
    const companyName = document.getElementById('tenantCompanyName').value;
    const slug = document.getElementById('tenantSlug').value;
    const planTier = document.getElementById('tenantPlanTier').value;
    const monthlyPrice = document.getElementById('tenantMonthlyPrice').value;
    const maxMr = document.getElementById('tenantMaxMrSeats').value;
    const maxAm = document.getElementById('tenantMaxAmSeats').value;
    const adminName = document.getElementById('tenantAdminName').value;
    const adminEmail = document.getElementById('tenantAdminEmail').value;
    const adminPassword = document.getElementById('tenantAdminPassword').value;

    try {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          slug: slug,
          plan_tier: planTier,
          monthly_price: parseFloat(monthlyPrice),
          max_mr_seats: parseInt(maxMr),
          max_am_seats: parseInt(maxAm),
          admin_name: adminName,
          admin_email: adminEmail,
          admin_password: adminPassword
        })
      });

      if (res.ok) {
        const data = await res.json();
        lastCreatedTenantInfo = data;
        closeOnboardTenantModal();
        await loadTenantsList();
        loadSuperAdminData();

        // Show Confirmation Modal with Generated Credentials
        document.getElementById('createdTenantName').innerText = data.company_name;
        document.getElementById('createdTenantId').innerText = `#${data.tenant_id}`;
        document.getElementById('createdAdminName').innerText = data.admin_name;
        document.getElementById('createdAdminEmail').innerText = data.admin_email;
        document.getElementById('createdAdminPassword').innerText = data.admin_password;
        openModal('tenantCreatedSuccessModal');
      } else {
        const err = await res.json();
        showToast(`Error onboarding tenant: ${err.error}`, 'danger');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'danger');
    }
  }

  function closeTenantSuccessModal() {
    closeModal('tenantCreatedSuccessModal');
  }

  async function switchAndManageCreatedTenant() {
    closeTenantSuccessModal();
    if (lastCreatedTenantInfo) {
      await switchTenant(lastCreatedTenantInfo.tenant_id);
      const select = document.getElementById('tenantSelect');
      if (select) select.value = lastCreatedTenantInfo.tenant_id;
      switchPersona('HO');
      navigateToTab('team-hierarchy');
    }
  }

  async function loadSuperAdminData() {
    try {
      const res = await fetch('/api/superadmin/tenants');
      const tenants = await res.json();

      const tbody = document.getElementById('superadminTableBody');
      if (tbody) {
        tbody.innerHTML = tenants.map(t => `
          <tr>
            <td><strong>${t.company_name}</strong></td>
            <td><code>${t.slug}</code></td>
            <td><span class="tag-badge" style="background:var(--accent-teal); color:#04101e;">${t.plan_tier || 'ENTERPRISE'}</span></td>
            <td>${t.max_mr_seats || 50} Seats</td>
            <td>${t.max_am_seats || 10} Seats</td>
            <td style="font-weight:700; color:var(--accent-emerald);">₹${(t.monthly_price || 49999).toLocaleString()}/mo</td>
            <td><span class="tag-badge" style="background:var(--accent-emerald); color:#04101e;">ACTIVE</span></td>
            <td>
              <button class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="RepFlowApp.switchTenant(${t.id}); RepFlowApp.navigateToTab('team-hierarchy');">Manage Team 👥</button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading super-admin data', e);
    }
  }

  // -------------------------------------------------------------
  // Team & Organizational Hierarchy Management
  // -------------------------------------------------------------
  async function loadTeamHierarchyData() {
    try {
      const res = await fetch('/api/users', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (res.ok) {
        currentTenantUsersCache = await res.json();

        // Update counts
        const hoCount = currentTenantUsersCache.filter(u => u.role === 'HO' || u.role === 'SUPERADMIN').length;
        const srCount = currentTenantUsersCache.filter(u => u.role === 'ZSM' || u.role === 'RM').length;
        const amCount = currentTenantUsersCache.filter(u => u.role === 'AM').length;
        const mrCount = currentTenantUsersCache.filter(u => u.role === 'MR').length;

        const hoEl = document.getElementById('countHoUsers');
        const srEl = document.getElementById('countSeniorManagers');
        const amEl = document.getElementById('countAmUsers');
        const mrEl = document.getElementById('countMrUsers');
        if (hoEl) hoEl.innerText = `${hoCount} Admin`;
        if (srEl) srEl.innerText = `${srCount} Active`;
        if (amEl) amEl.innerText = `${amCount} Active`;
        if (mrEl) mrEl.innerText = `${mrCount} Active`;

        const tbody = document.getElementById('teamHierarchyTableBody');
        if (tbody) {
          if (currentTenantUsersCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:24px;">No team members created yet. Click <strong>+ Add New Team Member</strong> to build your organization hierarchy.</td></tr>`;
          } else {
            tbody.innerHTML = currentTenantUsersCache.map(u => {
              const roleColors = {
                HO: 'background:var(--accent-teal); color:#04101e;',
                ZSM: 'background:var(--accent-blue); color:white;',
                RM: 'background:var(--accent-emerald); color:#04101e;',
                AM: 'background:var(--accent-amber); color:#04101e;',
                MR: 'background:rgba(255,255,255,0.15); color:white;',
                SUPERADMIN: 'background:var(--accent-rose); color:white;'
              };

              const mgrText = u.reporting_manager_name 
                ? `<strong>${u.reporting_manager_name}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${u.reporting_manager_role})</span>`
                : `<span style="color:var(--text-dim);">Top Level / None</span>`;

              return `
                <tr>
                  <td><strong>#${u.id}</strong></td>
                  <td><strong>${u.name}</strong></td>
                  <td><code>${u.email}</code></td>
                  <td><span style="font-family:monospace; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">${u.password || 'repflow@123'}</span></td>
                  <td><span class="tag-badge" style="${roleColors[u.role] || ''}">${u.role}</span></td>
                  <td>${mgrText}</td>
                  <td><span class="tag-badge" style="background:var(--bg-input);">${u.territory_code || 'HQ'}</span></td>
                  <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <button class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="RepFlowApp.impersonateUser(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}', '${u.role}')">Login As 👤</button>
                      <button class="btn btn-secondary" style="padding:2px 6px; font-size:0.75rem; color:var(--accent-rose); border-color:rgba(239,68,68,0.3);" onclick="RepFlowApp.deleteTeamMember(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}')" title="Remove Member">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('');
          }
        }
      }
    } catch (e) {
      console.warn('Failed loading team hierarchy data', e);
    }
  }

  function impersonateUser(userId, userName, userRole) {
    activeUser = { id: userId, name: userName, role: userRole, reportingManager: '' };
    switchPersona(userRole);
    showToast(`👤 Now viewing RepFlow as ${userName} (${userRole})`, 'info');
  }

  function openCreateTeamMemberModal() {
    const nameInput = document.getElementById('teamUserName');
    const emailInput = document.getElementById('teamUserEmail');
    const passInput = document.getElementById('teamUserPassword');
    const terrInput = document.getElementById('teamUserTerritory');
    const roleSelect = document.getElementById('teamUserRole');
    
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = 'Uniexcel@123';
    if (terrInput) terrInput.value = '';
    
    // Smart default role suggestion: if only HO exists, default to ZSM, then RM, AM, MR
    if (roleSelect && currentTenantUsersCache) {
      const hasZsm = currentTenantUsersCache.some(u => u.role === 'ZSM');
      const hasRm = currentTenantUsersCache.some(u => u.role === 'RM');
      const hasAm = currentTenantUsersCache.some(u => u.role === 'AM');
      if (!hasZsm) roleSelect.value = 'ZSM';
      else if (!hasRm) roleSelect.value = 'RM';
      else if (!hasAm) roleSelect.value = 'AM';
      else roleSelect.value = 'MR';
      handleRoleChangeForManagers(roleSelect.value);
    } else {
      handleRoleChangeForManagers('MR');
    }
    openModal('createTeamMemberModal');
  }

  function closeCreateTeamMemberModal() {
    closeModal('createTeamMemberModal');
  }

  async function deleteTeamMember(userId, name) {
    if (!confirm(`Are you sure you want to remove team member "${name}"?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': activeTenantId }
      });
      if (res.ok) {
        showToast(`🗑️ Removed ${name} from organizational hierarchy`, 'info');
        await loadTeamHierarchyData();
      } else {
        const err = await res.json();
        showToast(`Error deleting member: ${err.error}`, 'danger');
      }
    } catch (e) {
      showToast('Network error removing member: ' + e.message, 'danger');
    }
  }

  function handleRoleChangeForManagers(selectedRole) {
    const mgrGroup = document.getElementById('reportingManagerGroup');
    const mgrSelect = document.getElementById('teamUserReportingManager');
    if (!mgrSelect) return;

    let eligibleManagers = [];
    if (selectedRole === 'MR') {
      eligibleManagers = currentTenantUsersCache.filter(u => u.role === 'AM' || u.role === 'RM' || u.role === 'HO');
    } else if (selectedRole === 'AM') {
      eligibleManagers = currentTenantUsersCache.filter(u => u.role === 'RM' || u.role === 'ZSM' || u.role === 'HO');
    } else if (selectedRole === 'RM') {
      eligibleManagers = currentTenantUsersCache.filter(u => u.role === 'ZSM' || u.role === 'HO');
    } else if (selectedRole === 'ZSM') {
      eligibleManagers = currentTenantUsersCache.filter(u => u.role === 'HO');
    }

    if (eligibleManagers.length > 0) {
      mgrSelect.innerHTML = eligibleManagers.map(m => `
        <option value="${m.id}">${m.name} (${m.role} - ${m.territory_code || 'HQ'})</option>
      `).join('');
      if (mgrGroup) mgrGroup.style.display = 'block';
    } else {
      mgrSelect.innerHTML = `<option value="">None (Top Level Organization Admin)</option>`;
      if (mgrGroup) mgrGroup.style.display = selectedRole === 'HO' ? 'none' : 'block';
    }
  }

  async function handleCreateTeamMemberSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('teamUserName').value;
    const role = document.getElementById('teamUserRole').value;
    const email = document.getElementById('teamUserEmail').value;
    const password = document.getElementById('teamUserPassword').value;
    const managerId = document.getElementById('teamUserReportingManager').value;
    const territory = document.getElementById('teamUserTerritory').value;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({
          name,
          role,
          email,
          password,
          reporting_manager_id: managerId ? parseInt(managerId) : null,
          territory_code: territory
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`🎉 ${data.message}`, 'success');
        closeCreateTeamMemberModal();
        await loadTeamHierarchyData();
      } else {
        const err = await res.json();
        showToast(`Error creating member: ${err.error}`, 'danger');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'danger');
    }
  }

  // -------------------------------------------------------------
  // DCR Form & Area-Based Dynamic Doctor Filtering
  // -------------------------------------------------------------
  async function handleAreaWorkedChange(area) {
    activeAreaWorked = area;
    const label = document.getElementById('activeAreaLabel');
    if (label) label.innerText = area;

    try {
      const docRes = await fetch(`/api/doctors?area_name=${area}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      if (docRes.ok) {
        doctorMasterCache = await docRes.json();
        showToast(`📍 Dynamic Doctor List filtered for Area: ${area} (${doctorMasterCache.length} doctors found)`, 'info');
        renderDcrForm();
      }
    } catch (e) {
      console.warn('Failed filtering doctors by area', e);
    }
  }

  function handleStationTypeChange(station) {
    showToast(`Working Station set to ${station}. Daily Allowance adjusted automatically.`, 'info');
  }

  function renderDcrForm() {
    const dateInput = document.getElementById('dcrDate');
    if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
    const docContainer = document.getElementById('doctorCallsContainer');
    const chemContainer = document.getElementById('chemistCallsContainer');

    if (docContainer) docContainer.innerHTML = '';
    if (chemContainer) chemContainer.innerHTML = '';

    addDoctorCallEntry();
    addChemistCallEntry();
  }

  function addDoctorCallEntry() {
    const container = document.getElementById('doctorCallsContainer');
    if (!container) return;
    const index = container.children.length;
    const optionsHtml = doctorMasterCache.length > 0 
      ? doctorMasterCache.map(d => `<option value="${d.id}">${d.name} (${d.specialty} - ${d.category} | ${d.area_name || 'Saket'})</option>`).join('')
      : `<option value="1">Dr. Rajesh Verma (Cardiology - Superstar | Saket)</option>`;

    const entryDiv = document.createElement('div');
    entryDiv.className = 'call-entry-card';
    entryDiv.style.border = '1px solid var(--border-color)';
    entryDiv.style.padding = '16px';
    entryDiv.style.borderRadius = '12px';
    entryDiv.style.marginBottom = '16px';
    entryDiv.style.background = 'rgba(255,255,255,0.02)';

    entryDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <strong style="font-size:1rem; color:var(--accent-teal);">Doctor Visit #${index + 1}</strong>
          <span class="tag-badge" style="margin-left:8px; background:var(--accent-emerald); color:#04101e;">📍 GPS VERIFIED IN-CLINIC</span>
        </div>
        ${index > 0 ? `<button type="button" class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="this.closest('.call-entry-card').remove()">Remove</button>` : ''}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Select Doctor (Filtered for ${activeAreaWorked})</label>
          <select class="form-select doc-id-input">${optionsHtml}</select>
        </div>
        <div class="form-group">
          <label>Call Time</label>
          <input type="text" value="11:30 AM" class="form-control doc-time-input">
        </div>
      </div>

      <!-- Multi-Product Detailing Checkboxes -->
      <div class="form-group">
        <label style="color:var(--accent-teal);">Multi-Product Detailed (Check all products detailed during call)</label>
        <div style="display:flex; gap:16px; flex-wrap:wrap; background:var(--bg-input); padding:10px; border-radius:8px; border:1px solid var(--border-color);">
          <label style="font-size:0.85rem; cursor:pointer;"><input type="checkbox" class="doc-prod-cb" value="Cardia-90 10mg Catch Covers" checked> Cardia-90 10mg</label>
          <label style="font-size:0.85rem; cursor:pointer;"><input type="checkbox" class="doc-prod-cb" value="Glicla-M SR Starter Packs" checked> Glicla-M SR</label>
          <label style="font-size:0.85rem; cursor:pointer;"><input type="checkbox" class="doc-prod-cb" value="NeuroFlow-SR Visual Aides"> NeuroFlow-SR</label>
          <label style="font-size:0.85rem; cursor:pointer;"><input type="checkbox" class="doc-prod-cb" value="CalciMax-D3 Susp"> CalciMax-D3</label>
          <label style="font-size:0.85rem; cursor:pointer;"><input type="checkbox" class="doc-prod-cb" value="Amlodip-5 Tab"> Amlodip-5</label>
        </div>
      </div>

      <!-- Dynamic Multi-Product Samples & Gifts Distribution Rows -->
      <div style="margin-top:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="font-size:0.85rem; font-weight:700; color:var(--accent-amber);">Samples & Brand Recall Inputs Given (Auto-Deducted)</label>
          <button type="button" class="btn btn-secondary" style="padding:2px 8px; font-size:0.7rem;" onclick="RepFlowApp.addSampleRowToDocCall(this)">+ Add Input / Sample Row</button>
        </div>
        <div class="samples-list-container" style="display:flex; flex-direction:column; gap:8px;">
          <div class="sample-item-row" style="display:flex; gap:10px; align-items:center;">
            <select class="form-select sample-item-prod" style="flex:2;">
              <option value="Cardia-90 10mg Catch Covers">Cardia-90 10mg Catch Covers (Sample)</option>
              <option value="Glicla-M SR Starter Packs">Glicla-M SR Starter Packs (Sample)</option>
              <option value="Littmann Stethoscope">Littmann Stethoscope (Gift Input)</option>
              <option value="Cardiology Textbook">Cardiology Textbook (Gift Input)</option>
              <option value="NeuroFlow-SR Visual Aides">NeuroFlow-SR Visual Aides (Literature)</option>
            </select>
            <input type="number" class="form-control sample-item-qty" value="2" min="1" style="flex:1;" placeholder="Qty">
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-top:12px;">
        <label>Discussion Remarks & Clinical Feedback</label>
        <input type="text" placeholder="Detailed Cardia-90 Phase-III trial data with Dr. Verma..." class="form-control doc-remarks-input">
      </div>
    `;
    container.appendChild(entryDiv);
  }

  function addSampleRowToDocCall(btn) {
    const parentCard = btn.closest('.call-entry-card');
    const container = parentCard.querySelector('.samples-list-container');
    const row = document.createElement('div');
    row.className = 'sample-item-row';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <select class="form-select sample-item-prod" style="flex:2;">
        <option value="Cardia-90 10mg Catch Covers">Cardia-90 10mg Catch Covers (Sample)</option>
        <option value="Glicla-M SR Starter Packs">Glicla-M SR Starter Packs (Sample)</option>
        <option value="Littmann Stethoscope">Littmann Stethoscope (Gift Input)</option>
        <option value="Cardiology Textbook">Cardiology Textbook (Gift Input)</option>
        <option value="NeuroFlow-SR Visual Aides">NeuroFlow-SR Visual Aides (Literature)</option>
      </select>
      <input type="number" class="form-control sample-item-qty" value="1" min="1" style="flex:1;" placeholder="Qty">
      <button type="button" class="btn btn-secondary" style="padding:2px 6px; font-size:0.75rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  }

  function addChemistCallEntry() {
    const container = document.getElementById('chemistCallsContainer');
    if (!container) return;
    const index = container.children.length;
    const optionsHtml = chemistMasterCache.length > 0
      ? chemistMasterCache.map(c => `<option value="${c.id}">${c.name} (${c.territory_code})</option>`).join('')
      : `<option value="1">MedPlus Pharmacy GK-1</option>`;

    const entryDiv = document.createElement('div');
    entryDiv.className = 'call-entry-card';
    entryDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>Chemist Visit #${index + 1}</strong>
        ${index > 0 ? `<button type="button" class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="this.parentElement.parentElement.remove()">Remove</button>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Select Chemist</label>
          <select class="form-select chem-id-input">${optionsHtml}</select>
        </div>
        <div class="form-group">
          <label>POB Amount (₹)</label>
          <input type="number" value="4500" class="form-control chem-pob-input">
        </div>
      </div>
    `;
    container.appendChild(entryDiv);
  }

  function toggleJointWorking(val) {
    const el = document.getElementById('jointManagerGroup');
    if (el) el.style.display = val === 'JOINT' ? 'block' : 'none';
  }

  async function handleDcrSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('dcrDate').value;
    const stationType = document.getElementById('dcrStationType').value;
    const areaWorked = document.getElementById('dcrAreaWorked').value;
    const workingType = document.getElementById('dcrWorkingType').value;
    const jointRole = workingType === 'JOINT' ? document.getElementById('dcrJointRole').value : null;

    const doctorCalls = [];
    document.querySelectorAll('#doctorCallsContainer .call-entry-card').forEach(card => {
      const docId = card.querySelector('.doc-id-input').value;
      const time = card.querySelector('.doc-time-input').value;
      const remarks = card.querySelector('.doc-remarks-input').value;

      const prodsDetailed = [];
      card.querySelectorAll('.doc-prod-cb:checked').forEach(cb => prodsDetailed.push(cb.value));

      const samplesGiven = [];
      card.querySelectorAll('.sample-item-row').forEach(row => {
        const item = row.querySelector('.sample-item-prod').value;
        const qty = row.querySelector('.sample-item-qty').value;
        samplesGiven.push({ product: item, qty: parseInt(qty) });
      });

      doctorCalls.push({
        doctor_id: parseInt(docId),
        call_time: time,
        products_detailed: prodsDetailed,
        samples_given: samplesGiven,
        remarks: remarks,
        call_latitude: 28.5355,
        call_longitude: 77.2410
      });
    });

    const chemistCalls = [];
    document.querySelectorAll('#chemistCallsContainer .call-entry-card').forEach(card => {
      const chemId = card.querySelector('.chem-id-input').value;
      const pob = card.querySelector('.chem-pob-input').value;
      chemistCalls.push({ chemist_id: parseInt(chemId), pob_amount: parseFloat(pob) });
    });

    const payload = {
      mr_id: activeUser.id,
      date: date,
      working_type: workingType,
      station_type: stationType,
      area_worked: areaWorked,
      joint_working_role: jointRole,
      doctor_calls: doctorCalls,
      chemist_calls: chemistCalls
    };

    try {
      const isOffline = document.getElementById('statusDot').classList.contains('offline') || !navigator.onLine;
      if (isOffline) {
        await window.RepFlowDB.queueOfflineDCR(payload);
        showToast('💾 Offline Mode: DCR queued in IndexedDB for auto-sync.', 'warning');
      } else {
        const res = await fetch('/api/dcrs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('🚀 DCR submitted successfully with station info & multi-product stock auto-deduction!', 'success');
        }
      }
      navigateToTab('mr-dashboard');
      loadSampleBag();
    } catch (err) {
      showToast('Error submitting DCR: ' + err.message, 'danger');
    }
  }

  function printDcrPdf() {
    showToast('🖨️ Generating printable DCR Report PDF...', 'info');
    window.print();
  }

  function printMtpPdf() {
    showToast('🖨️ Generating printable MTP Tour Plan PDF...', 'info');
    window.print();
  }

  function printSalesReportPdf() {
    showToast('🖨️ Generating Target vs Sales Achievement PDF...', 'info');
    window.print();
  }

  // -------------------------------------------------------------
  // CME & Medical Camp Logger
  // -------------------------------------------------------------
  function openCmeCampModal() {
    const d = document.getElementById('cmeDate');
    if (d) d.value = new Date().toISOString().substring(0, 10);
    openModal('logCmeCampModal');
  }

  function closeCmeCampModal() {
    closeModal('logCmeCampModal');
  }

  async function handleCmeCampSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('cmeActivityType').value;
    const title = document.getElementById('cmeTitle').value;
    const venue = document.getElementById('cmeVenue').value;
    const date = document.getElementById('cmeDate').value;
    const count = document.getElementById('cmeDoctorCount').value;
    const exp = document.getElementById('cmeExpenseAmt').value;

    const res = await fetch('/api/dcrs/cme-camp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, activity_type: type, title, venue, date, doctor_count: parseInt(count), expense_amount: parseFloat(exp) })
    });

    if (res.ok) {
      showToast(`⛺ Logged ${type} activity "${title}"!`, 'success');
      closeCmeCampModal();
    }
  }

  // -------------------------------------------------------------
  // E-Detailing Slide Upload & Deck Player
  // -------------------------------------------------------------
  function openUploadSlideModal() {
    openModal('uploadSlideModal');
  }

  function closeUploadSlideModal() {
    closeModal('uploadSlideModal');
  }

  async function handleUploadSlideSubmit(e) {
    e.preventDefault();
    const prod = document.getElementById('slideProductName').value;
    const title = document.getElementById('slideTitleInput').value;
    const sub = document.getElementById('slideSubtitleInput').value;
    const seq = document.getElementById('slideSequenceInput').value;
    const highlight = document.getElementById('slideHighlightInput').value;

    const res = await fetch('/api/edetailing/upload-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ product_name: prod, slide_title: title, slide_subtitle: sub, slide_sequence: parseInt(seq) })
    });

    if (res.ok) {
      edetailingSlides.push({ id: edetailingSlides.length + 1, title, subtitle: sub, highlight: highlight || 'Key Finding' });
      showToast(`📤 Uploaded new slide "${title}" for ${prod}!`, 'success');
      closeUploadSlideModal();
    }
  }

  function openEdetailingModal() {
    currentSlideIndex = 0;
    slideSeconds = 0;
    renderCurrentSlide();
    openModal('eDetailingModal');

    if (slideTimerInterval) clearInterval(slideTimerInterval);
    slideTimerInterval = setInterval(() => {
      slideSeconds++;
      const timerEl = document.getElementById('slideTimerText');
      if (timerEl) timerEl.innerText = `Slide Time: ${slideSeconds}s`;
    }, 1000);
  }

  function closeEdetailingModal() {
    if (slideTimerInterval) clearInterval(slideTimerInterval);
    closeModal('eDetailingModal');
    showToast(`📊 Logged ${slideSeconds}s E-Detailing engagement duration for Doctor call.`, 'info');
  }

  function renderCurrentSlide() {
    const slide = edetailingSlides[currentSlideIndex];
    document.getElementById('slideTitle').innerText = slide.title;
    document.getElementById('slideSubtitle').innerText = slide.subtitle;
    document.getElementById('slideHighlightTag').innerText = slide.highlight;
    document.getElementById('slideIndexText').innerText = `Slide ${currentSlideIndex + 1} of ${edetailingSlides.length}`;
  }

  function nextSlide() {
    if (currentSlideIndex < edetailingSlides.length - 1) {
      currentSlideIndex++;
      renderCurrentSlide();
    } else {
      showToast('End of E-Detailing Presentation Deck.', 'info');
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      renderCurrentSlide();
    }
  }

  // -------------------------------------------------------------
  // Master Directory: Doctors & Distributors Registration
  // -------------------------------------------------------------
  function openAddDoctorModal() {
    openModal('addDoctorModal');
  }

  function closeAddDoctorModal() {
    closeModal('addDoctorModal');
  }

  async function handleAddDoctorSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newDocName').value;
    const spec = document.getElementById('newDocSpecialty').value;
    const cat = document.getElementById('newDocCategory').value;
    const area = document.getElementById('newDocAreaName').value;
    const phone = document.getElementById('newDocPhone').value;
    const email = document.getElementById('newDocEmail').value;
    const addr = document.getElementById('newDocAddress').value;

    const res = await fetch('/api/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ name, specialty: spec, category: cat, area_name: area, phone, email, clinic_address: addr, hospital_clinic_name: addr })
    });

    if (res.ok) {
      showToast(`👨‍⚕️ Registered Doctor ${name} in Area ${area}!`, 'success');
      closeAddDoctorModal();
      await loadInitialData();
      loadDoctorsAndChemists();
    }
  }

  async function deleteDoctorRecord(docId) {
    const res = await fetch(`/api/doctors/${docId}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-ID': activeTenantId, 'X-User-Role': activeRole }
    });

    if (res.ok) {
      showToast('Doctor record deleted by Head Office.', 'success');
      await loadInitialData();
      loadDoctorsAndChemists();
    } else {
      const err = await res.json();
      showToast(`⛔ ${err.error}`, 'danger');
    }
  }

  function openAddDistributorModal() {
    openModal('addDistributorModal');
  }

  function closeAddDistributorModal() {
    closeModal('addDistributorModal');
  }

  async function handleAddDistributorSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('dstName').value;
    const contact = document.getElementById('dstContactPerson').value;
    const phone = document.getElementById('dstPhone').value;
    const email = document.getElementById('dstEmail').value;
    const gstin = document.getElementById('dstGstin').value;
    const dl = document.getElementById('dstDrugLicense').value;
    const area = document.getElementById('dstAreaName').value;

    const res = await fetch('/api/distributors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ name, contact_person: contact, phone, email, gstin, drug_license_no: dl, area_name: area })
    });

    if (res.ok) {
      showToast(`🏢 Registered Distributor Firm ${name}!`, 'success');
      closeAddDistributorModal();
      await loadInitialData();
      loadDoctorsAndChemists();
    }
  }

  async function loadDoctorsAndChemists() {
    const tbody = document.getElementById('doctorsTableBody');
    if (tbody) {
      tbody.innerHTML = doctorMasterCache.map(d => `
        <tr>
          <td><strong>${d.code}</strong></td>
          <td>${d.name}</td>
          <td>${d.specialty}</td>
          <td><span class="tag-badge">${d.category}</span></td>
          <td><span class="tag-badge" style="background:var(--accent-teal); color:#04101e;">${d.area_name || 'Saket'}</span></td>
          <td>${d.clinic_address || d.hospital_clinic_name}</td>
          <td>${d.phone || '-'} / ${d.email || '-'}</td>
          <td>${d.prescribing_potential}</td>
          <td>
            <button class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem;" onclick="RepFlowApp.navigateToTab('dcr')">Log Visit</button>
            <button class="btn btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="RepFlowApp.deleteDoctorRecord(${d.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    const distBody = document.getElementById('distributorsTableBody');
    if (distBody) {
      distBody.innerHTML = distributorMasterCache.map(dst => `
        <tr>
          <td><strong>${dst.code}</strong></td>
          <td><strong>${dst.name}</strong></td>
          <td>${dst.contact_person || 'Manager'}</td>
          <td>${dst.phone || '-'} / ${dst.email || '-'}</td>
          <td><code>${dst.gstin || '-'}</code></td>
          <td><code>${dst.drug_license_no || '-'}</code></td>
          <td><span class="tag-badge" style="background:var(--accent-teal); color:#04101e;">${dst.area_name || 'Saket'}</span></td>
        </tr>
      `).join('');
    }
  }

  // -------------------------------------------------------------
  // Pharma DA/TA Expense Claim Calculation Engine
  // -------------------------------------------------------------
  function calculateExpenseTotal() {
    const station = document.getElementById('expStationType').value;
    let da = 350;
    if (station === 'EX-HQ') da = 650;
    if (station === 'OUT-STATION') da = 1200;

    const daPreview = document.getElementById('daPreviewText');
    if (daPreview) daPreview.innerText = `₹${da} / day (${station})`;

    const taMode = document.getElementById('expTaMode').value;
    let ta = 0;
    if (taMode === 'PER_KM') {
      const kms = parseFloat(document.getElementById('expKms').value) || 0;
      ta = kms * 6.00;
    } else {
      ta = parseFloat(document.getElementById('expTicketAmt').value) || 0;
    }

    const hotel = parseFloat(document.getElementById('expHotelAmt').value) || 0;
    const total = da + ta + hotel;

    const totalText = document.getElementById('totalClaimCalculatedText');
    if (totalText) totalText.innerText = `₹${total.toFixed(2)}`;
  }

  function handleTaModeChange(mode) {
    const kmGroup = document.getElementById('taKmGroup');
    const ticketGroup = document.getElementById('taTicketGroup');
    if (kmGroup) kmGroup.style.display = mode === 'PER_KM' ? 'block' : 'none';
    if (ticketGroup) ticketGroup.style.display = mode === 'TICKET_REIMBURSEMENT' ? 'block' : 'none';
    calculateExpenseTotal();
  }

  function openSubmitExpenseModal() {
    const expDate = document.getElementById('expDate');
    if (expDate) expDate.value = new Date().toISOString().substring(0, 10);
    calculateExpenseTotal();
    openModal('submitExpenseModal');
  }

  function closeSubmitExpenseModal() {
    closeModal('submitExpenseModal');
  }

  function triggerCameraCapture() {
    document.getElementById('receiptFileInput').click();
  }

  function handleReceiptFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('receiptStatusText').innerText = `Attached: ${file.name}`;
      showToast('📷 Receipt image attached to expense claim.', 'info');
    }
  }

  async function handleSubmitExpense(e) {
    e.preventDefault();
    const date = document.getElementById('expDate').value;
    const station = document.getElementById('expStationType').value;
    const taMode = document.getElementById('expTaMode').value;
    const kms = document.getElementById('expKms').value;
    const ticketAmt = document.getElementById('expTicketAmt').value;
    const hotelAmt = document.getElementById('expHotelAmt').value;
    const remarks = document.getElementById('expRemarks').value;

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, date, station_type: station, ta_mode: taMode, kms_travelled: kms, ta_ticket_amount: ticketAmt, hotel_amount: hotelAmt, remarks })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`💰 ${data.message}`, 'success');
      closeSubmitExpenseModal();
      loadExpenses();
    }
  }

  function openCorrectionModal(id, origAmt) {
    document.getElementById('correctExpId').value = id;
    document.getElementById('correctOriginalAmt').value = `₹${origAmt}`;
    document.getElementById('correctApprovedAmt').value = origAmt;
    document.getElementById('correctReason').value = '';
    openModal('expenseCorrectionModal');
  }

  function closeCorrectionModal() {
    closeModal('expenseCorrectionModal');
  }

  async function handleExpenseCorrectionSubmit(e) {
    e.preventDefault();
    const expId = document.getElementById('correctExpId').value;
    const approvedAmt = document.getElementById('correctApprovedAmt').value;
    const reason = document.getElementById('correctReason').value;

    const res = await fetch('/api/expenses/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ expense_id: parseInt(expId), action: 'APPROVED', approved_amount: parseFloat(approvedAmt), correction_reason: reason, reviewer_id: activeUser.id })
    });

    if (res.ok) {
      showToast('Expense claim review saved!', 'success');
      closeCorrectionModal();
      loadExpenses();
    } else {
      const err = await res.json();
      showToast(err.error || 'Correction failed', 'danger');
    }
  }

  async function loadExpenses() {
    try {
      const res = await fetch('/api/expenses', { headers: { 'X-Tenant-ID': activeTenantId } });
      const expenses = await res.json();

      const tbody = document.getElementById('expensesTableBody');
      if (tbody) {
        tbody.innerHTML = expenses.map(e => `
          <tr>
            <td>${e.date}</td>
            <td><strong>${e.mr_name}</strong></td>
            <td><span class="tag-badge">${e.station_type || 'HQ'}</span></td>
            <td>₹${e.da_amount || 350}</td>
            <td>${e.ta_mode === 'PER_KM' ? `${e.kms_travelled} km @ ₹6 (₹${e.ta_amount})` : `Ticket (₹${e.ta_amount})`}</td>
            <td>₹${e.hotel_amount || 0}</td>
            <td style="font-weight:700; color:var(--accent-emerald);">₹${e.original_amount}</td>
            <td style="font-weight:700; color:var(--accent-teal);">₹${e.approved_amount}</td>
            <td><span class="tag-badge" style="${e.status === 'CORRECTED' ? 'background:var(--accent-amber);' : e.status === 'APPROVED' ? 'background:var(--accent-emerald);' : ''}">${e.status}</span></td>
            <td>${e.correction_reason || e.remarks || '-'}</td>
            <td>
              ${(activeRole === 'AM' || activeRole === 'RM') && e.status === 'PENDING' ? `
                <button class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="RepFlowApp.openCorrectionModal(${e.id}, ${e.original_amount})">Review Claim</button>
              ` : ''}
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading expenses', e);
    }
  }

  // -------------------------------------------------------------
  // MTP Calendar & Day Planning
  // -------------------------------------------------------------
  async function renderMtpCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
      const res = await fetch(`/api/mtp?mr_id=${activeUser.id}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();
      const plannedDays = data.days || [];
      const plannedMap = {};
      plannedDays.forEach(d => { plannedMap[d.date] = d; });

      const daysInMonth = 31;
      const yearMonth = new Date().toISOString().substring(0, 7);

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        const fullDate = `${yearMonth}-${dayStr}`;
        const plan = plannedMap[fullDate];
        const isLeave = plan && plan.territory && plan.territory.includes('LEAVE');

        const card = document.createElement('div');
        card.className = `calendar-day-card ${isLeave ? 'leave-day' : ''}`;
        card.innerHTML = `
          <div class="day-number">Day ${day} (${fullDate})</div>
          ${plan ? `
            <div class="day-territory">${plan.territory}</div>
            <div class="day-objective">${plan.objective || ''}</div>
          ` : `
            <div style="font-size:0.75rem; color:var(--text-muted);">Not planned</div>
          `}
          ${!isLeave ? `<button class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; margin-top:6px;" onclick="RepFlowApp.openPlanMtpModal('${fullDate}')">Edit Day</button>` : `<span class="tag-badge" style="background:var(--accent-rose);">🔒 LOCKED</span>`}
        `;
        grid.appendChild(card);
      }
    } catch (e) {
      showToast('Failed to load MTP Calendar data', 'danger');
    }
  }

  function openPlanMtpModal(dateStr) {
    document.getElementById('modalMtpDate').innerText = dateStr;
    document.getElementById('mtpModalDate').value = dateStr;
    openModal('planMtpModal');
  }

  function closePlanMtpModal() {
    closeModal('planMtpModal');
  }

  async function handleSaveMtpDay(e) {
    e.preventDefault();
    const date = document.getElementById('mtpModalDate').value;
    const territory = document.getElementById('mtpTerritory').value;
    const workingType = document.getElementById('mtpWorkingType').value;
    const objective = document.getElementById('mtpObjective').value;

    const res = await fetch('/api/mtp/save-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mtp_id: 1, date, territory, working_type: workingType, objective })
    });

    if (res.ok) {
      showToast(`Planned visit for ${date} saved.`, 'success');
      closePlanMtpModal();
      renderMtpCalendar();
    }
  }

  function submitMonthMtp() {
    showToast('🗓️ Monthly Tour Program (MTP) submitted to Senior Manager for approval!', 'success');
  }

  // -------------------------------------------------------------
  // Leaves Management
  // -------------------------------------------------------------
  function openApplyLeaveModal() {
    const s = document.getElementById('leaveStartDate');
    const e = document.getElementById('leaveEndDate');
    if (s) s.value = new Date().toISOString().substring(0, 10);
    if (e) e.value = new Date().toISOString().substring(0, 10);
    openModal('applyLeaveModal');
  }

  function closeApplyLeaveModal() {
    closeModal('applyLeaveModal');
  }

  async function handleApplyLeaveSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const start = document.getElementById('leaveStartDate').value;
    const end = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value;

    const res = await fetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, leave_type: type, start_date: start, end_date: end, total_days: 1, reason })
    });

    if (res.ok) {
      showToast('🌴 Leave application submitted to Manager!', 'success');
      closeApplyLeaveModal();
      loadLeaves();
    }
  }

  async function loadLeaves() {
    try {
      const res = await fetch(`/api/leaves?mr_id=${activeUser.id}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();
      const balances = data.balances || {};
      const requests = data.requests || [];

      const cl = document.getElementById('clBalanceVal');
      const sl = document.getElementById('slBalanceVal');
      const el = document.getElementById('elBalanceVal');
      if (cl) cl.innerText = `${balances.cl_balance} Days`;
      if (sl) sl.innerText = `${balances.sl_balance} Days`;
      if (el) el.innerText = `${balances.el_balance} Days`;

      const tbody = document.getElementById('leavesTableBody');
      if (tbody) {
        tbody.innerHTML = requests.map(r => `
          <tr>
            <td>${r.created_at ? r.created_at.substring(0, 10) : ''}</td>
            <td><strong>${r.mr_name}</strong></td>
            <td><span class="tag-badge">${r.leave_type}</span></td>
            <td>${r.start_date} to ${r.end_date}</td>
            <td>${r.total_days} Days</td>
            <td>${r.reason}</td>
            <td><span class="tag-badge" style="${r.status === 'APPROVED' ? 'background:var(--accent-emerald);' : ''}">${r.status}</span></td>
            <td>
              ${(activeRole === 'AM' || activeRole === 'RM') && r.status === 'PENDING' ? `
                <button class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="RepFlowApp.reviewLeave(${r.id}, 'APPROVED')">Approve & Lock MTP</button>
              ` : ''}
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading leaves: ', e);
    }
  }

  async function reviewLeave(id, action) {
    const res = await fetch('/api/leaves/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ leave_id: id, action, reviewer_id: activeUser.id })
    });

    if (res.ok) {
      showToast(`Leave application ${action} and MTP calendar locked!`, 'success');
      loadLeaves();
    }
  }

  // -------------------------------------------------------------
  // Sample Bag & Inward Stock
  // -------------------------------------------------------------
  function openInwardStockModal() {
    const inwardDate = document.getElementById('inwardDate');
    if (inwardDate) inwardDate.value = new Date().toISOString().substring(0, 10);
    openModal('inwardStockModal');
  }

  function closeInwardStockModal() {
    closeModal('inwardStockModal');
  }

  async function handleInwardStockSubmit(e) {
    e.preventDefault();
    const productName = document.getElementById('inwardProductName').value;
    const itemType = document.getElementById('inwardItemType').value;
    const inwardQty = parseInt(document.getElementById('inwardQty').value);
    const batch = document.getElementById('inwardBatch').value || `B-${Date.now()}`;

    const res = await fetch('/api/sample-bag/inward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, product_name: productName, item_type: itemType, batch_number: batch, inward_qty: inwardQty })
    });
    if (res.ok) {
      showToast(`🎒 Received ${inwardQty} units of ${productName} into Virtual Sample Bag!`, 'success');
      closeInwardStockModal();
      loadSampleBag();
    }
  }

  function restockSampleBag() {
    fetch('/api/sample-bag/inward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, product_name: 'Cardia-90 10mg Catch Covers', inward_qty: 25 })
    }).then(() => {
      showToast('Restocked 25 units of Cardia-90 into Sample Bag!', 'success');
      loadSampleBag();
    });
  }

  async function loadSampleBag() {
    try {
      const res = await fetch(`/api/sample-bag?mr_id=${activeUser.id}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();
      currentSampleBagCache = data.items || [];

      const tbody = document.getElementById('sampleBagTableBody');
      if (tbody) {
        tbody.innerHTML = currentSampleBagCache.map(i => `
          <tr>
            <td><strong>${i.product_name}</strong></td>
            <td><span class="tag-badge">${i.item_type}</span></td>
            <td>${i.batch_number}</td>
            <td>${i.allocated_qty} units</td>
            <td style="font-weight:700; color:${i.is_low_stock ? 'var(--accent-rose)' : 'var(--accent-teal)'};">${i.current_qty} units</td>
            <td>${i.low_stock_threshold} units</td>
            <td>${i.is_low_stock ? '<span class="tag-badge" style="background:var(--accent-rose);">⚠️ LOW STOCK ALERT</span>' : '<span class="tag-badge" style="background:var(--accent-emerald);">NORMAL</span>'}</td>
          </tr>
        `).join('');
      }

      const banner = document.getElementById('lowStockBanner');
      if (banner) banner.style.display = data.low_stock_count > 0 ? 'block' : 'none';
      const statLowStock = document.getElementById('statLowStock');
      if (statLowStock) statLowStock.innerText = `${data.low_stock_count} Product${data.low_stock_count === 1 ? '' : 's'}`;
    } catch (e) {
      console.warn('Failed loading sample bag: ', e);
    }
  }

  // -------------------------------------------------------------
  // Gift Ledger
  // -------------------------------------------------------------
  function openDistributeGiftModal() {
    const docSelect = document.getElementById('giftDoctorSelect');
    if (docSelect && doctorMasterCache.length > 0) {
      docSelect.innerHTML = doctorMasterCache.map(d => `<option value="${d.id}">${d.name} (${d.hospital_clinic_name || d.area_name})</option>`).join('');
    }
    openModal('distributeGiftModal');
  }

  function closeDistributeGiftModal() {
    closeModal('distributeGiftModal');
  }

  async function handleDistributeGiftSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('giftDoctorSelect').value;
    const name = document.getElementById('giftNameInput').value;
    const qty = document.getElementById('giftQtyInput').value;
    const val = document.getElementById('giftValueInput').value;

    const res = await fetch('/api/gifts/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, doctor_id: parseInt(docId), gift_name: name, quantity: parseInt(qty), value_amount: parseFloat(val) })
    });

    if (res.ok) {
      showToast(`🎁 Gift distribution logged for Doctor.`, 'success');
      closeDistributeGiftModal();
      loadGifts();
    }
  }

  async function loadGifts() {
    try {
      const res = await fetch('/api/gifts', { headers: { 'X-Tenant-ID': activeTenantId } });
      const gifts = await res.json();

      const tbody = document.getElementById('giftsTableBody');
      if (tbody) {
        tbody.innerHTML = gifts.map(g => `
          <tr>
            <td>${g.date}</td>
            <td><strong>${g.doctor_name}</strong></td>
            <td>${g.specialty}</td>
            <td><span class="tag-badge">${g.gift_name}</span></td>
            <td>${g.quantity} unit(s)</td>
            <td style="color:var(--accent-teal); font-weight:700;">₹${g.value_amount.toLocaleString()}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading gift distribution ledger', e);
    }
  }

  // -------------------------------------------------------------
  // Target vs Sales Analytics & Upload
  // -------------------------------------------------------------
  function openUploadSalesDataModal() {
    openModal('uploadSalesDataModal');
  }

  function closeUploadSalesDataModal() {
    closeModal('uploadSalesDataModal');
  }

  function handleUploadSalesSubmit(e) {
    e.preventDefault();
    const prod = document.getElementById('salesProductSelect').value;
    const tgt = document.getElementById('salesMonthlyTarget').value;
    const sec = document.getElementById('salesSecondaryVal').value;
    showToast(`📈 Sales & Target updated for ${prod}! (Target: ₹${tgt}, Achieved: ₹${sec})`, 'success');
    closeUploadSalesDataModal();
  }

  async function loadSalesAnalytics() {
    try {
      const res = await fetch('/api/analytics/yoy-sales', { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();

      const ach = document.getElementById('statAchievement');
      const tgt = document.getElementById('targetAmountVal');
      const pri = document.getElementById('primarySalesVal');
      if (ach) ach.innerText = `${data.achievement_percentage}%`;
      if (tgt) tgt.innerText = `₹${data.target_amount.toLocaleString()}`;
      if (pri) pri.innerText = `₹${data.primary_sales.toLocaleString()}`;

      const breakdownContainer = document.getElementById('productSalesBreakdown');
      if (breakdownContainer) {
        breakdownContainer.innerHTML = data.product_breakdown.map(p => `
          <div style="margin-bottom:16px; background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:6px;">
              <span><strong>${p.product}</strong></span>
              <span>CY: <strong>₹${p.secondary.toLocaleString()}</strong> | Target: ₹${p.target.toLocaleString()} (<span style="color:var(--accent-emerald); font-weight:700;">+${p.yoy_growth}% YoY</span>)</span>
            </div>
            <div style="background:var(--bg-input); height:10px; border-radius:5px; overflow:hidden;">
              <div style="width:${p.pct}%; background:linear-gradient(90deg, var(--accent-teal), var(--accent-emerald)); height:100%;"></div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading YoY sales analytics', e);
    }
  }

  // -------------------------------------------------------------
  // Academic RoI Proposals
  // -------------------------------------------------------------
  function openAddRoiModal() {
    const docSelect = document.getElementById('roiDoctorSelect');
    if (docSelect && doctorMasterCache.length > 0) {
      docSelect.innerHTML = doctorMasterCache.map(d => `<option value="${d.id}">${d.name} (${d.hospital_clinic_name || d.area_name})</option>`).join('');
    }
    openModal('addRoiModal');
  }

  function closeAddRoiModal() {
    closeModal('addRoiModal');
  }

  function handleAddRoiSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('roiActivityType').value;
    const amt = document.getElementById('roiAmount').value;
    showToast(`🔬 Logged ${type} proposal of ₹${amt}!`, 'success');
    closeAddRoiModal();
  }

  function loadAcademicRoi() {
    fetch('/api/analytics/roi-hierarchical', { headers: { 'X-Tenant-ID': activeTenantId } }).then(r => r.json()).then(data => {
      const tbody = document.getElementById('roiTableBody');
      if (tbody && data.regional_compilation) {
        tbody.innerHTML = data.regional_compilation.map(r => `
          <tr>
            <td><strong>${r.area_manager}</strong></td>
            <td>Cardiology / Diabetes</td>
            <td>CME & Research Grant</td>
            <td>₹${r.investment.toLocaleString()}</td>
            <td>₹3,00,000</td>
            <td style="color:var(--accent-teal); font-weight:700;">₹${r.rx_yield.toLocaleString()}</td>
            <td style="color:var(--accent-emerald); font-weight:700;">+${r.roi_pct}%</td>
            <td><span class="tag-badge">${r.status}</span></td>
          </tr>
        `).join('');
      }
    });
  }

  // -------------------------------------------------------------
  // AM & RM Field Work Desks
  // -------------------------------------------------------------
  function openAmDcrModal() {
    const amDate = document.getElementById('amDate');
    if (amDate) amDate.value = new Date().toISOString().substring(0, 10);
    const docSelect = document.getElementById('amDoctorSelect');
    if (docSelect && doctorMasterCache.length > 0) {
      docSelect.innerHTML = doctorMasterCache.map(d => `<option value="${d.id}">${d.name} (${d.hospital_clinic_name || d.area_name})</option>`).join('');
    }
    openModal('amDcrModal');
  }

  function closeAmDcrModal() {
    closeModal('amDcrModal');
  }

  function toggleAmJoint(val) {
    const el = document.getElementById('amJointMrGroup');
    if (el) el.style.display = val === 'JOINT' ? 'block' : 'none';
  }

  async function handleAmDcrSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('amDate').value;
    const workingType = document.getElementById('amWorkingType').value;
    const jointMrId = workingType === 'JOINT' ? document.getElementById('amJointMr').value : null;
    const docId = document.getElementById('amDoctorSelect').value;
    const obs = document.getElementById('amObservations').value;

    const res = await fetch('/api/dcrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({ mr_id: activeUser.id, date, working_type: workingType, joint_with_user_id: jointMrId ? parseInt(jointMrId) : null, doctor_calls: [{ doctor_id: parseInt(docId), remarks: obs }] })
    });

    if (res.ok) {
      showToast(`👔 AM Field DCR Logged & Routed to Regional Manager!`, 'success');
      closeAmDcrModal();
    }
  }

  function openRmJointDcrModal() {
    const rmDate = document.getElementById('rmDate');
    if (rmDate) rmDate.value = new Date().toISOString().substring(0, 10);
    const docSelect = document.getElementById('rmDoctorSelect');
    if (docSelect && doctorMasterCache.length > 0) {
      docSelect.innerHTML = doctorMasterCache.map(d => `<option value="${d.id}">${d.name} (${d.hospital_clinic_name || d.area_name})</option>`).join('');
    }
    openModal('rmJointDcrModal');
  }

  function closeRmJointDcrModal() {
    closeModal('rmJointDcrModal');
  }

  function handleRmJointSubmit(e) {
    e.preventDefault();
    showToast('👔 RM Joint Field Call Logged & Routed to Zonal Sales Manager & Head Office!', 'success');
    closeRmJointDcrModal();
  }

  async function loadRmPortalData() {
    try {
      const res = await fetch('/api/analytics/roi-hierarchical', { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();

      const tbody = document.getElementById('rmRoiTableBody');
      if (tbody) {
        tbody.innerHTML = data.regional_compilation.map(r => `
          <tr>
            <td><strong>${r.area_manager}</strong></td>
            <td>${r.territory}</td>
            <td>₹${r.investment.toLocaleString()}</td>
            <td style="color:var(--accent-teal); font-weight:700;">₹${r.rx_yield.toLocaleString()}</td>
            <td style="color:var(--accent-emerald); font-weight:700;">+${r.roi_pct}%</td>
            <td><span class="tag-badge">${r.status}</span></td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading RM portal data', e);
    }
  }

  async function loadZsmPortalData() {
    try {
      const res = await fetch('/api/analytics/roi-hierarchical', { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();

      const tbody = document.getElementById('zsmRoiTableBody');
      if (tbody) {
        tbody.innerHTML = data.zonal_compilation.map(z => `
          <tr>
            <td><strong>${z.region_name}</strong></td>
            <td>Anita Sharma (RM)</td>
            <td>₹${z.investment.toLocaleString()}</td>
            <td style="color:var(--accent-teal); font-weight:700;">₹${z.rx_yield.toLocaleString()}</td>
            <td style="color:var(--accent-emerald); font-weight:700;">+${z.roi_pct}%</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading ZSM portal data', e);
    }
  }

  async function loadHoYieldAnalytics() {
    try {
      const res = await fetch('/api/analytics/roi-hierarchical', { headers: { 'X-Tenant-ID': activeTenantId } });
      const data = await res.json();
      const yieldData = data.ho_yield_analysis || [];

      const chartContainer = document.getElementById('hoYieldChartContainer');
      if (chartContainer) {
        chartContainer.innerHTML = yieldData.map(y => `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;">
              <span><strong>${y.activity_type}</strong> (Invested: ₹${y.total_investment.toLocaleString()})</span>
              <span style="color:var(--accent-emerald); font-weight:700;">Yield: +${y.yield_roi_pct}%</span>
            </div>
            <div style="background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden;">
              <div style="width:${Math.min(100, y.yield_roi_pct / 3.5)}%; background:linear-gradient(90deg, var(--accent-teal), var(--accent-emerald)); height:100%;"></div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed loading HO yield analytics', e);
    }
  }

  async function handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    showToast(`📊 Processing Excel sheet "${file.name}"...`, 'info');

    const res = await fetch('/api/master/import-doctors-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
      body: JSON.stringify({
        items: [
          { code: 'DOC-XLS-101', name: 'Dr. Ananya Roy', specialty: 'Gynaecology', category: 'Superstar', hospital_clinic_name: 'Apollo Cradle', preferred_time: '10:00 AM', prescribing_potential: '₹1,20,000/mo', territory_code: 'T-GREATER-KAILASH', phone: '+91 98100 22334', email: 'dr.ananya@cradle.com', clinic_address: 'Pusph Vihar Saket', area_name: 'Saket' },
          { code: 'DOC-XLS-102', name: 'Dr. K. S. Murthy', specialty: 'Cardiology', category: 'A+', hospital_clinic_name: 'Max Healthcare', preferred_time: '05:00 PM', prescribing_potential: '₹95,000/mo', territory_code: 'T-NEHRU-PLACE', phone: '+91 98200 44556', email: 'dr.murthy@max.com', clinic_address: 'Nehru Place Market', area_name: 'Nehru Place' }
        ]
      })
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`✅ ${data.message}`, 'success');
      await loadInitialData();
      loadDoctorsAndChemists();
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('Web Push Notifications are not supported in this browser.', 'warning');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast('🔔 Web Push Notifications Enabled for RepFlow!', 'success');
      await fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({ title: 'RepFlow Alert', body: 'Push notifications actively connected.' })
      });
    } else {
      showToast('Notification permission denied.', 'warning');
    }
  }

  // -------------------------------------------------------------
  // System Admin Control Panel (/system-admin)
  // -------------------------------------------------------------
  async function loadSystemAdminTenants() {
    try {
      const res = await fetch('/api/system-admin/tenants');
      if (res.ok) {
        const tenants = await res.json();
        const tbody = document.getElementById('sysAdminTenantsTableBody');
        const countTenants = document.getElementById('sysAdminCountTenants');
        const countSeats = document.getElementById('sysAdminCountSeats');

        if (countTenants) countTenants.innerText = `${tenants.length} Active`;

        let totalSeats = 0;
        tenants.forEach(t => totalSeats += (t.mr_seat_count || 0));
        if (countSeats) countSeats.innerText = `${totalSeats} Seats`;

        if (tbody) {
          tbody.innerHTML = tenants.map(t => {
            const statusBadge = t.status === 'Active' 
              ? '<span class="tag-badge" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid #10b981;">Active</span>' 
              : '<span class="tag-badge" style="background:rgba(244,63,94,0.2); color:#f43f5e; border:1px solid #f43f5e;">Suspended</span>';
            
            const isImpersonating = activeImpersonation && activeImpersonation.tenantId === t.id;

            return `
              <tr>
                <td>#TEN-${t.id}</td>
                <td><strong>${t.company_name}</strong><br><small style="color:var(--text-muted);">${t.therapeutic_focus || 'Cardio-Diab & General'}</small></td>
                <td><code>${t.subdomain}.repflow.com</code></td>
                <td><span class="tag-badge" style="background:rgba(124,58,237,0.2); color:#a78bfa;">${t.tier || 'Enterprise'}</span></td>
                <td>${t.mr_seat_count || 50} Assigned / ${t.max_seats || 100} Quota</td>
                <td>${statusBadge}</td>
                <td>
                  ${isImpersonating ? `
                    <button class="btn btn-sm" style="background:#f43f5e; color:#fff;" onclick="RepFlowApp.exitImpersonation()">
                      Exit Session 🚪
                    </button>
                  ` : `
                    <button class="btn btn-sm" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); color:#fff;" onclick="RepFlowApp.impersonateTenant(${t.id}, '${t.company_name}')">
                      Login as Tenant Admin 🕵️
                    </button>
                  `}
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading system admin tenants', e);
    }
  }

  async function loadSystemAdminLicenses() {
    try {
      const res = await fetch('/api/system-admin/licenses');
      if (res.ok) {
        const licenses = await res.json();
        const tbody = document.getElementById('sysAdminLicensesTableBody');
        if (tbody) {
          tbody.innerHTML = licenses.map(l => `
            <tr>
              <td><strong>${l.company_name || 'Pharma Tenant #' + l.tenant_id}</strong></td>
              <td><span class="tag-badge" style="background:rgba(124,58,237,0.2); color:#a78bfa;">${l.tier || 'Enterprise'}</span></td>
              <td>${l.e_detailing_clm ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>${l.secondary_sales ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>${l.sample_tracking ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>${l.geo_fencing ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>${l.tour_planning ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>${l.max_mr_seats} Seats</td>
              <td>${l.max_cdn_storage_gb} GB</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="RepFlowApp.showToast('Updated licensing flags for ${l.company_name}', 'success')">Configure</button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading system admin licenses', e);
    }
  }

  async function loadSystemAdminTemplates() {
    try {
      const res = await fetch('/api/system-admin/templates');
      if (res.ok) {
        const templates = await res.json();
        const tbody = document.getElementById('sysAdminTemplatesTableBody');
        if (tbody) {
          tbody.innerHTML = templates.map(t => `
            <tr>
              <td>#TMP-${t.id}</td>
              <td><span class="tag-badge" style="background:rgba(0,180,216,0.2); color:#00b4d8;">${t.category}</span></td>
              <td><code>${t.template_key}</code></td>
              <td><strong>${t.name}</strong></td>
              <td>${t.description || '-'}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading system admin templates', e);
    }
  }

  async function loadSystemAdminInfrastructure() {
    try {
      const res = await fetch('/api/system-admin/audit-logs');
      if (res.ok) {
        const logs = await res.json();
        const tbody = document.getElementById('sysAdminAuditLogsTableBody');
        if (tbody) {
          tbody.innerHTML = logs.map(l => `
            <tr>
              <td>#LOG-${l.id}</td>
              <td>${l.actor_email}</td>
              <td><span class="tag-badge" style="background:rgba(245,158,11,0.2); color:#f59e0b;">${l.action_event}</span></td>
              <td>Tenant #${l.tenant_id || 'Global'}</td>
              <td>${l.details || '-'}</td>
              <td>${new Date(l.created_at).toLocaleString()}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading system admin audit logs', e);
    }
  }

  function impersonateTenant(tenantId, tenantName) {
    activeImpersonation = { tenantId, tenantName };
    activeTenantId = tenantId;

    const banner = document.getElementById('impersonationBanner');
    const details = document.getElementById('impersonationDetails');
    if (banner && details) {
      details.innerText = `Viewing as Tenant Admin for "${tenantName}" (Tenant ID: #${tenantId})`;
      banner.style.display = 'flex';
    }

    switchPersona('HO');
    showToast(`🕵️ Impersonation Mode Active: Logged in as Company Admin for "${tenantName}"`, 'warning');
  }

  function exitImpersonation() {
    if (!activeImpersonation) return;
    const prevTenant = activeImpersonation.tenantName;
    activeImpersonation = null;

    const banner = document.getElementById('impersonationBanner');
    if (banner) banner.style.display = 'none';

    switchPersona('SUPERADMIN');
    showToast(`🚪 Exited Impersonation Session for "${prevTenant}". Returned to System Admin Control Panel.`, 'info');
  }

  async function triggerGlobalCacheBust() {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_BUST' });
      }
      showToast('💥 Global PWA Service Worker Cache Bust Triggered across active devices!', 'success');
      loadSystemAdminInfrastructure();
    } catch (e) {
      showToast('Cache bust signal emitted.', 'info');
    }
  }

  function openAddTemplateModal() {
    openModal('addTemplateModal');
  }

  function closeAddTemplateModal() {
    closeModal('addTemplateModal');
  }

  async function handleAddTemplateSubmit() {
    const category = document.getElementById('templateCategory').value;
    const name = document.getElementById('templateName').value;
    const description = document.getElementById('templateDescription').value;
    const template_key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
      const res = await fetch('/api/system-admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, template_key, description })
      });
      if (res.ok) {
        showToast(`📋 Master Taxonomy Template "${name}" created!`, 'success');
        closeAddTemplateModal();
        loadSystemAdminTemplates();
      }
    } catch (e) {
      showToast('Failed creating template.', 'error');
    }
  }

  // -------------------------------------------------------------
  // Company Admin Control Panel (/tenant-admin)
  // -------------------------------------------------------------
  async function loadTenantAdminTerritories() {
    try {
      const res = await fetch('/api/users', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (res.ok) {
        const users = await res.json();
        const tbody = document.getElementById('tenantAdminTerritoriesTableBody');
        if (tbody) {
          tbody.innerHTML = users.map(u => `
            <tr>
              <td>#USR-${u.id}</td>
              <td><strong>${u.name}</strong><br><small style="color:var(--text-muted);">${u.email || u.username || 'staff@pharma.com'}</small></td>
              <td><span class="tag-badge" style="background:rgba(0,245,212,0.15); color:#00f5d4;">${u.role}</span></td>
              <td>${u.therapeutic_division || 'Cardio-Diab'}</td>
              <td>${u.territory || u.headquarters || 'Delhi East HQ'}</td>
              <td>${u.reporting_manager_name || 'N/A'}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="RepFlowApp.impersonateUser(${u.id})">Edit Staff</button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenant admin territories', e);
    }
  }

  async function loadTenantAdminHcp() {
    try {
      const queueRes = await fetch('/api/tenant-admin/hcp-approval-queue', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (queueRes.ok) {
        const queue = await queueRes.json();
        const tbodyQueue = document.getElementById('tenantAdminHcpQueueTableBody');
        if (tbodyQueue) {
          if (queue.length === 0) {
            tbodyQueue.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No pending field doctor/chemist requests in queue.</td></tr>';
          } else {
            tbodyQueue.innerHTML = queue.map(q => `
              <tr>
                <td>#REQ-${q.id}</td>
                <td><strong>${q.mr_name || 'Rahul Sharma (MR)'}</strong></td>
                <td>${q.doc_name}</td>
                <td>${q.specialty}</td>
                <td><span class="tag-badge" style="background:rgba(245,158,11,0.2); color:#f59e0b;">${q.classification}</span></td>
                <td>${q.clinic_address}</td>
                <td>${q.territory}</td>
                <td>
                  <button class="btn btn-sm" style="background:var(--accent-emerald); color:#fff;" onclick="RepFlowApp.reviewHcpQueue(${q.id}, 'APPROVED')">Approve ✅</button>
                  <button class="btn btn-sm" style="background:#f43f5e; color:#fff;" onclick="RepFlowApp.reviewHcpQueue(${q.id}, 'REJECTED')">Reject ❌</button>
                </td>
              </tr>
            `).join('');
          }
        }
      }

      const docRes = await fetch(`/api/doctors?area_name=${activeAreaWorked}`, { headers: { 'X-Tenant-ID': activeTenantId } });
      if (docRes.ok) {
        const docs = await docRes.json();
        const tbodyDocs = document.getElementById('tenantAdminDoctorsTableBody');
        if (tbodyDocs) {
          tbodyDocs.innerHTML = docs.map(d => `
            <tr>
              <td>${d.code || 'DOC-' + d.id}</td>
              <td><strong>${d.name}</strong></td>
              <td>${d.specialty}</td>
              <td><span class="tag-badge" style="background:rgba(0,180,216,0.2); color:#00b4d8;">${d.category || 'Core A'}</span></td>
              <td>${d.hospital_clinic_name || d.clinic_address || 'Clinic HQ'}</td>
              <td><code>${d.lat ? `${d.lat.toFixed(4)}, ${d.long.toFixed(4)}` : '28.5355, 77.2638'}</code></td>
              <td>${d.target_visit_frequency || '2x / month'}</td>
              <td>${d.territory_code || 'Delhi NCR'}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenant admin HCP master', e);
    }
  }

  async function reviewHcpQueue(id, status) {
    try {
      const res = await fetch(`/api/tenant-admin/hcp-approval-queue/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`HCP Request #${id} updated to ${status}!`, 'success');
        loadTenantAdminHcp();
      }
    } catch (e) {
      showToast('Failed reviewing HCP request', 'error');
    }
  }

  async function loadTenantAdminProducts() {
    try {
      const clmRes = await fetch('/api/tenant-admin/clm', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (clmRes.ok) {
        const clm = await clmRes.json();
        const tbodyClm = document.getElementById('tenantAdminClmTableBody');
        if (tbodyClm) {
          tbodyClm.innerHTML = clm.map(c => `
            <tr>
              <td>#CLM-${c.id}</td>
              <td><strong>${c.title}</strong></td>
              <td><span class="tag-badge" style="background:rgba(124,58,237,0.2); color:#a78bfa;">${c.therapeutic_division}</span></td>
              <td><code>${c.file_type}</code></td>
              <td>${c.slides_count} Slides</td>
              <td>${c.offline_sync_enabled ? '✅ Offline Ready' : '⏳ Online Only'}</td>
            </tr>
          `).join('');
        }
      }

      const prodRes = await fetch('/api/tenant-admin/products', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (prodRes.ok) {
        const prods = await prodRes.json();
        const tbodyProds = document.getElementById('tenantAdminProductsTableBody');
        if (tbodyProds) {
          tbodyProds.innerHTML = prods.map(p => `
            <tr>
              <td>#SKU-${p.id}</td>
              <td><strong>${p.brand_name}</strong></td>
              <td>${p.molecule}</td>
              <td>${p.dosage_form}</td>
              <td>${p.pack_size}</td>
              <td>₹${p.pts}</td>
              <td>₹${p.ptr}</td>
              <td><strong>₹${p.mrp}</strong></td>
              <td><span class="tag-badge" style="background:rgba(0,180,216,0.2); color:#00b4d8;">${p.division}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenant admin products', e);
    }
  }

  function openAddProductSkuModal() {
    openModal('addProductSkuModal');
  }

  function closeAddProductSkuModal() {
    closeModal('addProductSkuModal');
  }

  async function handleAddProductSkuSubmit() {
    const brand_name = document.getElementById('skuBrandName').value;
    const molecule = document.getElementById('skuMolecule').value;
    const dosage_form = document.getElementById('skuDosageForm').value;
    const pack_size = document.getElementById('skuPackSize').value;
    const pts = parseFloat(document.getElementById('skuPts').value);
    const ptr = parseFloat(document.getElementById('skuPtr').value);
    const mrp = parseFloat(document.getElementById('skuMrp').value);
    const division = document.getElementById('skuDivision').value;

    try {
      const res = await fetch('/api/tenant-admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({ brand_name, molecule, dosage_form, pack_size, pts, ptr, mrp, division })
      });
      if (res.ok) {
        showToast(`💊 Product SKU "${brand_name}" added to master catalog!`, 'success');
        closeAddProductSkuModal();
        loadTenantAdminProducts();
      }
    } catch (e) {
      showToast('Failed adding product SKU.', 'error');
    }
  }

  function openUploadClmModal() {
    openModal('uploadClmModal');
  }

  function closeUploadClmModal() {
    closeModal('uploadClmModal');
  }

  async function handleUploadClmSubmit() {
    const title = document.getElementById('clmTitle').value;
    const therapeutic_division = document.getElementById('clmDivision').value;
    const file_type = document.getElementById('clmFileType').value;
    const slides_count = parseInt(document.getElementById('clmSlidesCount').value);

    try {
      const res = await fetch('/api/tenant-admin/clm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({ title, therapeutic_division, file_type, slides_count, offline_sync_enabled: 1 })
      });
      if (res.ok) {
        showToast(`📑 Published CLM Deck "${title}" for field sync!`, 'success');
        closeUploadClmModal();
        loadTenantAdminProducts();
      }
    } catch (e) {
      showToast('Failed uploading CLM deck.', 'error');
    }
  }

  async function loadTenantAdminGovernance() {
    try {
      const res = await fetch('/api/tenant-admin/governance', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (res.ok) {
        const gov = await res.json();
        if (gov) {
          if (document.getElementById('govMinDocCalls')) document.getElementById('govMinDocCalls').value = gov.min_doc_calls_per_day || 10;
          if (document.getElementById('govMinChemCalls')) document.getElementById('govMinChemCalls').value = gov.min_chem_calls_per_day || 4;
          if (document.getElementById('govGeofenceRadius')) document.getElementById('govGeofenceRadius').value = gov.geofence_radius_meters || 150;
          if (document.getElementById('govDcrCutoff')) document.getElementById('govDcrCutoff').value = gov.dcr_cutoff_time || '23:59';
        }
      }

      const sampleRes = await fetch('/api/samples/bag', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (sampleRes.ok) {
        const samples = await sampleRes.json();
        const tbody = document.getElementById('tenantAdminSampleDispatchTableBody');
        if (tbody) {
          tbody.innerHTML = samples.map(s => `
            <tr>
              <td>#SMP-${s.id}</td>
              <td><strong>Rahul Sharma (MR)</strong></td>
              <td>${s.brand_name}</td>
              <td>${s.item_type}</td>
              <td><code>${s.batch_number}</code></td>
              <td>50 Packs</td>
              <td><strong>${s.qty_available} Packs</strong></td>
              <td><span class="tag-badge" style="background:rgba(16,185,129,0.2); color:#10b981;">Active Stock</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenant admin governance policy', e);
    }
  }

  async function saveGovernancePolicyRules() {
    const min_doc_calls_per_day = parseInt(document.getElementById('govMinDocCalls').value);
    const min_chem_calls_per_day = parseInt(document.getElementById('govMinChemCalls').value);
    const geofence_radius_meters = parseInt(document.getElementById('govGeofenceRadius').value);
    const dcr_cutoff_time = document.getElementById('govDcrCutoff').value;

    try {
      const res = await fetch('/api/tenant-admin/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': activeTenantId },
        body: JSON.stringify({ min_doc_calls_per_day, min_chem_calls_per_day, geofence_radius_meters, dcr_cutoff_time })
      });
      if (res.ok) {
        showToast('⚖️ Field Governance Policies & DCR Rules Saved!', 'success');
      }
    } catch (e) {
      showToast('Failed saving governance rules.', 'error');
    }
  }

  async function loadTenantAdminReports() {
    try {
      const res = await fetch('/api/analytics/roi-hierarchical', { headers: { 'X-Tenant-ID': activeTenantId } });
      if (res.ok) {
        const data = await res.json();
        const tbody = document.getElementById('tenantAdminPerformanceTableBody');
        if (tbody && data.regional_compilation) {
          tbody.innerHTML = data.regional_compilation.map(r => `
            <tr>
              <td><code>${r.territory || 'T-NCR-01'}</code></td>
              <td><strong>${r.area_manager} (AM)</strong></td>
              <td>28 Docs</td>
              <td>26 Docs</td>
              <td><span class="tag-badge" style="background:rgba(16,185,129,0.2); color:#10b981;">92.8%</span></td>
              <td>${r.joint_calls || 8} Calls</td>
              <td style="color:var(--accent-teal); font-weight:700;">₹${r.rx_yield.toLocaleString()}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed loading tenant admin reports', e);
    }
  }

  function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return showToast('Table not found for CSV export', 'warning');

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      let rowData = [];
      const cols = row.querySelectorAll('th, td');
      cols.forEach(col => {
        let text = col.innerText.replace(/"/g, '""').replace(/\n/g, ' ');
        rowData.push(`"${text}"`);
      });
      csv.push(rowData.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`📥 Exported ${filename} successfully!`, 'success');
  }

  function refreshActiveTabData() {
    const activeTabBtn = document.querySelector('.nav-tab.active');
    if (activeTabBtn && activeTabBtn.dataset.tab) {
      navigateToTab(activeTabBtn.dataset.tab);
    }
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  const publicApi = {
    init,
    loadTenantsList,
    switchTenant,
    switchPersona,
    navigateToTab,
    toggleOfflineSim,
    handleAreaWorkedChange,
    handleStationTypeChange,
    addDoctorCallEntry,
    addChemistCallEntry,
    addSampleRowToDocCall,
    toggleJointWorking,
    handleDcrSubmit,
    printDcrPdf,
    printMtpPdf,
    printSalesReportPdf,
    openCmeCampModal,
    closeCmeCampModal,
    handleCmeCampSubmit,
    openUploadSlideModal,
    closeUploadSlideModal,
    handleUploadSlideSubmit,
    openAddDistributorModal,
    closeAddDistributorModal,
    handleAddDistributorSubmit,
    calculateExpenseTotal,
    handleTaModeChange,
    openSubmitExpenseModal,
    closeSubmitExpenseModal,
    triggerCameraCapture,
    handleReceiptFileSelect,
    handleSubmitExpense,
    openCorrectionModal,
    closeCorrectionModal,
    handleExpenseCorrectionSubmit,
    openEdetailingModal,
    closeEdetailingModal,
    nextSlide,
    prevSlide,
    openInwardStockModal,
    closeInwardStockModal,
    handleInwardStockSubmit,
    restockSampleBag,
    openApplyLeaveModal,
    closeApplyLeaveModal,
    handleApplyLeaveSubmit,
    reviewLeave,
    openAddDoctorModal,
    closeAddDoctorModal,
    handleAddDoctorSubmit,
    deleteDoctorRecord,
    openDistributeGiftModal,
    closeDistributeGiftModal,
    handleDistributeGiftSubmit,
    openPlanMtpModal,
    closePlanMtpModal,
    handleSaveMtpDay,
    submitMonthMtp,
    openUploadSalesDataModal,
    closeUploadSalesDataModal,
    handleUploadSalesSubmit,
    openAddRoiModal,
    closeAddRoiModal,
    handleAddRoiSubmit,
    openAmDcrModal,
    closeAmDcrModal,
    toggleAmJoint,
    handleAmDcrSubmit,
    openRmJointDcrModal,
    closeRmJointDcrModal,
    handleRmJointSubmit,
    openOnboardTenantModal,
    closeOnboardTenantModal,
    autoFillAdminCredentials,
    handleOnboardTenantSubmit,
    closeTenantSuccessModal,
    switchAndManageCreatedTenant,
    loadTeamHierarchyData,
    openCreateTeamMemberModal,
    closeCreateTeamMemberModal,
    handleRoleChangeForManagers,
    handleCreateTeamMemberSubmit,
    deleteTeamMember,
    impersonateUser,
    handleExcelFileSelect,
    requestNotificationPermission,
    toggleSidebarCollapse,
    toggleMobileSidebar,
    // Admin Panel Controllers
    loadSystemAdminTenants,
    loadSystemAdminLicenses,
    loadSystemAdminTemplates,
    loadSystemAdminInfrastructure,
    impersonateTenant,
    exitImpersonation,
    triggerGlobalCacheBust,
    openAddTemplateModal,
    closeAddTemplateModal,
    handleAddTemplateSubmit,
    loadTenantAdminTerritories,
    loadTenantAdminHcp,
    reviewHcpQueue,
    loadTenantAdminProducts,
    openAddProductSkuModal,
    closeAddProductSkuModal,
    handleAddProductSkuSubmit,
    openUploadClmModal,
    closeUploadClmModal,
    handleUploadClmSubmit,
    loadTenantAdminGovernance,
    saveGovernancePolicyRules,
    loadTenantAdminReports,
    exportTableToCSV,
    showToast,
    refreshActiveTabData
  };

  return publicApi;
})();

window.RepFlowApp = RepFlowApp;

document.addEventListener('DOMContentLoaded', () => {
  RepFlowApp.init();
});
