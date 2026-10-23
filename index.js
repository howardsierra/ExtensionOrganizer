/**
 * Extension Organizer — sort, search, pin, and categorize the drawers in
 * SillyTavern's Extensions settings panel.
 *
 * The Extensions panel normally lists every extension's settings drawer in
 * load order across two columns. With a dozen extensions installed it becomes
 * a scavenger hunt. This extension:
 *
 *   - Auto-detects what TYPE each extension is (Image, Voice, Memory, Chat,
 *     UI, …) from its title, folder/manifest name, and settings contents,
 *     and color-codes every drawer, header, and badge by that type
 *   - Detects whether each extension is Core (bundled) or Third-party
 *   - Adds a search bar that filters drawers by name, type, or source
 *   - Adds color-coded type chips that filter the panel with one click
 *   - Lets you PIN favorites (star on each drawer) into a section at the top
 *   - Lets you override the auto type with any CATEGORY, including your own
 *   - Optional A–Z sorting inside each section
 *   - "Organize" mode toggles the per-drawer controls on and off so the
 *     panel stays clean in everyday use
 *
 * Drawers are identified by their header title, so assignments survive
 * reloads and reinstalls. Disabling the extension restores the vanilla
 * layout after a refresh.
 */

(() => {
    'use strict';

    const MODULE = 'extensionOrganizer';

    /**
     * Extension types, in match priority order (more specific first, so
     * "Chat Translation" lands in Translation, not Chat). Keywords are
     * matched on word starts against the drawer title and manifest/folder
     * name; `body` keywords are also counted in the drawer's own text as a
     * fallback when the title alone says nothing.
     */
    const TYPES = [
        { id: 'translate', label: 'Translation', short: 'Translate', icon: 'fa-language', color: '#A8E05F',
            kw: ['translat', 'language', 'locali', 'deepl', 'libretranslate'] },
        { id: 'image', label: 'Image & Vision', short: 'Image', icon: 'fa-image', color: '#FF6B9D',
            kw: ['image', 'stable diffusion', 'sd', 'comfy', 'caption', 'vision', 'gallery', 'background', 'dall', 'flux', 'picture', 'photo', 'img', 'illustrat', 'wallpaper'] },
        { id: 'voice', label: 'Voice & Audio', short: 'Audio', icon: 'fa-volume-high', color: '#FFB347',
            kw: ['tts', 'text-to-speech', 'speech', 'voice', 'audio', 'sound', 'music', 'rvc', 'whisper', 'stt', 'ambient', 'elevenlabs', 'silero', 'narrator'] },
        { id: 'character', label: 'Characters & Expressions', short: 'Character', icon: 'fa-masks-theater', color: '#E07BE0',
            kw: ['expression', 'character', 'sprite', 'live2d', 'vrm', 'talkinghead', 'avatar', 'persona', 'emotion', 'costume', 'outfit', 'card'] },
        { id: 'memory', label: 'Memory & Context', short: 'Memory', icon: 'fa-brain', color: '#8B7CFF',
            kw: ['summar', 'memory', 'memories', 'vector', 'data bank', 'databank', 'rag', 'lorebook', 'world info', 'worldinfo', 'recall', 'notebook', 'timeline', 'embedding', 'chunk'] },
        { id: 'web', label: 'Web & Integrations', short: 'Web', icon: 'fa-globe', color: '#6FB8FF',
            kw: ['web', 'search', 'discord', 'api', 'proxy', 'openrouter', 'browser', 'server', 'sync', 'function call', 'tool call', 'mcp', 'connection', 'webhook', 'url', 'http'] },
        { id: 'ui', label: 'UI & Themes', short: 'UI', icon: 'fa-palette', color: '#FF8C66',
            kw: ['theme', 'ui', 'css', 'style', 'layout', 'font', 'color', 'colour', 'visual', 'moving', 'panel', 'top bar', 'topbar', 'menu', 'zoom', 'animation', 'appearance', 'interface', 'mobile', 'display', 'cosmetic'] },
        { id: 'chat', label: 'Chat & Prompting', short: 'Chat', icon: 'fa-comments', color: '#4ECDC4',
            kw: ['quick reply', 'quickreply', 'regex', 'prompt', 'objective', 'author', 'swipe', 'reply', 'message', 'chat', 'thinking', 'tracker', 'guided', 'impersonat', 'dialogue', 'roleplay', 'rpg', 'dice', 'scenario', 'story', 'continue', 'generation', 'reasoning', 'slash command', 'script', 'stscript'] },
        { id: 'utility', label: 'Utilities', short: 'Utility', icon: 'fa-screwdriver-wrench', color: '#5FD3C0',
            kw: ['token', 'backup', 'stat', 'debug', 'log', 'asset', 'manager', 'organiz', 'import', 'export', 'util', 'tool', 'cleanup', 'timer', 'notif', 'hotkey', 'shortcut', 'keybind', 'bookmark', 'counter', 'cache', 'update'] },
    ];
    const TYPE_BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));
    const TYPE_BY_LABEL = Object.fromEntries(TYPES.map(t => [t.label, t]));
    const UNKNOWN_TYPE = { id: 'other', label: 'Other', short: 'Other', icon: 'fa-puzzle-piece', color: '#7E8799', kw: [] };

    /** Accent colors for user-made categories (avoids the type colors). */
    const PALETTE = ['#F25F5C', '#C3A6FF', '#FFD166', '#06D6A0', '#EF8FD1', '#9AD1FF', '#D4A373', '#B5E48C'];
    const PINNED = '⭐ Pinned';
    const OTHER = 'Other';
    const AUTO = '__auto__';

    /** Titles of drawers SillyTavern ships with — fallback when discovery fails. */
    const KNOWN_CORE = [
        'summarize', 'character expressions', 'image generation', 'image captioning', 'tts',
        'vector storage', 'chat translation', 'quick reply', 'regex', 'web search', 'speech recognition',
        'data bank', 'token counter', 'gallery', 'assets', 'connection profiles', 'talkinghead',
    ];

    const ctx = () => SillyTavern.getContext();

    function settings() {
        const es = ctx().extensionSettings;
        es[MODULE] = es[MODULE] || {
            grouping: true,
            sortAlpha: false,
            autoType: true,                             // group by detected type when unassigned
            pinned: [],
            cats: {},                                   // { drawerName: category }
            customCats: [],
            collapsed: {},                              // { category: true }
        };
        // Settings saved by v1.0 predate auto-typing
        if (es[MODULE].autoType === undefined) es[MODULE].autoType = true;
        return es[MODULE];
    }

    function save() { ctx().saveSettingsDebounced(); }

    const norm = (str) => String(str ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    /* ------------------------------------------------------------------ */
    /* Source discovery (Core vs Third-party)                              */
    /* ------------------------------------------------------------------ */

    /** normalized display name / folder name -> { source, folder } */
    const manifestIndex = new Map();
    let manifestsLoaded = false;

    /** Ask SillyTavern which extensions are installed and read their manifests. */
    async function loadManifests() {
        try {
            const headers = ctx().getRequestHeaders?.() ?? {};
            const res = await fetch('/api/extensions/discover', { headers });
            if (!res.ok) return;
            const list = await res.json();
            await Promise.all(list.map(async ({ name, type }) => {
                const source = type === 'system' ? 'core' : 'third';
                const folder = String(name).replace(/^third-party\//, '');
                const info = { source, folder };
                manifestIndex.set(norm(folder), info);
                try {
                    const m = await fetch(`/scripts/extensions/${name}/manifest.json`, { headers });
                    if (!m.ok) return;
                    const { display_name } = await m.json();
                    if (display_name) {
                        info.display = display_name;
                        manifestIndex.set(norm(display_name), info);
                    }
                } catch { /* manifest unreadable — folder name still counts */ }
            }));
            manifestsLoaded = true;
        } catch (err) {
            console.warn('[Extension Organizer] extension discovery failed', err);
        }
    }

    /** Find the manifest entry that best matches a drawer title. */
    function manifestFor(name) {
        const n = norm(name);
        if (manifestIndex.has(n)) return manifestIndex.get(n);
        // Folder names like "SillyTavern-Foo-Bar" or "st-foo" vs title "Foo Bar"
        const bare = (s) => s.replace(/\b(sillytavern|st|extension|ext|plugin)\b/g, '').replace(/\s+/g, '');
        const nb = bare(n);
        if (nb.length < 3) return null;
        for (const [key, info] of manifestIndex) {
            const kb = bare(key);
            if (kb.length >= 3 && (kb === nb || kb.includes(nb) || nb.includes(kb))) return info;
        }
        return null;
    }

    function sourceOf(name) {
        const m = manifestFor(name);
        if (m) return m.source;
        if (KNOWN_CORE.includes(norm(name))) return 'core';
        return manifestsLoaded ? 'third' : null;
    }

    /* ------------------------------------------------------------------ */
    /* Type detection                                                      */
    /* ------------------------------------------------------------------ */

    const kwRegex = new Map();
    function kwTest(kw, text) {
        if (!kwRegex.has(kw)) {
            const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Short keywords (ui, sd, tts…) must be whole words; longer ones match word starts
            kwRegex.set(kw, new RegExp(kw.length <= 3 ? `\\b${esc}\\b` : `\\b${esc}`, 'gi'));
        }
        const re = kwRegex.get(kw);
        re.lastIndex = 0;
        return (text.match(re) || []).length;
    }

    const typeCache = new Map(); // name -> type

    /** Work out an extension's type from its title, manifest, and settings text. */
    function detectType(name, el) {
        if (typeCache.has(name)) return typeCache.get(name);

        const m = manifestFor(name);
        const label = [name, m?.display, m?.folder?.replace(/[-_]+/g, ' ')].filter(Boolean).join(' ');
        let type = TYPES.find(t => t.kw.some(kw => kwTest(kw, label)));

        // Title said nothing — weigh keywords in the drawer's own labels/text
        if (!type && el) {
            const body = (el.textContent || '').slice(0, 4000);
            let best = null, bestScore = 1; // need at least 2 hits to be confident
            for (const t of TYPES) {
                const score = t.kw.reduce((sum, kw) => sum + kwTest(kw, body), 0);
                if (score > bestScore) { best = t; bestScore = score; }
            }
            type = best;
        }

        type = type || UNKNOWN_TYPE;
        // Drawer content can render late; only cache confident answers
        if (type !== UNKNOWN_TYPE) typeCache.set(name, type);
        return type;
    }

    /* ------------------------------------------------------------------ */
    /* Drawer discovery                                                    */
    /* ------------------------------------------------------------------ */

    const HOSTS = ['extensions_settings', 'extensions_settings2'];
    const originalOrder = new Map(); // name -> first-seen index
    let orderCounter = 0;

    const HEADER_SEL = '.inline-drawer-header, .inline-drawer-toggle';

    /** Text of an element, ignoring our own controls and form widgets. */
    function cleanText(node) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('[class*="extorg-"], select, option, input, textarea, button').forEach(n => n.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    /**
     * Name a settings block. Handles the standard inline-drawer layout as well
     * as extensions that use plain headings or bare wrappers. Cached on the
     * element so it stays stable once our controls are added to the header.
     */
    function drawerName(el) {
        if (el.dataset.extorgName) return el.dataset.extorgName;
        const header = el.querySelector(HEADER_SEL);
        const title = header?.querySelector('b, strong, .inline-drawer-title, h3, h4, span:not([class*="fa-"])')
            ?? header
            ?? el.querySelector('h2, h3, h4, b, strong, label');
        let name = title ? cleanText(title) : '';
        if (!name && el.id) name = el.id.replace(/[-_]+/g, ' ').replace(/\b(settings?|container)\b/gi, '').trim();
        name = name.slice(0, 80);
        if (name) el.dataset.extorgName = name;
        return name;
    }

    /** Collect every top-level settings block in the hosts. */
    function collectDrawers() {
        const found = [];
        const seen = new Set();
        const add = (el) => {
            const name = drawerName(el);
            if (!name) return;
            if (!originalOrder.has(name)) originalOrder.set(name, orderCounter++);
            found.push({ el, name });
            seen.add(el);
        };
        for (const hostId of HOSTS) {
            const host = document.getElementById(hostId);
            if (!host) continue;
            for (const child of [...host.children]) {
                if (child.id?.startsWith('extorg_')) continue;        // our own UI
                if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(child.tagName)) continue;
                if (!child.textContent.trim() && !child.querySelector(HEADER_SEL)) continue;
                add(child);
            }
        }
        // Also re-collect drawers already living inside our shelf (re-runs)
        document.querySelectorAll('#extorg_shelf .extorg-cat-body > *').forEach(child => {
            if (!seen.has(child)) add(child);
        });
        return found;
    }

    /* ------------------------------------------------------------------ */
    /* Category model                                                      */
    /* ------------------------------------------------------------------ */

    function categoryOf(d) {
        const s = settings();
        if (s.pinned.includes(d.name)) return PINNED;
        const assigned = s.cats[d.name];
        if (assigned && (assigned === OTHER || s.customCats.includes(assigned) || TYPE_BY_LABEL[assigned])) return assigned;
        return s.autoType ? d.type.label : OTHER;
    }

    function categoryList() {
        const s = settings();
        // Pinned first, then types, then user categories, Other last
        const types = TYPES.map(t => t.label);
        return [PINNED, ...types, ...s.customCats.filter(c => !types.includes(c) && c !== OTHER), OTHER];
    }

    function catColor(cat) {
        if (cat === PINNED) return '#FFD700';
        if (cat === OTHER) return UNKNOWN_TYPE.color;
        if (TYPE_BY_LABEL[cat]) return TYPE_BY_LABEL[cat].color;
        const i = settings().customCats.indexOf(cat);
        return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
    }

    function catIcon(cat) {
        if (cat === PINNED) return 'fa-star';
        if (cat === OTHER) return UNKNOWN_TYPE.icon;
        return TYPE_BY_LABEL[cat]?.icon ?? 'fa-folder';
    }

    /* ------------------------------------------------------------------ */
    /* Build / apply                                                       */
    /* ------------------------------------------------------------------ */

    let applying = false;
    let organizeMode = false;
    let query = '';
    let typeFilter = null; // type id or null

    function shelf() { return document.getElementById('extorg_shelf'); }

    function apply() {
        if (applying) return;
        const s = settings();
        const host = document.getElementById(HOSTS[0]);
        if (!host) return;
        applying = true;
        try {
            ensureToolbar();
            if (!s.grouping) return;

            let sh = shelf();
            if (!sh) {
                sh = document.createElement('div');
                sh.id = 'extorg_shelf';
                host.appendChild(sh);
            }
            sh.classList.toggle('extorg-organize', organizeMode);

            const drawers = collectDrawers();
            for (const d of drawers) {
                d.type = detectType(d.name, d.el);
                d.source = sourceOf(d.name);
            }

            // Group drawers by category
            const groups = new Map();
            for (const d of drawers) {
                const cat = categoryOf(d);
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
                            <span class="extorg-cat-icon fa-solid"></span>
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
                const icon = section.querySelector('.extorg-cat-icon');
                icon.className = `extorg-cat-icon fa-solid ${catIcon(cat)}`;
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

            renderTypeChips(drawers);
            applySearch();
        } finally {
            requestAnimationFrame(() => { applying = false; });
        }
    }

    /** Color-code a drawer and add its type/source badges and organize controls (idempotent). */
    function decorate(d) {
        const s = settings();
        const el = d.el;
        el.classList.add('extorg-drawer');
        el.style.setProperty('--extorg-type', d.type.color);
        el.dataset.extorgType = d.type.id;
        el.dataset.extorgSource = d.source ?? '';

        const header = el.querySelector(HEADER_SEL);
        // Blocks without a drawer header get their badges at the top instead
        const badgeHost = header ?? el;

        let badges = badgeHost.querySelector(':scope > .extorg-badges');
        if (!badges) {
            badges = document.createElement('span');
            badges.className = 'extorg-badges';
            const title = header && [...header.children].find(c => c.matches('b, strong, .inline-drawer-title, span:not([class*="fa-"])'));
            if (title) title.after(badges);
            else badgeHost.prepend(badges);
        }
        const srcLabel = d.source === 'core' ? 'Core' : d.source === 'third' ? '3rd-party' : '';
        badges.innerHTML = `
            <span class="extorg-type-badge" title="Detected type: ${d.type.label}">
                <i class="fa-solid ${d.type.icon}"></i><span>${d.type.short}</span>
            </span>
            ${srcLabel ? `<span class="extorg-src-badge extorg-src-${d.source}"
                title="${d.source === 'core' ? 'Bundled with SillyTavern' : 'Installed third-party extension'}">${srcLabel}</span>` : ''}`;

        if (!header) return;

        const pin = header.querySelector('.extorg-pin');
        if (pin) {
            // refresh state on re-apply
            pin.classList.toggle('extorg-pinned', s.pinned.includes(d.name));
            const sel = header.querySelector('.extorg-cat-select');
            if (sel) rebuildSelect(sel, d);
            return;
        }

        const newPin = document.createElement('span');
        newPin.className = 'extorg-pin fa-solid fa-star';
        newPin.title = 'Pin to top';
        newPin.classList.toggle('extorg-pinned', s.pinned.includes(d.name));
        newPin.addEventListener('click', (e) => {
            e.stopPropagation();
            const st = settings();
            const i = st.pinned.indexOf(d.name);
            i >= 0 ? st.pinned.splice(i, 1) : st.pinned.push(d.name);
            save();
            apply();
        });

        const sel = document.createElement('select');
        sel.className = 'extorg-cat-select text_pole';
        sel.title = 'Assign category';
        rebuildSelect(sel, d);
        sel.addEventListener('click', e => e.stopPropagation());
        sel.addEventListener('change', (e) => {
            e.stopPropagation();
            const st = settings();
            if (sel.value === '__new__') {
                const name = prompt('New category name:')?.trim();
                if (name && !categoryList().includes(name) && name !== AUTO) {
                    st.customCats.push(name);
                    st.cats[d.name] = name;
                }
            } else if (sel.value === AUTO) {
                delete st.cats[d.name];
            } else {
                st.cats[d.name] = sel.value;
            }
            rebuildSelect(sel, d);
            save();
            apply();
        });

        header.appendChild(sel);
        header.appendChild(newPin);
    }

    function rebuildSelect(sel, d) {
        const s = settings();
        const opt = (value, label) => {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;
            return o;
        };
        sel.replaceChildren(
            opt(AUTO, `Auto (${d.type.short})`),
            ...TYPES.map(t => opt(t.label, t.label)),
            ...s.customCats.filter(c => !TYPE_BY_LABEL[c] && c !== OTHER).map(c => opt(c, c)),
            opt(OTHER, OTHER),
            opt('__new__', '+ New category…'),
        );
        sel.value = s.cats[d.name] && [...sel.options].some(o => o.value === s.cats[d.name]) ? s.cats[d.name] : AUTO;
    }

    /* ------------------------------------------------------------------ */
    /* Search & type filter                                                */
    /* ------------------------------------------------------------------ */

    function applySearch() {
        const sh = shelf();
        if (!sh) return;
        const q = query.trim().toLowerCase();
        const filtering = !!q || !!typeFilter;
        sh.querySelectorAll('.extorg-cat').forEach(sec => {
            let visible = 0;
            sec.querySelectorAll('.extorg-cat-body > *').forEach(el => {
                const type = TYPE_BY_ID[el.dataset.extorgType] ?? UNKNOWN_TYPE;
                const src = el.dataset.extorgSource === 'core' ? 'core built-in'
                    : el.dataset.extorgSource === 'third' ? 'third-party 3rd-party' : '';
                const haystack = `${drawerName(el)} ${type.label} ${src}`.toLowerCase();
                const match = (!q || haystack.includes(q)) && (!typeFilter || type.id === typeFilter);
                el.classList.toggle('extorg-hide', !match);
                if (match) visible++;
            });
            sec.classList.toggle('extorg-hide', visible === 0);
            // Filtering temporarily expands collapsed sections with matches
            if (filtering && visible > 0) sec.classList.remove('extorg-collapsed');
            else if (!filtering) sec.classList.toggle('extorg-collapsed', !!settings().collapsed[sec.dataset.extorgCat]);
        });
    }

    /** Color-coded legend of detected types; click a chip to show only that type. */
    function renderTypeChips(drawers) {
        const wrap = document.getElementById('extorg_types');
        if (!wrap) return;
        const counts = new Map();
        for (const d of drawers) counts.set(d.type.id, (counts.get(d.type.id) || 0) + 1);
        if (typeFilter && !counts.has(typeFilter)) typeFilter = null;

        wrap.replaceChildren(...[...TYPES, UNKNOWN_TYPE].filter(t => counts.has(t.id)).map(t => {
            const chip = document.createElement('span');
            chip.className = 'extorg-chip';
            chip.style.setProperty('--extorg-type', t.color);
            chip.classList.toggle('extorg-on', typeFilter === t.id);
            chip.title = typeFilter === t.id ? 'Show all types' : `Show only ${t.label}`;
            chip.innerHTML = `<i class="fa-solid ${t.icon}"></i><span></span><b>${counts.get(t.id)}</b>`;
            chip.querySelector('span').textContent = t.short;
            chip.addEventListener('click', () => {
                typeFilter = typeFilter === t.id ? null : t.id;
                renderTypeChips(drawers);
                applySearch();
            });
            return chip;
        }));
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
            <div class="extorg-tb-row">
                <i class="fa-solid fa-magnifying-glass extorg-tb-icon"></i>
                <input id="extorg_search" class="text_pole" type="text"
                       placeholder="Search name, type, core / third-party…" autocomplete="off">
                <i id="extorg_auto" class="fa-solid fa-wand-magic-sparkles extorg-tb-btn"
                   title="Auto-group extensions by detected type"></i>
                <i id="extorg_sort" class="fa-solid fa-arrow-down-a-z extorg-tb-btn"
                   title="Toggle A–Z sorting"></i>
                <i id="extorg_mode" class="fa-solid fa-sliders extorg-tb-btn"
                   title="Organize mode: show pin and category controls"></i>
            </div>
            <div id="extorg_types"></div>`;
        host.prepend(bar);

        const s = settings();
        const sortBtn = bar.querySelector('#extorg_sort');
        const autoBtn = bar.querySelector('#extorg_auto');
        sortBtn.classList.toggle('extorg-on', s.sortAlpha);
        autoBtn.classList.toggle('extorg-on', s.autoType);

        bar.querySelector('#extorg_search').addEventListener('input', (e) => {
            query = e.target.value;
            applySearch();
        });
        autoBtn.addEventListener('click', () => {
            s.autoType = !s.autoType;
            autoBtn.classList.toggle('extorg-on', s.autoType);
            save();
            apply();
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

    let started = false;
    function init() {
        if (started) return;
        started = true;
        // Delay first pass so most extensions have registered their drawers
        setTimeout(() => { apply(); watch(); }, 800);
        // Re-apply once we know which extensions are core vs third-party
        loadManifests().then(() => { typeCache.clear(); apply(); });
        console.log('[Extension Organizer] ready');
    }

    if (window.SillyTavern?.getContext) {
        const { eventSource, event_types } = ctx();
        eventSource.once(event_types.APP_READY, init);
        if (document.getElementById('extensionsMenu')) init();
    }
})();
