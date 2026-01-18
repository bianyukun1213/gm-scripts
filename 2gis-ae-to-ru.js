// ==UserScript==
// @name         Browse Russian map on 2gis.ae
// @namespace    eab0b7b9-e09c-411b-9061-afde06811ae8
// @version      1.2.0
// @description  Change the region of 2gis.ae to Russia and block automatic redirection to 2gis.ru.
// @author       Hollis
// @match        https://2gis.ae/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=2gis.ae
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.displayOriginalUrl = function () {
        alert(location.origin + sessionStorage.getItem('originalUrl'));
    };
    window.editRegionStr = function () {
        const res = prompt('Input "regionStr" here.\nYour can get "regionStr" of the target city by visiting 2gis.ru and executing "console.log(initialState.data.region)".', regionStr || '');
        if (res) {
            localStorage.setItem('regionStr', res);
            location.reload();
            return true;
        }
        return false;
    };
    let regionStr = localStorage.getItem('regionStr');
    if (!regionStr) {
        const res = window.editRegionStr();
        if (!res) return;
    }
    let region = null;
    let regionId = null;
    let regionDefaultPos = null;
    let center = null;
    try {
        region = JSON.parse(regionStr);
        regionId = Object.keys(region.profile)[0];
        regionDefaultPos = region.profile[regionId].data.default_pos;
        center = { lon: regionDefaultPos.lon, lat: regionDefaultPos.lat };
    } catch {
        region = null;
        regionId = null;
        regionDefaultPos = null;
        center = null;
    }
    // 添加显示 Url 的按钮。
    window.addEventListener('load', function () {
        let btnRegionStrWrapper = document.createElement('div');
        btnRegionStrWrapper.style = 'position:absolute;inset-inline-end:0;top:162px;width:32px;height:32px;margin-inline-end:20px;';
        btnRegionStrWrapper.innerHTML = '<button id="btn-regionstr" title="Edit regionStr" onclick="editRegionStr()" style="width:100%;height:100%;background:#ffffff;box-shadow:0 1px 3px 0 rgba(38,38,38,0.5);border-radius:4px;"><div style="height:32px;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 32 32"><path fill="currentColor" d="M8 10.143v12.824l5.065-2.17 6 3L24 21.68V8.857l1.303-.558a.5.5 0 01.697.46V23l-7 3-6-3-6.303 2.701a.5.5 0 01-.697-.46V11l2-.857zm12.243 5.1L16 19.485l-4.243-4.242a6 6 0 118.486 0zM16 16.657l2.828-2.829a4 4 0 10-5.656 0L16 16.657z"></path></svg></div></button>';
        let btnUrlWrapper = document.createElement('div');
        btnUrlWrapper.style = 'position:absolute;inset-inline-end:0;top:200px;width:32px;height:32px;margin-inline-end:20px;';
        btnUrlWrapper.innerHTML = '<button id="btn-url" title="Display original Url" onclick="displayOriginalUrl()" style="width:100%;height:100%;background:#ffffff;box-shadow:0 1px 3px 0 rgba(38,38,38,0.5);border-radius:4px;"><div style="height:24px;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M13 16.17a2.991 2.991 0 0 1-2.121-.876l-1.586-1.587 1.414-1.414 1.586 1.586a1 1 0 0 0 1.414-.001l4.172-4.171A.993.993 0 0 0 18.172 9a.99.99 0 0 0-.293-.706L15.707 6.12a1 1 0 0 0-1.414 0l-1.086 1.086-1.414-1.414 1.086-1.086a3.005 3.005 0 0 1 4.242 0l2.172 2.172c.566.566.879 1.32.879 2.12 0 .802-.313 1.556-.879 2.123l-4.172 4.17A2.99 2.99 0 0 1 13 16.17zm-4 4a2.991 2.991 0 0 1-2.121-.876L4.707 17.12A2.982 2.982 0 0 1 3.828 15c0-.801.313-1.555.879-2.122l4.172-4.171a3.005 3.005 0 0 1 4.242 0l1.586 1.586-1.414 1.414-1.586-1.586a1 1 0 0 0-1.414 0l-4.172 4.172a.993.993 0 0 0-.293.707c0 .267.104.518.293.707l2.172 2.172a1 1 0 0 0 1.414-.001l1.086-1.085 1.414 1.414-1.086 1.086A2.99 2.99 0 0 1 9 20.17z"></path></svg></div></button>';
        // const toolbar = document.evaluate('//*[@id="root"]/div/div/div[2]/div[3]/div[1]/div/div', document).iterateNext();
        // toolbar.prepend(btnRegionStrWrapper);
        // toolbar.prepend(btnUrlWrapper);
        document.body.appendChild(btnRegionStrWrapper);
        document.body.appendChild(btnUrlWrapper);
    });

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

    // 修改搜索结果、室内商铺等为俄罗斯的，修改初始位置。
    intercept('__customcfg', (cfg) => {
        setPath(cfg, ['locale'], 'ru_RU');
        setPath(cfg, ['defaultCountryCode'], 'RU');
    });
    intercept('initialState', (state) => {
        setPath(state, ['appContext', 'defaultLocale'], 'ru_RU');
        if (center)
            setPath(state, ['appContext', 'center'], center);
        if (region)
            setPath(state, ['data', 'region'], region);
        setPath(state, ['data', 'region', 'detector', 'default', 'data', 'allowChangeDomain'], false);
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

    function wrapHistory(method) {
        const original = history[method];
        history[method] = function (state, unused, url) {
            sessionStorage.setItem('originalUrl', url);
            return original.apply(this, [state, unused, '/']);
        };
    }

    // 屏蔽 Url 更新，避免刷新后重定向到 2gis.ru。
    wrapHistory('pushState');
    wrapHistory('replaceState');
})();
