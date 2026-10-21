const test = require('node:test');
const assert = require('node:assert/strict');
const { getApiCatalog, API_METADATA, API_CATEGORIES } = require('../docs/apiCatalog');
const { renderHtmlDocs } = require('../docs/htmlRenderer');

test('API Catalog contains valid metadata and categories', () => {
    const catalog = getApiCatalog();
    assert.ok(catalog.title, 'Catalog must have a title');
    assert.ok(catalog.version, 'Catalog must have a version');
    assert.ok(catalog.baseUrl, 'Catalog must have a baseUrl');
    assert.ok(catalog.authentication, 'Catalog must have authentication guidelines');
    assert.ok(catalog.totalEndpoints > 30, `Expected > 30 endpoints, got ${catalog.totalEndpoints}`);
    assert.ok(Array.isArray(catalog.categories), 'Categories must be an array');
    assert.ok(catalog.categories.length >= 5, 'Must contain at least 5 main categories');
});

test('Every endpoint in catalog has required fields', () => {
    const catalog = getApiCatalog();
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    for (const cat of catalog.categories) {
        assert.ok(cat.id, 'Category must have an id');
        assert.ok(cat.name, 'Category must have a name');
        assert.ok(cat.basePath, 'Category must have a basePath');
        assert.ok(Array.isArray(cat.endpoints), 'Category endpoints must be array');

        for (const ep of cat.endpoints) {
            assert.ok(allowedMethods.includes(ep.method), `Invalid HTTP method: ${ep.method} in ${ep.path}`);
            assert.ok(ep.path.startsWith('/'), `Path must start with /: ${ep.path}`);
            assert.ok(ep.summary, `Endpoint must have summary: ${ep.path}`);
            assert.ok(ep.description, `Endpoint must have description: ${ep.path}`);
            assert.ok(ep.auth, `Endpoint must specify auth requirements: ${ep.path}`);
            assert.ok(Array.isArray(ep.responses), `Endpoint must define responses: ${ep.path}`);
        }
    }
});

test('HTML renderer produces complete HTML documentation', () => {
    const catalog = getApiCatalog();
    const html = renderHtmlDocs(catalog);

    assert.ok(html.startsWith('<!DOCTYPE html>'), 'Must produce full HTML document');
    assert.ok(html.includes(catalog.title), 'HTML must contain title');
    assert.ok(html.includes(catalog.baseUrl), 'HTML must contain base URL');
    assert.ok(html.includes('Authentication &amp; User Management') || html.includes('Authentication & User Management'), 'HTML must contain categories');
    assert.ok(html.includes('/api/user/register'), 'HTML must contain key endpoint paths');
    assert.ok(html.includes('/api/babysitter'), 'HTML must contain caregiver paths');
    assert.ok(html.includes('/api/bookings'), 'HTML must contain booking paths');
    assert.ok(html.includes('/api/blacklist'), 'HTML must contain blacklist paths');
    assert.ok(html.includes('/api/admin'), 'HTML must contain admin paths');
});
