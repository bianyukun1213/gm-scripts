// ==UserScript==
// @name         不忘初心博客签到
// @namespace    life.his2nd.pc521-check-in
// @version      1.0
// @description  不忘初心博客签到。
// @author       Hollis
// @match        https://www.pc521.net/user-center.html?pd=qiandao
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.pc521.net
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    document.getElementsByClassName('qiandao-checkin')[0].click();
})();
