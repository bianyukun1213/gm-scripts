// ==UserScript==
// @name         使用 2gis.ae 浏览俄罗斯地图
// @namespace    eab0b7b9-e09c-411b-9061-afde06811ae8
// @version      1.1.0
// @description  将 2gis.ae 的区域数据更改为俄罗斯，并禁用自动域名重定向。
// @author       Hollis
// @match        https://2gis.ae/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=2gis.ae
// @run-at       document-start
// @grant        none
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

    // 修改搜索结果、室内商铺等为俄罗斯的。
    intercept('__customcfg', (cfg) => {
        setPath(cfg, ['locale'], 'ru_RU');
        setPath(cfg, ['defaultCountryCode'], 'RU');
    });
    intercept('initialState', (state) => {
        setPath(state, ['appContext', 'defaultLocale'], 'ru_RU');
    });

    function interceptHTTP(rule) {
        interceptXHR(rule);
        interceptFetch(rule);
    }

    function interceptXHR(rule) {
        const open = XMLHttpRequest.prototype.open;
        const send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            let finalURL = url;
            if (matchRule(url, rule) && rule.request?.query) {
                const parsed = parseURL(url);
                rule.request.query(parsed.params);
                finalURL = parsed.url.toString();
            }
            this.__url = finalURL;
            this.__method = method;
            return open.call(this, method, finalURL, ...rest);
        };
        XMLHttpRequest.prototype.send = function (body) {
            // request.body
            if (body && rule.request?.body && matchRule(this.__url, rule)) {
                try {
                    const parsed = JSON.parse(body);
                    rule.request.body(parsed);
                    body = JSON.stringify(parsed);
                } catch { /**/ }
            }
            // response.body
            if (rule.response?.body && matchRule(this.__url, rule)) {
                this.addEventListener('readystatechange', () => {
                    if (this.readyState === 4) {
                        try {
                            const json = JSON.parse(this.responseText);
                            rule.response.body(json);
                            Object.defineProperty(this, 'responseText', {
                                value: JSON.stringify(json),
                            });
                        } catch { /**/ }
                    }
                });
            }
            return send.call(this, body);
        };
    }

    function interceptFetch(rule) {
        const originalFetch = window.fetch;
        window.fetch = async function (input, init = {}) {
            let url = typeof input === 'string' ? input : input.url;
            if (matchRule(url, rule)) {
                // query
                if (rule.request?.query) {
                    const parsed = parseURL(url);
                    rule.request.query(parsed.params);
                    url = parsed.url.toString();
                }
                // body
                if (init.body && rule.request?.body) {
                    try {
                        const parsed = JSON.parse(init.body);
                        rule.request.body(parsed);
                        init.body = JSON.stringify(parsed);
                    } catch { /**/ }
                }
            }
            const res = await originalFetch(url, init);
            if (!matchRule(url, rule) || !rule.response?.body) {
                return res;
            }
            const clone = res.clone();
            try {
                const json = await clone.json();
                rule.response.body(json);
                return new Response(JSON.stringify(json), {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers
                });
            } catch {
                return res;
            }
        }
    }

    function parseURL(url) {
        const u = new URL(url, location.origin);
        return {
            url: u,
            params: u.searchParams
        };
    }

    function matchRule(url, rule) {
        if (rule.match?.url && !rule.match.url.test(url)) {
            return false;
        }
        if (rule.match?.query) {
            const { params } = parseURL(url);
            for (const [k, v] of Object.entries(rule.match.query)) {
                if (params.get(k) !== v) return false;
            }
        }
        return true;
    }

    function deepModify(obj, targetKey, modifier) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(v => deepModify(v, targetKey, modifier));
            return;
        }
        for (const key of Object.keys(obj)) {
            if (key === targetKey) {
                obj[key] = modifier(obj[key]);
            } else {
                deepModify(obj[key], targetKey, modifier);
            }
        }
    }

    // 示例：
    // interceptHTTP({
    //     match: {
    //         url: /2gis/,
    //         query: {
    //             locale: 'en_AE',
    //         }
    //     },
    //     request: {
    //         query(params) {
    //             params.set('locale', 'ru_RU')
    //         }
    //     },
    //     response: {
    //         body(body) {
    //             deepModify(body, 'allow_change_domain', () => false)
    //         }
    //     }
    // });

    interceptHTTP({
        response: {
            body(body) {
                deepModify(body, 'allow_change_domain', () => false);
            }
        }
    });
})();
