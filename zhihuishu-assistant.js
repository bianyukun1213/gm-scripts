// ==UserScript==
// @name         Hollis 智慧树助手
// @namespace    life.his2nd.zhihuishu-assistant
// @version      1.1
// @description  解除反调试，开放文件下载，自动切换视频文件。
// @author       Hollis
// @match        https://hike.zhihuishu.com/aidedteaching/sourceLearning/sourceLearning*
// @icon         https://www.google.com/s2/favicons?domain=zhihuishu.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function startProcessing() {
        if (typeof window.Function !== 'undefined') {
            window.Function = undefined;
        }
        let noDownloadBtn = document.getElementsByClassName('download-btn tooltip tooltipstered')[0];
        if (typeof noDownloadBtn !== 'undefined') {
            let par = noDownloadBtn.parentNode;
            let newBtn = document.createElement('a');
            newBtn.className = 'download-btn';
            newBtn.innerHTML = '<i></i>给爷下载！';
            newBtn.onclick = () => {
                // let a = document.createElement('a');
                let targetBox = document.getElementById('viewBox').firstChild;
                switch (targetBox.className) {
                    case 'doc-box':
                        window.open(targetBox.firstChild.src.split('=')[1]);
                        // a.href = targetBox.firstChild.src.split('=')[1];
                        break;
                    case 'video-box':
                        window.open(document.getElementById('vjs_mediaPlayer_html5_api').src);
                        // a.href = document.getElementById('vjs_mediaPlayer_html5_api').src;
                        break;
                }
                // let file = window.curFile;
                // if (file.type == 3) {
                // }
                // else {
                //     a.href = file.filePath.split('=')[1];
                // }

                // document.body.appendChild(a);
                // a.click();
                // document.body.removeChild(a);
            };
            par.appendChild(newBtn);
            noDownloadBtn.remove();
        }

        function playNextVid() {
            if (document.getElementsByClassName('rate').length === 0) {
                let statusBoxes = document.getElementsByClassName('status-box');
                for (let i = 0; i < statusBoxes.length; i++) {
                    if (statusBoxes[i].children.length === 0 && statusBoxes[i].parentNode.getAttribute('class') === 'file-item') {
                        statusBoxes[i].parentNode.click();
                        break;
                    }
                }
            }
        }

        setInterval(playNextVid, 60000);
    }

    setTimeout(startProcessing, 3000);
})();
