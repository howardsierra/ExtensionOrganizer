/**
 * Extension Organizer — sort, search, pin, and categorize the drawers in
 * SillyTavern's Extensions settings panel.
 *
 * The Extensions panel normally lists every extension's settings drawer in
 * load order across two columns. With a dozen extensions installed it becomes
 * a scavenger hunt. This extension:
 *
 *   - Adds a search bar that filters drawers by name as you type
 *   - Lets you PIN favorites (star on each drawer) into a section at the top
 *   - Lets you assign each drawer to a CATEGORY (Roleplay, UI, Memory, Tools,
 *     or any you create) — drawers group under collapsible colored headers
 *   - Optional A–Z sorting inside each section
 *   - "Organize" mode toggles the per-drawer controls on and off so the
 *     panel stays clean in everyday use
 *
 * Drawers are identified by their header title, so assignments survive
 * reloads and reinstalls. Turning the extension's grouping off restores the
 * vanilla layout after a refresh.
 */

(() => {
    'use strict';

    const MODULE = 'extensionOrganizer';

    /** Category accent colors — same family as the rest of the suite. */
    const PALETTE = ['#6FB8FF', '#FF6B9D', '#FFB347', '#4ECDC4', '#A8E05F', '#8B7CFF', '#FF8C66', '#E07BE0'];
    const PINNED = '⭐ Pinned';
    const OTHER = 'Other';

    const ctx = () => SillyTavern.getContext();

    function settings() {
        const es = ctx().extensionSettings;
        es[MODULE] = es[MODULE] || {
            grouping: true,
            sortAlpha: false,
            pinned: [],
            cats: {},                                   // { drawerName: category }
            customCats: ['Roleplay', 'UI', 'Memory', 'Tools'],
            collapsed: {},                              // { category: true }
        };
        return es[MODULE];
    }

    function save() { ctx().saveSettingsDebounced(); }

    /* ------------------------------------------------------------------ */
    /* Drawer discovery                                                    */
    /* ------------------------------------------------------------------ */

    const HOSTS = ['extensions_settings', 'extensions_settings2'];
    const originalOrder = new Map(); // name -> first-seen index
    let orderCounter = 0;

    function drawerName(el) {
        const b = el.querySelector('.inline-drawer-header b, .inline-drawer-header span b, .inline-drawer-header');
        return b?.textContent?.trim() ?? '';
    }

    /** Collect every top-level element in the settings hosts that wraps an inline-drawer. */
    function collectDrawers() {
        const found = [];
        for (const hostId of HOSTS) {
            const host = document.getElementById(hostId);
            if (!host) continue;
            for (const child of [...host.children]) {
                if (child.id?.startsWith('extorg_')) continue;        // our own UI
                if (!child.querySelector?.('.inline-drawer-header')) continue;
                const name = drawerName(child);
                if (!name) continue;
                if (!originalOrder.has(name)) originalOrder.set(name, orderCounter++);
                found.push({ el: child, name });
            }
        }
        // Also re-collect drawers already living inside our shelf (re-runs)
        document.querySelectorAll('#extorg_shelf .extorg-cat-body > *').forEach(child => {
            const name = drawerName(child);
            if (name) {
                if (!originalOrder.has(name)) originalOrder.set(name, orderCounter++);
                found.push({ el: child, name });
            }
        });
        return found;
    }

    /* ------------------------------------------------------------------ */
    /* Category model                                                      */
    /* ------------------------------------------------------------------ */

    function categoryOf(name) {
        const s = settings();
        if (s.pinned.includes(name)) return PINNED;
        return s.cats[name] || OTHER;
    }

    function categoryList() {
        const s = settings();
        // Pinned first, then user categories in their stored order, Other last
        return [PINNED, ...s.customCats, OTHER];
    }

    function catColor(cat) {
        if (cat === PINNED) return '#FFD700';
        if (cat === OTHER) return '#7E8799';
        const i = settings().customCats.indexOf(cat);
        return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
    }

    /* ------------------------------------------------------------------ */
    /* Build / apply                                                       */
    /* ------------------------------------------------------------------ */

    let applying = false;
    let organizeMode = false;
    let query = '';

    function shelf() { return document.getElementById('extorg_shelf'); }

    function apply() {
        if (applying) return;
        const s = settings();
        const host = document.getElementById(HOSTS[0]);
        if (!host) return;
        applying = true;
        try {
            ensureToolbar();
            if (!s.grouping) { applying = false; return; }

            let sh = shelf();
            if (!sh) {
                sh = document.createElement('div');
                sh.id = 'extorg_shelf';
                host.appendChild(sh);
            }
            sh.classList.toggle('extorg-organize', organizeMode);

            const drawers = collectDrawers();

            // Group drawers by category
            const groups = new Map();
            for (const d of drawers) {
                const cat = categoryOf(d.name);
                if (!groups.has(cat)) groups.set(cat, []);
                groups.get(cat).push(d);
            }

            // (Re)build category sections in order; reuse existing section
            // elements so open drawers don't lose state unnecessarily
            for (const cat of categoryList()) {
                const members = groups.get(cat) || [];
                let section = sh.querySelector(`[data-extorg-cat="${CSS.escape(cat)}"]`);
                if (!members.length) { section?.remove(); continue; }

                if (!section) {
                    section = document.createElement('div');
                    section.className = 'extorg-cat';
                    section.dataset.extorgCat = cat;
                    section.innerHTML = `
                        <div class="extorg-cat-head">
                            <span class="extorg-cat-caret fa-solid fa-chevron-down"></span>
                            <span class="extorg-cat-name"></span>
                            <span class="extorg-cat-count"></span>
                        </div>
                        <div class="extorg-cat-body"></div>`;
                    section.querySelector('.extorg-cat-head').addEventListener('click', () => {
                        const map = settings().collapsed;
                        map[cat] = !map[cat];
                        save();
                        apply();
                    });
                    sh.appendChild(section);
                }
                sh.appendChild(section); // enforce category order

                section.style.setProperty('--extorg-accent', catColor(cat));
                section.querySelector('.extorg-cat-name').textContent = cat;
                section.querySelector('.extorg-cat-count').textContent = members.length;
                const collapsed = !!s.collapsed[cat];
                section.classList.toggle('extorg-collapsed', collapsed);
                section.querySelector('.extorg-cat-caret').classList.toggle('extorg-rot', collapsed);

                // Sort members
                members.sort((a, b) => s.sortAlpha
                    ? a.name.localeCompare(b.name)
                    : (originalOrder.get(a.name) ?? 0) - (originalOrder.get(b.name) ?? 0));

                const body = section.querySelector('.extorg-cat-body');
                for (const d of members) {
                    decorate(d);
                    body.appendChild(d.el); // moves the drawer into place
                }
            }

            // Remove empty leftover sections
            sh.querySelectorAll('.extorg-cat').forEach(sec => {
                if (!sec.querySelector('.extorg-cat-body > *')) sec.remove();
            });

            applySearch();
        } finally {
            requestAnimationFrame(() => { applying = false; });
        }
    }

    /** Add pin star + category select to a drawer header (idempotent). */
    function decorate(d) {
        const header = d.el.querySelector('.inline-drawer-header');
        if (!header || header.querySelector('.extorg-pin')) {
            // refresh pin state on re-apply
            const pin = header?.querySelector('.extorg-pin');
            if (pin) pin.classList.toggle('extorg-pinned', settings().pinned.includes(d.name));
            const sel = header?.querySelector('.extorg-cat-select');
            if (sel) sel.value = settings().cats[d.name] || OTHER;
            return;
        }

        const pin = document.createElement('span');
        pin.className = 'extorg-pin fa-solid fa-star';
        pin.title = 'Pin to top';
        pin.classList.toggle('extorg-pinned', settings().pinned.includes(d.name));
        pin.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = settings();
            const i = s.pinned.indexOf(d.name);
            i >= 0 ? s.pinned.splice(i, 1) : s.pinned.push(d.name);
            save();
            apply();
        });

        const sel = document.createElement('select');
        sel.className = 'extorg-cat-select text_pole';
        sel.title = 'Assign category';
        rebuildSelect(sel, d.name);
        sel.addEventListener('click', e => e.stopPropagation());
        sel.addEventListener('change', (e) => {
            e.stopPropagation();
            const s = settings();
            if (sel.value === '__new__') {
                const name = prompt('New category name:')?.trim();
                if (name && !s.customCats.includes(name) && name !== PINNED && name !== OTHER) {
                    s.customCats.push(name);
                    s.cats[d.name] = name;
                } 
                rebuildSelect(sel, d.name);
            } else if (sel.value === OTHER) {
                delete s.cats[d.name];
            } else {
                s.cats[d.name] = sel.value;
            }
            save();
            apply();
        });

        header.appendChild(sel);
        header.appendChild(pin);
    }

    function rebuildSelect(sel, name) {
        const s = settings();
        sel.innerHTML = [
            ...[...s.customCats, OTHER].map(c => `<option value="${c}">${c}</option>`),
            `<option value="__new__">+ New category…</option>`,
        ].join('');
        sel.value = s.cats[name] || OTHER;
    }

    /* ------------------------------------------------------------------ */
    /* Search                                                              */
    /* ------------------------------------------------------------------ */

    function applySearch() {
        const sh = shelf();
        if (!sh) return;
        const q = query.trim().toLowerCase();
        sh.querySelectorAll('.extorg-cat').forEach(sec => {
            let visible = 0;
            sec.querySelectorAll('.extorg-cat-body > *').forEach(el => {
                const match = !q || drawerName(el).toLowerCase().includes(q);
                el.classList.toggle('extorg-hide', !match);
                if (match) visible++;
            });
            sec.classList.toggle('extorg-hide', visible === 0);
            // Searching temporarily expands collapsed sections with matches
            if (q && visible > 0) sec.classList.remove('extorg-collapsed');
            else if (!q) sec.classList.toggle('extorg-collapsed', !!settings().collapsed[sec.dataset.extorgCat]);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Toolbar                                                             */
    /* ------------------------------------------------------------------ */

    function ensureToolbar() {
        const host = document.getElementById(HOSTS[0]);
        if (!host || document.getElementById('extorg_toolbar')) return;
        const bar = document.createElement('div');
        bar.id = 'extorg_toolbar';
        bar.innerHTML = `
            <i class="fa-solid fa-magnifying-glass extorg-tb-icon"></i>
            <input id="extorg_search" class="text_pole" type="text"
                   placeholder="Search extensions…" autocomplete="off">
            <i id="extorg_sort" class="fa-solid fa-arrow-down-a-z extorg-tb-btn"
               title="Toggle A–Z sorting"></i>
            <i id="extorg_mode" class="fa-solid fa-sliders extorg-tb-btn"
               title="Organize mode: show pin and category controls"></i>`;
        host.prepend(bar);

        const s = settings();
        const sortBtn = bar.querySelector('#extorg_sort');
        sortBtn.classList.toggle('extorg-on', s.sortAlpha);

        bar.querySelector('#extorg_search').addEventListener('input', (e) => {
            query = e.target.value;
            applySearch();
        });
        sortBtn.addEventListener('click', () => {
            s.sortAlpha = !s.sortAlpha;
            sortBtn.classList.toggle('extorg-on', s.sortAlpha);
            save();
            apply();
        });
        bar.querySelector('#extorg_mode').addEventListener('click', (e) => {
            organizeMode = !organizeMode;
            e.target.classList.toggle('extorg-on', organizeMode);
            shelf()?.classList.toggle('extorg-organize', organizeMode);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Wiring                                                              */
    /* ------------------------------------------------------------------ */

    function watch() {
        // Extensions register their drawers at unpredictable times after load;
        // pick up latecomers and slot them into place.
        for (const hostId of HOSTS) {
            const host = document.getElementById(hostId);
            if (!host) continue;
            new MutationObserver(() => {
                if (applying) return;
                clearTimeout(watch._t);
                watch._t = setTimeout(apply, 120);
            }).observe(host, { childList: true });
        }
    }

    function init() {
        // Delay first pass so most extensions have registered their drawers
        setTimeout(() => { apply(); watch(); }, 800);
        console.log('[Extension Organizer] ready');
    }

    if (window.SillyTavern?.getContext) {
        const { eventSource, event_types } = ctx();
        eventSource.once(event_types.APP_READY, init);
        if (document.getElementById('extensionsMenu')) init();
    }
})();
