// ==UserScript==
// @name         使用 2gis.ae 浏览俄罗斯地图
// @namespace    eab0b7b9-e09c-411b-9061-afde06811ae8
// @version      1.0.0
// @description  将 2gis.ae 的区域数据更改为俄罗斯，并禁用自动域名重定向。
// @author       Hollis
// @match        https://2gis.ae/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=2gis.ae
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    function intercept(name, patchFn) {
        let value;
        Object.defineProperty(window, name, {
            configurable: true,
            set(v) {
                patchFn?.(v);
                value = v;
            },
            get() {
                return value;
            }
        });
    }

    function setPath(obj, path, val) {
        let cur = obj;
        for (let i = 0; i < path.length - 1; i++) {
            cur = cur?.[path[i]];
            if (!cur) return;
        }
        if (cur && path.at(-1) in cur) {
            cur[path.at(-1)] = val;
        }
    }

    // 修改搜索结果为俄罗斯的。
    intercept('__customcfg', (cfg) => {
        setPath(cfg, ['locale'], 'ru_RU');
        setPath(cfg, ['defaultCountryCode'], 'RU');
    });
    intercept('initialState', (state) => {
        setPath(state, ['appContext', 'defaultLocale'], 'ru_RU');
    });

    const rules = [];

    window.interceptXHR = function ({ match, patch }) {
        rules.push({ match, patch });
    };

    function deepPatch(obj, key, newValue, visited = new WeakSet()) {
        if (obj === null || typeof obj !== 'object') return;
        if (visited.has(obj)) return;
        visited.add(obj);
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            obj[key] = newValue;
        }
        if (Array.isArray(obj)) {
            for (const item of obj) {
                deepPatch(item, key, newValue, visited);
            }
        } else {
            for (const v of Object.values(obj)) {
                deepPatch(v, key, newValue, visited);
            }
        }
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__url = url;
        return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('readystatechange', function () {
            if (this.readyState !== 4) return;
            if (!this.__url) return;
            const rule = rules.find(r => {
                if (typeof r.match === 'function') return r.match(this.__url);
                if (r.match instanceof RegExp) return r.match.test(this.__url);
                return false;
            });
            if (!rule) return;
            const ct = this.getResponseHeader('content-type') || '';
            if (!ct.includes('application/json')) return;
            try {
                const data = JSON.parse(this.responseText);

                // 调用用户定义的 patch。
                rule.patch(data);

                const text = JSON.stringify(data);
                Object.defineProperty(this, 'responseText', { value: text });
                Object.defineProperty(this, 'response', { value: text });
            } catch (e) {
                console.warn('XHR patch failed', e);
            }
        });
        return origSend.apply(this, args);
    };

    // 将响应中的 allow_change_domain 改为 false，防止自动跳转到 2gis.ru 导致登录失效。
    window.interceptXHR({
        match: () => true,
        patch: data => {
            deepPatch(data, 'allow_change_domain', false);
        }
    });
})();
