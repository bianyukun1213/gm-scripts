// ==UserScript==
// @name         Hollis 雨课堂助手
// @namespace    life.his2nd.yuketang-assistant
// @version      1.0
// @description  秒过部分课件。
// @author       Hollis
// @match        https://www.yuketang.cn/*
// @icon         https://www.google.com/s2/favicons?domain=yuketang.cn
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    let pageCount;
    function getCardsId() {
        let num = Number(window.location.href.split('/')[7]);
        return isNaN(num) ? 0 : num;
    }
    function getUserId() {
        let num = Number(localStorage.getItem('UserID'));
        return isNaN(num) ? 0 : num;
    }
    function checkBasePptComponent() {
        if (!window.location.href.startsWith('https://www.yuketang.cn/v2/web/studentCards/')) {
            return;
        }
        let basePptComponents = document.getElementsByClassName('basePPT__component');
        if (basePptComponents.length === 0) {
            return;
        }
        let progress = document.getElementsByClassName('progress')[0].innerText;
        pageCount = Number(progress.split('/')[1]);
        let layoutHeader = document.getElementsByClassName('layout-header')[0];
        let passButton = document.getElementById('pass-button');
        if (passButton === null) {
            let pButton = document.createElement('span');
            pButton.className = 'button';
            pButton.id = 'pass-button';
            pButton.innerText = '秒过';
            pButton.onclick = function () {
                // let userInput = prompt('输入每页的观看秒数，以空格隔开。假设有 3 页，每页看 10 秒，那么输入“10 10 10”。');
                // let durations = userInput.split(' ');
                // if (durations.length !== pageCount) {
                //     alert('输入无效。');
                //     return;
                // }
                // for (let i = 0; i < durations.length; i++) {
                //     let d = Number(durations[i]);
                //     if (isNaN(d) || d < 0) {
                //         alert('输入无效。');
                //         return;
                //     }
                //     durations[i] = d;
                // }
                let userInputRaw = prompt('输入每页的观看秒数：');
                let userInput = Number(userInputRaw);
                let durations = [];
                if (userInputRaw === null) {
                    return;
                }
                if (isNaN(userInput) || userInput < 0) {
                    alert('输入无效。');
                    return;
                }
                for (let i = 0; i < pageCount; i++) {
                    durations[i] = Math.floor(userInput + Math.random() * 10);
                }
                let dataViewRec = {
                    op: 'view_record',
                    cardsID: 0,
                    start_time: 0,
                    data: [],
                    user_id: 0,
                    platform: 'web',
                    type: 'cache'
                };
                let dataViewRecEnd = {
                    op: 'view_record',
                    cardsID: 0,
                    platform: 'web',
                    type: 'page'
                };
                dataViewRec.start_time = Date.now();
                dataViewRec.cardsID = getCardsId();
                dataViewRec.user_id = getUserId();
                dataViewRec.data = durations;
                dataViewRecEnd.cardsID = getCardsId();
                window.socket.send(JSON.stringify(dataViewRec));
                window.socket.send(JSON.stringify(dataViewRecEnd));
            };
            layoutHeader.appendChild(pButton);
        }
    }
    setInterval(checkBasePptComponent, 1000);
})();
