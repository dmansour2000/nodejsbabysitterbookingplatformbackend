/**
 * Renders an interactive, responsive, modern HTML API Documentation page.
 * Self-contained: No external CDN dependencies required.
 */

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderHtmlDocs(catalog) {
    const categoriesHtml = catalog.categories.map((cat, catIdx) => {
        const endpointsHtml = cat.endpoints.map((ep, epIdx) => {
            const methodClass = `method-${ep.method.toLowerCase()}`;
            const isPublic = ep.auth.toLowerCase().includes('public');
            const authBadgeClass = isPublic ? 'badge-public' : 'badge-auth';
            const endpointId = `ep-${catIdx}-${epIdx}`;

            // Params table
            let paramsSection = '';
            if (ep.params) {
                const rows = Object.entries(ep.params).map(([pName, pInfo]) => `
                    <tr>
                        <td><code>:${escapeHtml(pName)}</code></td>
                        <td><span class="type-badge">${escapeHtml(pInfo.type)}</span></td>
                        <td>${pInfo.required ? '<span class="badge-req">required</span>' : '<span class="badge-opt">optional</span>'}</td>
                        <td>${escapeHtml(pInfo.description || '')}</td>
                    </tr>
                `).join('');
                paramsSection = `
                    <div class="doc-subgroup">
                        <h4>URL Path Parameters</h4>
                        <table class="doc-table">
                            <thead><tr><th>Parameter</th><th>Type</th><th>Requirement</th><th>Description</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            }

            // Query table
            let querySection = '';
            if (ep.query) {
                const rows = Object.entries(ep.query).map(([qName, qInfo]) => `
                    <tr>
                        <td><code>${escapeHtml(qName)}</code></td>
                        <td><span class="type-badge">${escapeHtml(qInfo.type)}</span></td>
                        <td>${qInfo.required ? '<span class="badge-req">required</span>' : '<span class="badge-opt">optional</span>'}</td>
                        <td>${escapeHtml(qInfo.description || '')}</td>
                    </tr>
                `).join('');
                querySection = `
                    <div class="doc-subgroup">
                        <h4>Query String Parameters</h4>
                        <table class="doc-table">
                            <thead><tr><th>Query Key</th><th>Type</th><th>Requirement</th><th>Description</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            }

            // Headers
            let headersSection = '';
            if (ep.headers) {
                const rows = Object.entries(ep.headers).map(([hKey, hVal]) => `
                    <tr>
                        <td><code>${escapeHtml(hKey)}</code></td>
                        <td><code>${escapeHtml(hVal)}</code></td>
                    </tr>
                `).join('');
                headersSection = `
                    <div class="doc-subgroup">
                        <h4>Headers</h4>
                        <table class="doc-table">
                            <thead><tr><th>Header</th><th>Expected Value</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            }

            // Request body
            let bodySection = '';
            if (ep.body) {
                bodySection = `
                    <div class="doc-subgroup">
                        <h4>Request Body Schema</h4>
                        <pre class="code-block"><code>${escapeHtml(JSON.stringify(ep.body, null, 2))}</code></pre>
                    </div>
                `;
            }

            // Responses
            let responsesSection = '';
            if (ep.responses && ep.responses.length > 0) {
                const respItems = ep.responses.map(r => `
                    <div class="response-item">
                        <div class="response-header">
                            <span class="status-badge status-${String(r.status)[0]}xx">${r.status}</span>
                            <span class="response-desc">${escapeHtml(r.description)}</span>
                        </div>
                        ${r.example ? `<pre class="code-block"><code>${escapeHtml(JSON.stringify(r.example, null, 2))}</code></pre>` : ''}
                    </div>
                `).join('');
                responsesSection = `
                    <div class="doc-subgroup">
                        <h4>Expected Responses</h4>
                        ${respItems}
                    </div>
                `;
            }

            // Example curl
            const curlSection = ep.exampleCurl ? `
                <div class="doc-subgroup">
                    <div class="curl-header">
                        <h4>Example cURL Request</h4>
                        <button class="btn-copy" onclick="copySnippet('${endpointId}-curl')">Copy cURL</button>
                    </div>
                    <pre class="code-block"><code id="${endpointId}-curl">${escapeHtml(ep.exampleCurl)}</code></pre>
                </div>
            ` : '';

            return `
                <article class="endpoint-card" data-method="${ep.method.toUpperCase()}" data-search="${escapeHtml((ep.path + ' ' + ep.summary + ' ' + ep.description + ' ' + cat.name).toLowerCase())}">
                    <header class="endpoint-header" onclick="toggleEndpoint('${endpointId}')">
                        <div class="endpoint-meta">
                            <span class="method-badge ${methodClass}">${ep.method}</span>
                            <span class="endpoint-path">${escapeHtml(ep.path)}</span>
                        </div>
                        <div class="endpoint-summary-wrapper">
                            <span class="endpoint-summary">${escapeHtml(ep.summary)}</span>
                            <span class="auth-badge ${authBadgeClass}">${escapeHtml(ep.auth)}</span>
                            <span class="toggle-icon" id="${endpointId}-icon">▼</span>
                        </div>
                    </header>
                    <div class="endpoint-body" id="${endpointId}-body">
                        <p class="endpoint-description">${escapeHtml(ep.description)}</p>
                        ${headersSection}
                        ${paramsSection}
                        ${querySection}
                        ${bodySection}
                        ${responsesSection}
                        ${curlSection}
                    </div>
                </article>
            `;
        }).join('');

        return `
            <section class="category-section" id="cat-${cat.id}">
                <div class="category-header">
                    <h2>${escapeHtml(cat.name)}</h2>
                    <span class="category-base">Base path: <code>${escapeHtml(cat.basePath)}</code></span>
                </div>
                <p class="category-desc">${escapeHtml(cat.description)}</p>
                <div class="endpoints-list">
                    ${endpointsHtml}
                </div>
            </section>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(catalog.title)}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👶</text></svg>">
    <style>
        :root {
            --bg-page: #f8fafc;
            --bg-card: #ffffff;
            --border: #e2e8f0;
            --border-hover: #cbd5e1;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --primary: #9333ea;
            --primary-hover: #7e22ce;
            --accent: #ec4899;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            
            --get-color: #2563eb;
            --get-bg: #eff6ff;
            --post-color: #16a34a;
            --post-bg: #f0fdf4;
            --put-color: #d97706;
            --put-bg: #fffbeb;
            --patch-color: #9333ea;
            --patch-bg: #faf5ff;
            --delete-color: #dc2626;
            --delete-bg: #fef2f2;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--font-sans);
            background-color: var(--bg-page);
            color: var(--text-main);
            line-height: 1.6;
            padding-bottom: 80px;
        }

        /* Top Hero Banner */
        .hero-banner {
            background: linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #701a75 100%);
            color: #ffffff;
            padding: 48px 24px 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .hero-inner {
            max-width: 1200px;
            margin: 0 auto;
        }
        .hero-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.25);
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background-color: #22c55e;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 8px #22c55e;
        }
        .hero-title {
            font-size: 32px;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 12px;
        }
        .hero-desc {
            font-size: 16px;
            color: #e2e8f0;
            max-width: 800px;
            margin-bottom: 24px;
        }
        .hero-details-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            background: rgba(0, 0, 0, 0.25);
            padding: 12px 18px;
            border-radius: 10px;
            font-size: 13px;
        }
        .hero-url {
            font-family: var(--font-mono);
            background: rgba(255,255,255,0.1);
            padding: 4px 10px;
            border-radius: 6px;
            word-break: break-all;
        }
        .hero-actions {
            margin-left: auto;
            display: flex;
            gap: 8px;
        }
        .btn-hero {
            background: #ffffff;
            color: #581c87;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 13px;
            transition: all 0.15s ease;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-hero:hover {
            background: #f1f5f9;
            transform: translateY(-1px);
        }

        /* Container */
        .container {
            max-width: 1200px;
            margin: -20px auto 0;
            padding: 0 20px;
        }

        /* Auth banner card */
        .auth-banner-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-left: 4px solid var(--primary);
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .auth-banner-card h3 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 6px;
            color: var(--primary);
        }
        .auth-banner-card p {
            font-size: 14px;
            color: var(--text-muted);
            margin-bottom: 10px;
        }
        .auth-code {
            font-family: var(--font-mono);
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            color: #334155;
            display: inline-block;
        }

        /* Controls / Search Bar */
        .controls-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 30px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .search-box-wrapper {
            flex: 1;
            min-width: 260px;
            position: relative;
        }
        .search-input {
            width: 100%;
            padding: 10px 14px 10px 36px;
            font-size: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .search-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.15);
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
        }
        .filter-buttons {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .filter-btn {
            background: #f1f5f9;
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .filter-btn:hover, .filter-btn.active {
            background: var(--primary);
            color: #ffffff;
            border-color: var(--primary);
        }

        /* Categories & Sections */
        .category-section {
            margin-bottom: 40px;
        }
        .category-header {
            display: flex;
            align-items: baseline;
            gap: 12px;
            margin-bottom: 6px;
            border-bottom: 2px solid var(--border);
            padding-bottom: 8px;
        }
        .category-header h2 {
            font-size: 22px;
            font-weight: 700;
            color: var(--text-main);
        }
        .category-base code {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--text-muted);
        }
        .category-desc {
            font-size: 14px;
            color: var(--text-muted);
            margin-bottom: 16px;
        }

        /* Endpoint Card */
        .endpoints-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .endpoint-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
            transition: all 0.15s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .endpoint-card:hover {
            border-color: var(--border-hover);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .endpoint-header {
            padding: 14px 18px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            cursor: pointer;
            user-select: none;
            background: #ffffff;
        }
        .endpoint-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: var(--font-mono);
            font-size: 14px;
        }
        .endpoint-path {
            font-weight: 700;
            color: var(--text-main);
        }
        .method-badge {
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            text-align: center;
            min-width: 65px;
            display: inline-block;
        }
        .method-get { background: var(--get-bg); color: var(--get-color); border: 1px solid #bfdbfe; }
        .method-post { background: var(--post-bg); color: var(--post-color); border: 1px solid #bbf7d0; }
        .method-put { background: var(--put-bg); color: var(--put-color); border: 1px solid #fef08a; }
        .method-patch { background: var(--patch-bg); color: var(--patch-color); border: 1px solid #e9d5ff; }
        .method-delete { background: var(--delete-bg); color: var(--delete-color); border: 1px solid #fecaca; }

        .endpoint-summary-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .endpoint-summary {
            font-size: 13px;
            color: var(--text-muted);
            font-weight: 500;
        }
        .auth-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .badge-public { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .badge-auth { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }

        .toggle-icon {
            font-size: 10px;
            color: var(--text-muted);
            transition: transform 0.2s ease;
        }
        .toggle-icon.open {
            transform: rotate(180deg);
        }

        /* Endpoint Body Accordion */
        .endpoint-body {
            display: none;
            padding: 20px;
            background: #fafafa;
            border-top: 1px solid var(--border);
        }
        .endpoint-body.open {
            display: block;
        }
        .endpoint-description {
            font-size: 14px;
            color: #334155;
            margin-bottom: 20px;
            line-height: 1.5;
        }

        .doc-subgroup {
            margin-bottom: 20px;
        }
        .doc-subgroup h4 {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #475569;
            margin-bottom: 8px;
            font-weight: 700;
        }

        /* Tables */
        .doc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .doc-table th, .doc-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        .doc-table th {
            background: #f1f5f9;
            font-weight: 600;
            color: #475569;
            font-size: 12px;
        }
        .doc-table code {
            font-family: var(--font-mono);
            font-size: 12px;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .type-badge {
            font-family: var(--font-mono);
            font-size: 11px;
            color: #0284c7;
        }
        .badge-req {
            font-size: 11px;
            font-weight: 600;
            color: #dc2626;
            background: #fef2f2;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .badge-opt {
            font-size: 11px;
            color: #64748b;
        }

        /* Code blocks */
        .code-block {
            font-family: var(--font-mono);
            background: #0f172a;
            color: #f8fafc;
            padding: 14px;
            border-radius: 8px;
            font-size: 12px;
            overflow-x: auto;
            line-height: 1.5;
        }
        .curl-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .btn-copy {
            background: #e2e8f0;
            border: none;
            color: #334155;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn-copy:hover {
            background: #cbd5e1;
        }

        /* Responses */
        .response-item {
            margin-bottom: 10px;
        }
        .response-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 6px;
        }
        .status-badge {
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
        }
        .status-2xx { background: #dcfce7; color: #15803d; }
        .status-4xx { background: #fef3c7; color: #b45309; }
        .status-5xx { background: #fee2e2; color: #b91c1c; }
        .response-desc {
            font-size: 13px;
            color: #475569;
        }

        /* Footer */
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 13px;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            padding-top: 24px;
        }
        .footer a {
            color: var(--primary);
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 4px 14px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.2s ease;
            pointer-events: none;
            z-index: 999;
        }
        .toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        @media (max-width: 768px) {
            .hero-title { font-size: 24px; }
            .hero-actions { margin-left: 0; width: 100%; justify-content: flex-start; }
            .endpoint-header { flex-direction: column; align-items: flex-start; }
            .endpoint-summary-wrapper { width: 100%; justify-content: space-between; }
        }
    </style>
</head>
<body>

    <header class="hero-banner">
        <div class="hero-inner">
            <div class="hero-brand">
                <span class="hero-badge"><span class="status-dot"></span> API v${escapeHtml(catalog.version)} &bull; Operational</span>
            </div>
            <h1 class="hero-title">${escapeHtml(catalog.title)}</h1>
            <p class="hero-desc">${escapeHtml(catalog.description)}</p>
            <div class="hero-details-row">
                <span><strong>Base URL:</strong></span>
                <span class="hero-url" id="base-url-text">${escapeHtml(catalog.baseUrl)}</span>
                <div class="hero-actions">
                    <button class="btn-hero" onclick="copyBaseUrl()">Copy URL</button>
                    <a class="btn-hero" href="/?format=json" target="_blank">View Raw JSON</a>
                </div>
            </div>
        </div>
    </header>

    <main class="container">
        <section class="auth-banner-card">
            <h3>Authentication Standard</h3>
            <p>${escapeHtml(catalog.authentication.description)}</p>
            <span class="auth-code">${escapeHtml(catalog.authentication.example)}</span>
        </section>

        <section class="controls-card">
            <div class="search-box-wrapper">
                <span class="search-icon">🔍</span>
                <input type="text" id="search-input" class="search-input" placeholder="Search routes, methods, summaries (e.g. login, bookings, caregiver, photo)..." oninput="applyFilters()">
            </div>
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="ALL" onclick="setMethodFilter('ALL')">ALL (${catalog.totalEndpoints})</button>
                <button class="filter-btn" data-filter="GET" onclick="setMethodFilter('GET')">GET</button>
                <button class="filter-btn" data-filter="POST" onclick="setMethodFilter('POST')">POST</button>
                <button class="filter-btn" data-filter="PUT" onclick="setMethodFilter('PUT')">PUT</button>
                <button class="filter-btn" data-filter="PATCH" onclick="setMethodFilter('PATCH')">PATCH</button>
                <button class="filter-btn" data-filter="DELETE" onclick="setMethodFilter('DELETE')">DELETE</button>
            </div>
        </section>

        <div id="categories-container">
            ${categoriesHtml}
        </div>

        <footer class="footer">
            <p>CareNest Platform &bull; <a href="https://dmansour2000.github.io" target="_blank" rel="noopener">CareNest Web App</a> &bull; Interactive API Documentation</p>
        </footer>
    </main>

    <div class="toast" id="toast">Copied to clipboard!</div>

    <script>
        let currentMethodFilter = 'ALL';

        function toggleEndpoint(id) {
            const body = document.getElementById(id + '-body');
            const icon = document.getElementById(id + '-icon');
            if (body && icon) {
                const isOpen = body.classList.contains('open');
                if (isOpen) {
                    body.classList.remove('open');
                    icon.classList.remove('open');
                } else {
                    body.classList.add('open');
                    icon.classList.add('open');
                }
            }
        }

        function setMethodFilter(method) {
            currentMethodFilter = method;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.getAttribute('data-filter') === method) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            applyFilters();
        }

        function applyFilters() {
            const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
            const cards = document.querySelectorAll('.endpoint-card');

            cards.forEach(card => {
                const cardMethod = card.getAttribute('data-method');
                const cardSearch = card.getAttribute('data-search') || '';

                const matchesMethod = (currentMethodFilter === 'ALL' || cardMethod === currentMethodFilter);
                const matchesQuery = (!query || cardSearch.includes(query));

                if (matchesMethod && matchesQuery) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });

            // Hide empty category sections
            document.querySelectorAll('.category-section').forEach(sec => {
                const visibleCards = sec.querySelectorAll('.endpoint-card:not([style*="display: none"])');
                sec.style.display = visibleCards.length > 0 ? '' : 'none';
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message || 'Copied to clipboard!';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        function copyBaseUrl() {
            const text = document.getElementById('base-url-text').textContent;
            navigator.clipboard.writeText(text).then(() => showToast('Base URL copied!'));
        }

        function copySnippet(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                navigator.clipboard.writeText(el.textContent).then(() => showToast('cURL request copied!'));
            }
        }
    </script>
</body>
</html>
`;
}

module.exports = {
    renderHtmlDocs
};

